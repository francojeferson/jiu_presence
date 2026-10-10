/**
 * Outbox: o único caminho de escrita do sistema (RN-08, D-05).
 *
 * Toda escrita passa por aqui, INCLUSIVE quando há rede. Dois caminhos de
 * escrita significariam duas semânticas, e a segunda só seria exercida
 * offline — ou seja, a menos testada, justamente no cenário crítico.
 */

import {
  bancoLocal,
  CONTADOR_DE_ORDEM,
  type EstadoDoItem,
  type ItemDaFila,
  type TipoDeOperacao,
} from './db.js';

/**
 * Espera entre tentativas, em milissegundos.
 *
 * Sem limite máximo de tentativas para falhas transitórias: o dispositivo pode
 * ficar dias offline, e abandonar um item por contagem significaria perder uma
 * chamada que o professor já deu por registrada.
 */
export const ESPERAS_MS = [0, 2_000, 8_000, 30_000, 120_000] as const;
export const ESPERA_MAXIMA_MS = 600_000;

export function esperaParaTentativa(tentativa: number): number {
  return ESPERAS_MS[tentativa] ?? ESPERA_MAXIMA_MS;
}

/**
 * Avisa quem observa que a fila mudou.
 *
 * Existe porque sem isso o indicador de pendências só se atualizava durante
 * uma rodada de sincronização. O professor confirmava a chamada offline e
 * nada na tela dizia que ficou salvo — justamente a tranquilidade que o
 * RF-29 deve dar no momento em que ele mais precisa dela.
 *
 * Módulo-level e não por instância: `Outbox` é criado em vários pontos
 * (repositórios, sincronizador, tela de pendências) sobre o mesmo banco.
 */
export type MudancaNaFila = 'enfileiramento' | 'estado';

const ouvintesDaFila = new Set<(mudanca: MudancaNaFila) => void>();

export function observarFila(
  ouvinte: (mudanca: MudancaNaFila) => void,
): () => void {
  ouvintesDaFila.add(ouvinte);
  return () => ouvintesDaFila.delete(ouvinte);
}

function filaMudou(mudanca: MudancaNaFila): void {
  for (const ouvinte of ouvintesDaFila) ouvinte(mudanca);
}

export class Outbox {
  constructor(private readonly db = bancoLocal()) {}

  /**
   * Enfileira uma operação.
   *
   * @param chaveDeIdempotencia identificador estável do fato remoto.
   * @param criadoEm data real do evento. Para uma chamada, é o instante da
   *                 aula, não o do envio.
   */
  async enfileirar(
    chaveDeIdempotencia: string,
    tipo: TipoDeOperacao,
    payload: unknown,
    criadoEm: string,
  ): Promise<string> {
    const ordem = await this.proximaOrdem();
    const id = globalThis.crypto.randomUUID();
    await this.db.outbox.put({
      id,
      chaveDeIdempotencia,
      tipo,
      payload,
      criadoEm,
      ordem,
      tentativas: 0,
      proximaTentativaEm: null,
      estado: 'pendente',
      erro: null,
    });
    filaMudou('enfileiramento');
    return id;
  }

  /**
   * Próximo sequencial.
   *
   * Monotônico e independente do relógio, porque alterar a hora do
   * dispositivo não pode reordenar a fila (EC-06).
   *
   * Vem de um contador PERSISTENTE, não do maior `ordem` ainda na fila:
   * derivar das linhas restantes faz o contador reiniciar quando a fila
   * esvazia, e um item criado depois receberia ordem menor que a de um
   * pendente remanescente.
   */
  private async proximaOrdem(): Promise<number> {
    return this.db.proximoValorDe(CONTADOR_DE_ORDEM);
  }

  /** Itens prontos para envio, na ordem de criação (RF-25). */
  async prontos(agora: Date = new Date()): Promise<ItemDaFila[]> {
    const todos = await this.db.outbox
      .where('estado')
      .equals('pendente' satisfies EstadoDoItem)
      .toArray();

    const ordenados = todos.sort((a, b) => a.ordem - b.ordem);
    const primeiroAindaEmEspera = ordenados.findIndex(
      (i) =>
        i.proximaTentativaEm !== null &&
        Date.parse(i.proximaTentativaEm) > agora.getTime(),
    );
    return primeiroAindaEmEspera < 0
      ? ordenados
      : ordenados.slice(0, primeiroAindaEmEspera);
  }

  async pendentes(): Promise<number> {
    return this.db.outbox.where('estado').notEqual('falha_permanente').count();
  }

  async falhasPermanentes(): Promise<ItemDaFila[]> {
    return this.db.outbox
      .where('estado')
      .equals('falha_permanente' satisfies EstadoDoItem)
      .toArray();
  }

  async marcarEnviando(id: string): Promise<void> {
    await this.db.outbox.update(id, { estado: 'enviando' });
  }

  /** Sucesso: o item sai da fila. Também cobre o sucesso idempotente. */
  async concluir(id: string): Promise<void> {
    await this.db.outbox.delete(id);
    filaMudou('estado');
  }

  /** Transitório: volta à fila com espera crescente. Nunca é descartado. */
  async adiar(id: string, erro: string, agora: Date = new Date()): Promise<void> {
    const item = await this.db.outbox.get(id);
    if (!item) return;
    const tentativas = item.tentativas + 1;
    await this.db.outbox.update(id, {
      estado: 'pendente',
      tentativas,
      erro,
      proximaTentativaEm: new Date(
        agora.getTime() + esperaParaTentativa(tentativas),
      ).toISOString(),
    });
    filaMudou('estado');
  }

  /**
   * Permanente: sai da fila ativa, vai para a lista de falhas.
   * Nunca descartado em silêncio — exige decisão do professor (RF-11).
   */
  async marcarFalhaPermanente(id: string, erro: string): Promise<void> {
    await this.db.outbox.update(id, {
      estado: 'falha_permanente',
      erro,
      proximaTentativaEm: null,
    });
    filaMudou('estado');
  }

  /** Recoloca um item que havia falhado permanentemente, por decisão do usuário. */
  async reativar(id: string): Promise<void> {
    await this.db.outbox.update(id, {
      estado: 'pendente',
      tentativas: 0,
      erro: null,
      proximaTentativaEm: null,
    });
    filaMudou('estado');
  }

  /**
   * Há algum item em voo?
   *
   * EC-08: bloqueio contra processamento concorrente entre a sincronização
   * automática e a manual. A chave de idempotência é a segunda linha de
   * defesa, não a primeira.
   */
  async temItemEmVoo(): Promise<boolean> {
    const emVoo = await this.db.outbox
      .where('estado')
      .equals('enviando' satisfies EstadoDoItem)
      .count();
    return emVoo > 0;
  }

  /**
   * Destrava itens que ficaram em 'enviando' por encerramento abrupto do app.
   * Chamado na inicialização.
   */
  async destravar(): Promise<number> {
    const travados = await this.db.outbox
      .where('estado')
      .equals('enviando' satisfies EstadoDoItem)
      .toArray();
    for (const item of travados) {
      await this.db.outbox.update(item.id, { estado: 'pendente' });
    }
    if (travados.length > 0) filaMudou('estado');
    return travados.length;
  }
}
