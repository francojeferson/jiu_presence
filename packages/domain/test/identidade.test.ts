import { describe, expect, it } from 'vitest';
import {
  comoId,
  ehId,
  instanteDoId,
  novoId,
} from '../src/valor/identidade.js';

describe('identidade (UUID v7)', () => {
  it('gera identificadores em formato UUID válido', () => {
    const id = novoId();
    expect(ehId(id)).toBe(true);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('marca a versão 7 e a variante RFC 4122', () => {
    const id = novoId();
    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('gera identificadores únicos', () => {
    const quantidade = 5_000;
    const gerados = new Set(
      Array.from({ length: quantidade }, () => novoId()),
    );
    expect(gerados.size).toBe(quantidade);
  });

  it('é ordenável por tempo na ordem lexicográfica', () => {
    // Propriedade da qual o outbox depende: a ordem dos ids coincide com a
    // ordem de criação.
    const antigo = novoId(1_000_000_000_000);
    const recente = novoId(1_700_000_000_000);
    expect(antigo < recente).toBe(true);
  });

  it('preserva o instante de criação no próprio identificador', () => {
    const instante = 1_767_225_600_000;
    expect(instanteDoId(novoId(instante))).toBe(instante);
  });

  it('mantém a ordem ao longo de muitos instantes crescentes', () => {
    const ids = Array.from({ length: 200 }, (_, i) =>
      novoId(1_700_000_000_000 + i * 1000),
    );
    const ordenados = [...ids].sort();
    expect(ordenados).toEqual(ids);
  });

  describe('comoId', () => {
    it('aceita um UUID bem formado vindo de fora', () => {
      const texto = novoId() as string;
      expect(comoId(texto)).toBe(texto);
    });

    it('recusa string que não é UUID', () => {
      expect(() => comoId('123')).toThrow(/formato inválido/);
      expect(() => comoId('')).toThrow();
    });
  });

  describe('ehId', () => {
    it('recusa valores que não são string', () => {
      expect(ehId(42)).toBe(false);
      expect(ehId(null)).toBe(false);
      expect(ehId(undefined)).toBe(false);
      expect(ehId({})).toBe(false);
    });
  });
});
