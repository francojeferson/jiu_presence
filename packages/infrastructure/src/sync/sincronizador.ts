/**
 * O sincronizador.
 *
 * Processa o outbox em ordem, PARANDO na primeira falha transitória.
 *
 * Parar é deliberado e não é desperdício: continuar enviando itens
 * posteriores violaria a ordenação e poderia produzir violação de chave
 * estrangeira — a presença de um aluno cuja criação ainda não subiu. O item
 * que falhou será retentado com espera crescente, e a fila retoma dali.
 */

import type { EstadoDeSincronizacao, Sincronizador as PortaSincronizador } from '@jiupresence/domain';

import {
  Outbox,
  esperaParaTentativa,
  observarFila,
} from '../local/outbox.js';
import { bancoLocal, type BancoLocal } from '../local/db.js';
import { classificar, mensagemParaOProfessor } from './classificacao.js';
import type { MonitorDeConectividade } from './conectividade.js';

export interface EnvioRemoto {
  enviar(item: import('../local/db.js').ItemDaFila): Promise<
    import('./classificacao.js').RespostaDoServidor
  >;
}

export interface ResultadoDaRodada {
  readonly enviados: number;
  readonly adiados: number;
  readonly falhasPermanentes: number;
  readonly interrompidaPor: 'fila-vazia' | 'falha-transitoria' | 'ja-rodando';
}

const OCUPADA: ResultadoDaRodada = {
  enviados: 0,
  adiados: 0,
  falhasPermanentes: 0,
  interrompidaPor: 'ja-rodando',
};

/** Nome do bloqueio entre abas. Um por origem, que é o escopo do banco. */
const BLOQUEIO_DA_FILA = 'jiupresence.outbox';

/**
 * Roda a tarefa com a fila só para si, quando o navegador oferece Web Locks.
 *
 * Devolve `null` quando outra aba já está com a fila — não espera, porque a
 * outra aba vai esvaziá-la de qualquer jeito e enfileirar uma segunda rodada
 * só atrasaria a notificação da tela.
 *
 * Sem Web Locks, executa assim mesmo: a idempotência continua garantindo que
 * nada se duplique, e bloquear a sincronização por falta de uma API seria
 * trocar desperdício por perda.
 */
async function comFilaExclusiva<T>(tarefa: () => Promise<T>): Promise<T | null> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks) return tarefa();

  return locks.request(BLOQUEIO_DA_FILA, { ifAvailable: true }, async (lock) =>
    lock === null ? null : tarefa(),
  );
}

export class SincronizadorOutbox implements PortaSincronizador {
  private readonly outbox: Outbox;
  private rodando = false;
  private iniciada = false;
  private rodadaSolicitada = false;
  private retentativa: ReturnType<typeof setTimeout> | null = null;
  private ouvintes = new Set<(estado: EstadoDeSincronizacao) => void>();
  private desinscrever: (() => void)[] = [];

  constructor(
    private readonly remoto: EnvioRemoto,
    private readonly conectividade: MonitorDeConectividade,
    db: BancoLocal = bancoLocal(),
  ) {
    this.outbox = new Outbox(db);
  }

  /**
   * Prepara o sincronizador e passa a reagir ao retorno de conectividade
   * (RF-26: sem ação do professor).
   */
  async iniciar(): Promise<void> {
    if (this.iniciada) return;
    this.iniciada = true;

    // Itens presos em 'enviando' por encerramento abrupto do app voltam
    // para a fila. Sem isso, uma chamada ficaria travada para sempre.
    await this.outbox.destravar();

    this.desinscrever.push(
      this.conectividade.observar((online) => {
        if (online) void this.sincronizarAgora();
      }),
      observarFila((mudanca) => {
        if (mudanca !== 'enfileiramento' || !this.conectividade.online) return;
        setTimeout(() => void this.sincronizarAgora(), 0);
      }),
    );
    this.conectividade.iniciar();

    await this.sincronizarAgora();
  }

  /**
   * Desliga o sincronizador.
   *
   * `observarFila` guarda os ouvintes em um Set de MÓDULO, que sobrevive ao
   * descarte da instância. Sem desinscrever, sair da conta deixava um
   * sincronizador zumbi escutando a fila: quando o próximo operador
   * enfileirasse algo, duas instâncias processariam o mesmo outbox ao mesmo
   * tempo. Cada uma tem seu próprio `rodando`, então o bloqueio do EC-08 não
   * cobre esse caso.
   */
  parar(): void {
    for (const cancelar of this.desinscrever.splice(0)) cancelar();
    if (this.retentativa !== null) {
      clearTimeout(this.retentativa);
      this.retentativa = null;
    }
    this.iniciada = false;
  }

  async estado(): Promise<EstadoDeSincronizacao> {
    const [pendentes, falhas] = await Promise.all([
      this.outbox.pendentes(),
      this.outbox.falhasPermanentes(),
    ]);
    return {
      online: this.conectividade.online,
      pendentes,
      falhasPermanentes: falhas.length,
      sincronizando: this.rodando,
    };
  }

  async sincronizarAgora(): Promise<void> {
    if (this.rodando) {
      this.rodadaSolicitada = true;
      return;
    }

    do {
      this.rodadaSolicitada = false;
      await this.rodada();
    } while (this.rodadaSolicitada);
  }

  /**
   * EC-08: uma rodada de cada vez, inclusive ENTRE ABAS.
   *
   * O bloqueio `rodando` vive na memória da instância e não enxerga a outra
   * aba: as duas buscavam o mesmo item e o enviavam duas vezes. A chave de
   * idempotência impedia a duplicata no servidor, mas ela é a segunda linha
   * de defesa, não a primeira — e pagar duas vezes a rede de um dia offline
   * sai caro no celular do professor.
   *
   * Web Locks e não uma marca no banco: o navegador solta o bloqueio sozinho
   * quando a aba fecha ou trava. Uma marca gravada ficaria presa, e a fila
   * inteira com ela.
   */
  async rodada(agora: Date = new Date()): Promise<ResultadoDaRodada> {
    if (this.rodando) return OCUPADA;
    return (await comFilaExclusiva(() => this.executarRodada(agora))) ?? OCUPADA;
  }

  private async executarRodada(agora: Date): Promise<ResultadoDaRodada> {
    this.rodando = true;
    await this.notificar();

    let enviados = 0;
    let adiados = 0;
    let permanentes = 0;
    let motivo: ResultadoDaRodada['interrompidaPor'] = 'fila-vazia';

    try {
      const pendentes = await this.outbox.prontos(agora);

      for (const item of pendentes) {
        await this.outbox.marcarEnviando(item.id);
        const resposta = await this.remoto.enviar(item);

        // Resposta do servidor prova que há internet; validação local não diz
        // nada sobre a rede.
        if (resposta.codigo !== 'PAYLOAD_INVALIDO') {
          this.conectividade.registrarResultado(resposta.status > 0);
        }

        // `tentativas` entra na decisão porque uma dependência que nunca chega
        // precisa parar de ser esperada, em vez de travar a fila inteira.
        const classe = classificar(resposta, item.tipo, item.tentativas);

        if (classe === 'sucesso') {
          await this.outbox.concluir(item.id);
          enviados += 1;
          continue;
        }

        if (classe === 'permanente') {
          await this.outbox.marcarFalhaPermanente(
            item.id,
            mensagemParaOProfessor(resposta, item.tipo),
          );
          permanentes += 1;
          // Falha permanente não interrompe: o próximo item pode não depender
          // deste, e travar a fila inteira por um registro recusado deixaria
          // chamadas válidas presas indefinidamente.
          continue;
        }

        await this.outbox.adiar(
          item.id,
          mensagemParaOProfessor(resposta, item.tipo),
          agora,
        );
        this.agendarRetentativa(item.tentativas + 1);
        adiados += 1;
        motivo = 'falha-transitoria';
        break;
      }
    } finally {
      this.rodando = false;
      await this.notificar();
    }

    return {
      enviados,
      adiados,
      falhasPermanentes: permanentes,
      interrompidaPor: motivo,
    };
  }

  observar(ouvinte: (estado: EstadoDeSincronizacao) => void): () => void {
    this.ouvintes.add(ouvinte);
    void this.estado().then(ouvinte);

    // A fila também muda FORA das rodadas: toda confirmação de chamada
    // enfileira itens. Sem escutar isso, o indicador só se atualizaria
    // quando uma sincronização rodasse — e offline ela não roda, que é
    // exatamente quando o professor precisa ver que ficou salvo.
    const pararDeEscutarFila = observarFila(() => {
      void this.notificar();
    });

    const pararDeEscutarRede = this.conectividade.observar(() => {
      void this.notificar();
    });

    return () => {
      this.ouvintes.delete(ouvinte);
      pararDeEscutarFila();
      pararDeEscutarRede();
    };
  }

  private async notificar(): Promise<void> {
    if (this.ouvintes.size === 0) return;
    const estado = await this.estado();
    for (const ouvinte of this.ouvintes) ouvinte(estado);
  }

  private agendarRetentativa(tentativa: number): void {
    if (!this.iniciada) return;
    if (this.retentativa !== null) clearTimeout(this.retentativa);
    this.retentativa = setTimeout(() => {
      this.retentativa = null;
      if (this.conectividade.online) void this.sincronizarAgora();
    }, esperaParaTentativa(tentativa));
  }
}
