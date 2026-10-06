import { beforeEach, describe, expect, it } from 'vitest';
import { BancoLocal, type ItemDaFila } from '../src/local/db.js';
import { Outbox } from '../src/local/outbox.js';
import { SincronizadorOutbox, type EnvioRemoto } from '../src/sync/sincronizador.js';
import {
  MonitorDeConectividade,
  type SondaDeRede,
} from '../src/sync/conectividade.js';
import type { RespostaDoServidor } from '../src/sync/classificacao.js';

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
  await outbox.enfileirar(a, 'criar_aluno', { id: a }, AGORA.toISOString());
  await outbox.enfileirar(b, 'criar_chamada', { id: b }, AGORA.toISOString());
  await outbox.enfileirar(c, 'criar_presenca', { id: c }, AGORA.toISOString());
  return [a, b, c];
}

function montar(respostas: RespostaDoServidor[], online = true) {
  const remoto = new RemotoProgramado(respostas);
  const monitor = new MonitorDeConectividade(new SondaFixa(online));
  const sinc = new SincronizadorOutbox(remoto, monitor, db);
  return { remoto, monitor, sinc };
}

beforeEach(() => {
  contador = 0;
  db = new BancoLocal(`sinc-${Math.random()}`);
  outbox = new Outbox(db);
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
