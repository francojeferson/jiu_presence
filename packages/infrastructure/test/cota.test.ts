/**
 * Cota de armazenamento esgotada (RF-32, EC-05) — item 4 do registro.
 *
 * A regra que não pode ser quebrada: cota crítica IMPEDE a escrita nova e
 * jamais remove item da fila para abrir espaço. Faltava teste porque exige
 * forjar `navigator.storage`, que é o que este arquivo faz.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  ErroDeCotaEsgotada,
  LIMIAR_CRITICO,
  garantirEspacoParaEscrita,
  situacaoDaCota,
  solicitarArmazenamentoPersistente,
} from '../src/local/cota.js';

/** `navigator` é compartilhado entre arquivos de teste; sempre restaurar. */
const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'storage');

function comStorage(storage: unknown): void {
  Object.defineProperty(globalThis.navigator, 'storage', {
    configurable: true,
    value: storage,
  });
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis.navigator, 'storage', original);
  else delete (globalThis.navigator as { storage?: unknown }).storage;
});

describe('situacaoDaCota', () => {
  it('calcula percentual e disponível a partir da estimativa', async () => {
    comStorage({ estimate: () => Promise.resolve({ usage: 250, quota: 1000 }) });

    expect(await situacaoDaCota()).toEqual({
      usadoBytes: 250,
      disponivelBytes: 750,
      percentualUsado: 0.25,
      critica: false,
    });
  });

  it.each([
    [LIMIAR_CRITICO - 0.01, false],
    [LIMIAR_CRITICO, true],
    [LIMIAR_CRITICO + 0.01, true],
  ])('em %f de uso, crítica = %s', async (fracao, esperado) => {
    comStorage({
      estimate: () => Promise.resolve({ usage: Math.round(fracao * 10000), quota: 10000 }),
    });

    expect((await situacaoDaCota())?.critica).toBe(esperado);
  });

  it('devolve nulo quando o navegador não estima', async () => {
    comStorage(undefined);
    expect(await situacaoDaCota()).toBeNull();

    comStorage({});
    expect(await situacaoDaCota()).toBeNull();
  });

  it('devolve nulo com quota zerada, em vez de dividir por zero', async () => {
    // Sem isto o percentual viraria NaN ou Infinity, e `critica` passaria a
    // depender de comparação com NaN — que é sempre falsa, o pior dos dois.
    comStorage({ estimate: () => Promise.resolve({ usage: 10, quota: 0 }) });
    expect(await situacaoDaCota()).toBeNull();

    comStorage({ estimate: () => Promise.resolve({}) });
    expect(await situacaoDaCota()).toBeNull();
  });
});

describe('garantirEspacoParaEscrita', () => {
  it('lança com a situação anexada quando a cota está crítica', async () => {
    comStorage({ estimate: () => Promise.resolve({ usage: 99, quota: 100 }) });

    await expect(garantirEspacoParaEscrita()).rejects.toThrow(ErroDeCotaEsgotada);
    const erro = await garantirEspacoParaEscrita().catch((e: unknown) => e);
    expect((erro as ErroDeCotaEsgotada).codigo).toBe('COTA_ESGOTADA');
    expect((erro as ErroDeCotaEsgotada).situacao.percentualUsado).toBe(0.99);
  });

  it('deixa passar com espaço sobrando', async () => {
    comStorage({ estimate: () => Promise.resolve({ usage: 1, quota: 100 }) });
    await expect(garantirEspacoParaEscrita()).resolves.toBeUndefined();
  });

  it('deixa passar quando não há estimativa: bloquear por falta de informação é pior', async () => {
    comStorage(undefined);
    await expect(garantirEspacoParaEscrita()).resolves.toBeUndefined();
  });
});

describe('solicitarArmazenamentoPersistente', () => {
  it('não repede quando já é persistente', async () => {
    let pediu = false;
    comStorage({
      persisted: () => Promise.resolve(true),
      persist: () => {
        pediu = true;
        return Promise.resolve(true);
      },
    });

    expect(await solicitarArmazenamentoPersistente()).toBe(true);
    expect(pediu).toBe(false);
  });

  it('pede e devolve a resposta do navegador quando ainda não é persistente', async () => {
    comStorage({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(false),
    });

    expect(await solicitarArmazenamentoPersistente()).toBe(false);
  });

  it('devolve falso em vez de quebrar a abertura do app', async () => {
    // É só uma proteção a menos; falhar aqui não pode impedir a chamada.
    comStorage(undefined);
    expect(await solicitarArmazenamentoPersistente()).toBe(false);

    comStorage({
      persisted: () => Promise.reject(new Error('negado')),
      persist: () => Promise.resolve(true),
    });
    expect(await solicitarArmazenamentoPersistente()).toBe(false);
  });
});
