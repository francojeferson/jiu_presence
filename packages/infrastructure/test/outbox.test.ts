import { beforeEach, describe, expect, it } from 'vitest';
import { BancoLocal, definirBancoLocal } from '../src/local/db.js';
import { Outbox, esperaParaTentativa, ESPERA_MAXIMA_MS } from '../src/local/outbox.js';

let db: BancoLocal;
let outbox: Outbox;
let contador = 0;

function id(): string {
  contador += 1;
  return `0193${String(contador).padStart(4, '0')}-0000-7000-8000-000000000000`;
}

beforeEach(async () => {
  contador = 0;
  db = new BancoLocal(`teste-${Math.random()}`);
  definirBancoLocal(db);
  outbox = new Outbox(db);
});

describe('Outbox', () => {
  describe('ordenação (RF-25)', () => {
    it('entrega os itens na ordem de criação', async () => {
      const a = id();
      const b = id();
      const c = id();
      await outbox.enfileirar(a, 'criar_aluno', {}, '2026-10-04T10:00:00Z');
      await outbox.enfileirar(b, 'criar_chamada', {}, '2026-10-04T10:00:01Z');
      await outbox.enfileirar(c, 'criar_presenca', {}, '2026-10-04T10:00:02Z');

      const prontos = await outbox.prontos();
      expect(prontos.map((i) => i.id)).toEqual([a, b, c]);
    });

    it('a ordem não depende do relógio do dispositivo', async () => {
      // EC-06: alterar a hora do dispositivo, manualmente ou por NTP, não
      // pode embaralhar a fila. O sequencial é monotônico e independente.
      const primeiro = id();
      const segundo = id();
      await outbox.enfileirar(primeiro, 'criar_aluno', {}, '2030-01-01T00:00:00Z');
      await outbox.enfileirar(segundo, 'criar_chamada', {}, '2020-01-01T00:00:00Z');

      const prontos = await outbox.prontos();
      expect(prontos.map((i) => i.id)).toEqual([primeiro, segundo]);
    });

    it('o sequencial continua crescendo após remoções', async () => {
      const a = id();
      await outbox.enfileirar(a, 'criar_aluno', {}, '2026-10-04T10:00:00Z');
      await outbox.concluir(a);

      const b = id();
      await outbox.enfileirar(b, 'criar_chamada', {}, '2026-10-04T10:00:01Z');
      const prontos = await outbox.prontos();
      expect(prontos[0]!.ordem).toBeGreaterThan(1);
    });
  });

  describe('preservação da data do evento (RF-31)', () => {
    it('guarda a data da AULA, não a do envio', async () => {
      const a = id();
      const dataDaAula = '2026-09-28T19:00:00Z';
      await outbox.enfileirar(a, 'criar_chamada', {}, dataDaAula);

      const prontos = await outbox.prontos();
      expect(prontos[0]!.criadoEm).toBe(dataDaAula);
    });
  });

  describe('durabilidade', () => {
    it('a fila sobrevive à reabertura do banco', async () => {
      // RF-24: fechar o app e reiniciar o dispositivo preserva a fila.
      const a = id();
      await outbox.enfileirar(a, 'criar_chamada', { x: 1 }, '2026-10-04T10:00:00Z');
      const nome = db.name;
      db.close();

      const reaberto = new BancoLocal(nome);
      const outboxReaberto = new Outbox(reaberto);
      const prontos = await outboxReaberto.prontos();

      expect(prontos).toHaveLength(1);
      expect(prontos[0]!.id).toBe(a);
      expect(prontos[0]!.payload).toEqual({ x: 1 });
    });
  });

  describe('falha transitória', () => {
    it('mantém o item na fila e agenda nova tentativa', async () => {
      const a = id();
      const agora = new Date('2026-10-04T10:00:00Z');
      await outbox.enfileirar(a, 'criar_chamada', {}, agora.toISOString());
      await outbox.marcarEnviando(a);
      await outbox.adiar(a, 'timeout', agora);

      const todos = await db.outbox.toArray();
      expect(todos).toHaveLength(1);
      expect(todos[0]!.estado).toBe('pendente');
      expect(todos[0]!.tentativas).toBe(1);
      expect(todos[0]!.proximaTentativaEm).not.toBeNull();
    });

    it('o item adiado não é entregue antes da hora', async () => {
      const a = id();
      const agora = new Date('2026-10-04T10:00:00Z');
      await outbox.enfileirar(a, 'criar_chamada', {}, agora.toISOString());
      await outbox.adiar(a, 'timeout', agora);

      expect(await outbox.prontos(agora)).toHaveLength(0);

      const depois = new Date(agora.getTime() + 10_000);
      expect(await outbox.prontos(depois)).toHaveLength(1);
    });

    it('a espera cresce a cada tentativa até um teto', async () => {
      expect(esperaParaTentativa(0)).toBe(0);
      expect(esperaParaTentativa(1)).toBe(2_000);
      expect(esperaParaTentativa(2)).toBe(8_000);
      expect(esperaParaTentativa(3)).toBe(30_000);
      expect(esperaParaTentativa(4)).toBe(120_000);
      expect(esperaParaTentativa(5)).toBe(ESPERA_MAXIMA_MS);
      expect(esperaParaTentativa(99)).toBe(ESPERA_MAXIMA_MS);
    });

    it('nunca abandona o item por contagem de tentativas', async () => {
      // O dispositivo pode ficar dias offline. Abandonar por contagem
      // significaria perder uma chamada que o professor deu por registrada.
      const a = id();
      const agora = new Date('2026-10-04T10:00:00Z');
      await outbox.enfileirar(a, 'criar_chamada', {}, agora.toISOString());

      for (let i = 0; i < 100; i += 1) {
        await outbox.adiar(a, 'rede indisponível', agora);
      }

      const item = await db.outbox.get(a);
      expect(item).toBeDefined();
      expect(item!.estado).toBe('pendente');
      expect(item!.tentativas).toBe(100);
    });
  });

  describe('falha permanente', () => {
    it('sai da fila ativa mas não é descartada', async () => {
      // RF-11: falha permanente é visível, explicada e acionável.
      const a = id();
      await outbox.enfileirar(a, 'criar_chamada', {}, '2026-10-04T10:00:00Z');
      await outbox.marcarFalhaPermanente(a, 'Já existe chamada para esta data.');

      expect(await outbox.prontos()).toHaveLength(0);

      const falhas = await outbox.falhasPermanentes();
      expect(falhas).toHaveLength(1);
      expect(falhas[0]!.erro).toBe('Já existe chamada para esta data.');
    });

    it('pode ser reativada por decisão do usuário', async () => {
      const a = id();
      await outbox.enfileirar(a, 'criar_chamada', {}, '2026-10-04T10:00:00Z');
      await outbox.marcarFalhaPermanente(a, 'erro');
      await outbox.reativar(a);

      expect(await outbox.prontos()).toHaveLength(1);
      expect(await outbox.falhasPermanentes()).toHaveLength(0);
    });

    it('não entra na contagem de pendentes', async () => {
      const a = id();
      const b = id();
      await outbox.enfileirar(a, 'criar_chamada', {}, '2026-10-04T10:00:00Z');
      await outbox.enfileirar(b, 'criar_presenca', {}, '2026-10-04T10:00:01Z');
      await outbox.marcarFalhaPermanente(a, 'erro');

      expect(await outbox.pendentes()).toBe(1);
    });
  });

  describe('concorrência (EC-08)', () => {
    it('detecta item em voo', async () => {
      const a = id();
      await outbox.enfileirar(a, 'criar_chamada', {}, '2026-10-04T10:00:00Z');
      expect(await outbox.temItemEmVoo()).toBe(false);
      await outbox.marcarEnviando(a);
      expect(await outbox.temItemEmVoo()).toBe(true);
    });

    it('item em voo não é entregue de novo', async () => {
      const a = id();
      await outbox.enfileirar(a, 'criar_chamada', {}, '2026-10-04T10:00:00Z');
      await outbox.marcarEnviando(a);
      expect(await outbox.prontos()).toHaveLength(0);
    });

    it('destrava itens presos por encerramento abrupto do app', async () => {
      const a = id();
      await outbox.enfileirar(a, 'criar_chamada', {}, '2026-10-04T10:00:00Z');
      await outbox.marcarEnviando(a);

      expect(await outbox.destravar()).toBe(1);
      expect(await outbox.prontos()).toHaveLength(1);
    });
  });

  describe('idempotência', () => {
    it('enfileirar o mesmo id duas vezes não duplica', async () => {
      const a = id();
      await outbox.enfileirar(a, 'criar_chamada', { v: 1 }, '2026-10-04T10:00:00Z');
      await outbox.enfileirar(a, 'criar_chamada', { v: 2 }, '2026-10-04T10:00:00Z');

      const todos = await db.outbox.toArray();
      expect(todos).toHaveLength(1);
    });

    it('concluir remove o item', async () => {
      const a = id();
      await outbox.enfileirar(a, 'criar_chamada', {}, '2026-10-04T10:00:00Z');
      await outbox.concluir(a);
      expect(await db.outbox.count()).toBe(0);
    });

    it('concluir item inexistente não falha', async () => {
      await expect(outbox.concluir(id())).resolves.toBeUndefined();
    });
  });
});
