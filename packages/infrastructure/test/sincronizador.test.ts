import './setup.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BancoLocal, type ItemDaFila } from '../src/local/db.js';
import { Outbox } from '../src/local/outbox.js';
import { SincronizadorOutbox, type EnvioRemoto } from '../src/sync/sincronizador.js';
import {
  MonitorDeConectividade,
  type SondaDeRede,
} from '../src/sync/conectividade.js';
import {
  TENTATIVAS_ATE_DEPENDENCIA_DESISTIR,
  type RespostaDoServidor,
} from '../src/sync/classificacao.js';

class SondaFixa implements SondaDeRede {
  constructor(public online = true) {}
  async verificar(): Promise<boolean> {
    return this.online;
  }
}

/** Fila de respostas programadas, uma por envio, na ordem. */
class RemotoProgramado implements EnvioRemoto {
  readonly recebidos: ItemDaFila[] = [];
  constructor(private respostas: RespostaDoServidor[]) {}
  async enviar(item: ItemDaFila): Promise<RespostaDoServidor> {
    this.recebidos.push(item);
    return this.respostas.shift() ?? { status: 201 };
  }
}

const AGORA = new Date('2026-10-04T19:00:00Z');

let db: BancoLocal;
let outbox: Outbox;
let contador = 0;

function id(): string {
  contador += 1;
  return `0193${String(contador).padStart(4, '0')}-0000-7000-8000-000000000000`;
}

async function enfileirarTres(): Promise<[string, string, string]> {
  const a = id();
  const b = id();
  const c = id();
  const itemA = await outbox.enfileirar(
    a,
    'criar_aluno',
    { id: a },
    AGORA.toISOString(),
  );
  const itemB = await outbox.enfileirar(
    b,
    'criar_chamada',
    { id: b },
    AGORA.toISOString(),
  );
  const itemC = await outbox.enfileirar(
    c,
    'criar_presenca',
    { id: c },
    AGORA.toISOString(),
  );
  return [itemA, itemB, itemC];
}

/**
 * Instâncias criadas no teste corrente, para desligar no fim.
 *
 * `observarFila` guarda os ouvintes num Set de MÓDULO, que sobrevive ao fim
 * do teste: sem desligar, o sincronizador de um teste anterior continua
 * reagindo à fila do seguinte e disputa com ele o bloqueio entre abas. É o
 * mesmo vazamento que `parar()` corrige em produção.
 */
const criados: SincronizadorOutbox[] = [];

function montar(respostas: RespostaDoServidor[], online = true) {
  const remoto = new RemotoProgramado(respostas);
  const monitor = new MonitorDeConectividade(new SondaFixa(online));
  const sinc = new SincronizadorOutbox(remoto, monitor, db);
  criados.push(sinc);
  return { remoto, monitor, sinc };
}

beforeEach(() => {
  contador = 0;
  db = new BancoLocal(`sinc-${Math.random()}`);
  outbox = new Outbox(db);
});

afterEach(() => {
  for (const sinc of criados.splice(0)) sinc.parar();
});

describe('SincronizadorOutbox', () => {
  describe('rodada feliz', () => {
    it('envia todos os itens em ordem e esvazia a fila', async () => {
      const [a, b, c] = await enfileirarTres();
      const { remoto, sinc } = montar([{ status: 201 }, { status: 201 }, { status: 201 }]);

      const resultado = await sinc.rodada(AGORA);

      expect(resultado.enviados).toBe(3);
      expect(resultado.interrompidaPor).toBe('fila-vazia');
      expect(remoto.recebidos.map((i) => i.id)).toEqual([a, b, c]);
      expect(await outbox.pendentes()).toBe(0);
    });

    it('fila vazia não faz nada', async () => {
      const { remoto, sinc } = montar([]);
      const resultado = await sinc.rodada(AGORA);
      expect(resultado.enviados).toBe(0);
      expect(remoto.recebidos).toHaveLength(0);
    });
  });

  describe('interrupção na falha transitória', () => {
    it('para no primeiro transitório e NÃO envia os seguintes', async () => {
      // Continuar enviaria uma presença antes da chamada a que pertence,
      // produzindo violação de chave estrangeira no servidor.
      const [a] = await enfileirarTres();
      const { remoto, sinc } = montar([{ status: 201 }, { status: 503 }]);

      const resultado = await sinc.rodada(AGORA);

      expect(resultado.enviados).toBe(1);
      expect(resultado.adiados).toBe(1);
      expect(resultado.interrompidaPor).toBe('falha-transitoria');
      expect(remoto.recebidos).toHaveLength(2);
      expect(remoto.recebidos[0]!.id).toBe(a);
    });

    it('o item adiado volta à fila e retoma na rodada seguinte', async () => {
      await enfileirarTres();
      const { sinc } = montar([
        { status: 201 },
        { status: 503 },
        // segunda rodada
        { status: 201 },
        { status: 201 },
      ]);

      await sinc.rodada(AGORA);
      expect(await outbox.pendentes()).toBe(2);

      // Depois da espera exponencial.
      const depois = new Date(AGORA.getTime() + 60_000);
      const segunda = await sinc.rodada(depois);

      expect(segunda.enviados).toBe(2);
      expect(await outbox.pendentes()).toBe(0);
    });

    it('a ordem é preservada ao retomar', async () => {
      const [, b, c] = await enfileirarTres();
      const { remoto, sinc } = montar([
        { status: 201 },
        { status: 0 },
        { status: 201 },
        { status: 201 },
      ]);

      await sinc.rodada(AGORA);
      await sinc.rodada(new Date(AGORA.getTime() + 60_000));

      const ordemFinal = remoto.recebidos.slice(1).map((i) => i.id);
      expect(ordemFinal).toEqual([b, b, c]);
    });

    it('preserva uma exclusão e a conclui na tentativa seguinte', async () => {
      const alunoId = id();
      const operacao = await outbox.enfileirar(
        alunoId,
        'excluir_aluno',
        { id: alunoId },
        AGORA.toISOString(),
      );
      const { remoto, sinc } = montar([{ status: 503 }, { status: 204 }]);

      await sinc.rodada(AGORA);

      expect(await db.outbox.get(operacao)).toMatchObject({
        estado: 'pendente',
        tentativas: 1,
      });

      await sinc.rodada(new Date(AGORA.getTime() + 60_000));

      expect(await db.outbox.get(operacao)).toBeUndefined();
      expect(remoto.recebidos.map((item) => item.tipo)).toEqual([
        'excluir_aluno',
        'excluir_aluno',
      ]);
    });

    it('a dependência que nunca chega para de travar a fila', async () => {
      // O item do qual este depende foi recusado em definitivo, então ele
      // responderá 23503 para sempre. Como `prontos()` corta a fila no
      // primeiro item em espera, insistir deixaria TUDO atrás dele sem nunca
      // subir, e a tela só diria "aguardando envio".
      const [a, b, c] = await enfileirarTres();
      await db.outbox.update(a, {
        tentativas: TENTATIVAS_ATE_DEPENDENCIA_DESISTIR,
      });
      const { remoto, sinc } = montar([{ status: 409, codigo: '23503' }]);

      const resultado = await sinc.rodada(AGORA);

      expect(await db.outbox.get(a)).toMatchObject({
        estado: 'falha_permanente',
      });
      expect(resultado.falhasPermanentes).toBe(1);
      // A fila retomou do item seguinte, na mesma rodada.
      expect(remoto.recebidos.map((item) => item.id)).toEqual([a, b, c]);
    });
  });

  describe('falha permanente', () => {
    it('não interrompe a fila', async () => {
      // Travar a fila inteira por um registro recusado deixaria chamadas
      // válidas presas indefinidamente.
      await enfileirarTres();
      const { sinc } = montar([
        { status: 201 },
        { status: 409, codigo: '23505', constraint: 'chamada_unica_por_turma_e_data' },
        { status: 201 },
      ]);

      const resultado = await sinc.rodada(AGORA);

      expect(resultado.enviados).toBe(2);
      expect(resultado.falhasPermanentes).toBe(1);
      expect(resultado.interrompidaPor).toBe('fila-vazia');
    });

    it('o item falho fica visível com mensagem legível', async () => {
      const [, b] = await enfileirarTres();
      const { sinc } = montar([
        { status: 201 },
        { status: 409, codigo: '23505', constraint: 'chamada_unica_por_turma_e_data' },
        { status: 201 },
      ]);

      await sinc.rodada(AGORA);

      const falhas = await outbox.falhasPermanentes();
      expect(falhas).toHaveLength(1);
      expect(falhas[0]!.id).toBe(b);
      expect(falhas[0]!.erro).toBe(
        'Já existe uma chamada registrada para esta turma neste dia.',
      );
    });
  });

  describe('duas abas sobre a mesma fila', () => {
    // Duas abas são duas instâncias sobre o MESMO banco — é literalmente isto.
    // O bloqueio `rodando` vive na memória de cada instância e não enxerga a
    // outra, então nada impede as duas de buscarem o mesmo item.

    it('o mesmo item não é enviado duas vezes', async () => {
      const a = id();
      await outbox.enfileirar(a, 'criar_chamada', { id: a }, AGORA.toISOString());

      const aba1 = montar([{ status: 201 }]);
      const aba2 = montar([
        // Se o item escapar para a segunda aba, o servidor responde conflito
        // de chave primária: "você já me mandou isso".
        { status: 409, codigo: '23505', constraint: 'chamada_pkey' },
      ]);

      await Promise.all([aba1.sinc.rodada(AGORA), aba2.sinc.rodada(AGORA)]);

      const enviados =
        aba1.remoto.recebidos.length + aba2.remoto.recebidos.length;
      expect(enviados).toBe(1);
      expect(await db.outbox.count()).toBe(0);
    });

    it('mesmo escapando, a idempotência impede a duplicata', async () => {
      // Segunda linha de defesa, exercitada sozinha: as duas abas pegam o
      // item antes de qualquer uma marcar o envio. O registro do professor
      // sai da fila uma vez só e nada é perdido.
      const a = id();
      await outbox.enfileirar(a, 'criar_chamada', { id: a }, AGORA.toISOString());

      const aba1 = montar([{ status: 201 }]);
      const aba2 = montar([
        { status: 409, codigo: '23505', constraint: 'chamada_pkey' },
      ]);

      const [itens1, itens2] = await Promise.all([
        aba1.sinc['outbox'].prontos(AGORA),
        aba2.sinc['outbox'].prontos(AGORA),
      ]);
      expect(itens1).toHaveLength(1);
      expect(itens2).toHaveLength(1);

      await Promise.all([aba1.sinc.rodada(AGORA), aba2.sinc.rodada(AGORA)]);

      expect(await db.outbox.count()).toBe(0);
    });
  });

  describe('idempotência do servidor', () => {
    it('409 em chave primária é tratado como sucesso', async () => {
      const [a] = await enfileirarTres();
      const { sinc } = montar([
        { status: 409, codigo: '23505', constraint: 'chamada_pkey' },
        { status: 201 },
        { status: 201 },
      ]);

      const resultado = await sinc.rodada(AGORA);

      expect(resultado.enviados).toBe(3);
      expect(await db.outbox.get(a)).toBeUndefined();
    });

    it('presença já existente no servidor é sucesso', async () => {
      await enfileirarTres();
      const { sinc } = montar([
        { status: 201 },
        { status: 201 },
        {
          status: 409,
          codigo: '23505',
          constraint: 'presenca_unica_por_chamada_e_aluno',
        },
      ]);

      const resultado = await sinc.rodada(AGORA);
      expect(resultado.enviados).toBe(3);
      expect(resultado.falhasPermanentes).toBe(0);
    });
  });

  describe('sessão expirada', () => {
    it('é transitória e a fila permanece intacta', async () => {
      // EC-12: nunca descartar pendência por falta de sessão.
      const [a] = await enfileirarTres();
      const { sinc } = montar([{ status: 401 }]);

      const resultado = await sinc.rodada(AGORA);

      expect(resultado.enviados).toBe(0);
      expect(resultado.interrompidaPor).toBe('falha-transitoria');
      expect(await db.outbox.get(a)).toBeDefined();
      expect(await outbox.pendentes()).toBe(3);
    });
  });

  describe('conectividade', () => {
    it('erro de validação local não altera o estado da rede', async () => {
      const alunoId = id();
      await outbox.enfileirar(
        alunoId,
        'excluir_aluno',
        {},
        AGORA.toISOString(),
      );
      const { monitor, sinc } = montar([
        { status: 422, codigo: 'PAYLOAD_INVALIDO' },
      ]);
      monitor.registrarResultado(false);

      await sinc.rodada(AGORA);

      expect(monitor.online).toBe(false);
      expect(await outbox.falhasPermanentes()).toHaveLength(1);
    });

    it('parado, não processa mais a fila', async () => {
      // `observarFila` guarda os ouvintes em um Set de MÓDULO. Sem
      // desinscrever, o sincronizador da sessão anterior continua vivo e
      // processa o outbox do próximo operador em paralelo com o novo — duas
      // rodadas sobre a mesma fila, que o bloqueio em memória não cobre.
      const { remoto, sinc } = montar([]);
      await sinc.iniciar();
      sinc.parar();

      const a = id();
      await outbox.enfileirar(a, 'criar_chamada', {}, AGORA.toISOString());
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(remoto.recebidos).toHaveLength(0);
      expect(await outbox.pendentes()).toBe(1);
    });

    it('envia um item criado enquanto já está online', async () => {
      const { remoto, sinc } = montar([{ status: 201 }]);
      await sinc.iniciar();

      const alunoId = id();
      await outbox.enfileirar(
        alunoId,
        'criar_aluno',
        { id: alunoId },
        AGORA.toISOString(),
      );

      await vi.waitFor(() => expect(remoto.recebidos).toHaveLength(1));
      expect(await outbox.pendentes()).toBe(0);
    });

    it('retenta automaticamente depois da espera', async () => {
      const { remoto, sinc } = montar([{ status: 503 }, { status: 201 }]);
      await sinc.iniciar();

      const alunoId = id();
      await outbox.enfileirar(
        alunoId,
        'criar_aluno',
        { id: alunoId },
        new Date().toISOString(),
      );

      await vi.waitFor(() => expect(remoto.recebidos).toHaveLength(1));
      await vi.waitFor(
        () => expect(remoto.recebidos).toHaveLength(2),
        { timeout: 3_000 },
      );
      expect(await outbox.pendentes()).toBe(0);
    });

    it('resposta do servidor prova que há internet real', async () => {
      // navigator.onLine mente em portal cativo. A verdade é o resultado.
      await enfileirarTres();
      const { monitor, sinc } = montar([{ status: 503 }]);
      monitor.registrarResultado(false);
      expect(monitor.online).toBe(false);

      await sinc.rodada(AGORA);

      // 503 é resposta: houve internet, o servidor é que está mal.
      expect(monitor.online).toBe(true);
    });

    it('requisição que não sai marca offline', async () => {
      await enfileirarTres();
      const { monitor, sinc } = montar([{ status: 0, mensagem: 'falha de rede' }]);

      await sinc.rodada(AGORA);

      expect(monitor.online).toBe(false);
    });
  });

  describe('estado exposto à interface', () => {
    it('informa falha permanente sem deixar pendência', async () => {
      // Falha permanente NÃO interrompe a fila, então os três itens são
      // processados e nada fica pendente.
      await enfileirarTres();
      const { sinc } = montar([
        { status: 201 },
        { status: 400 },
        { status: 201 },
      ]);

      await sinc.rodada(AGORA);
      const estado = await sinc.estado();

      expect(estado.pendentes).toBe(0);
      expect(estado.falhasPermanentes).toBe(1);
      expect(estado.sincronizando).toBe(false);
    });

    it('informa pendência quando a rodada é interrompida', async () => {
      // Transitório interrompe: o item que falhou e o seguinte ficam.
      await enfileirarTres();
      const { sinc } = montar([{ status: 201 }, { status: 503 }]);

      await sinc.rodada(AGORA);
      const estado = await sinc.estado();

      expect(estado.pendentes).toBe(2);
      expect(estado.falhasPermanentes).toBe(0);
    });

    it('notifica os observadores', async () => {
      await enfileirarTres();
      const { sinc } = montar([{ status: 201 }, { status: 201 }, { status: 201 }]);

      const vistos: number[] = [];
      sinc.observar((e) => vistos.push(e.pendentes));

      await sinc.rodada(AGORA);

      expect(vistos.length).toBeGreaterThan(0);
      expect(vistos.at(-1)).toBe(0);
    });
  });

  describe('destravamento na inicialização', () => {
    it('itens presos em "enviando" voltam à fila', async () => {
      // Encerramento abrupto do app deixaria a chamada travada para sempre.
      const [a] = await enfileirarTres();
      await outbox.marcarEnviando(a);

      const { sinc } = montar([{ status: 201 }, { status: 201 }, { status: 201 }]);
      await outbox.destravar();
      const resultado = await sinc.rodada(AGORA);

      expect(resultado.enviados).toBe(3);
    });
  });
});
