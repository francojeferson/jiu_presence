/**
 * A promessa de "nenhum dado pessoal no log" (item 4 do registro de pendências).
 *
 * O que estes testes garantem é a forma do filtro, não a ausência de vazamento
 * em todo caso possível. Em particular: um nome embutido DENTRO de um campo de
 * texto permitido — `{ mensagem: 'duplicate key ... Ana Silva' }` — passa, e
 * nenhum teste aqui o impede. É limite de projeto do filtro, não defeito deste
 * arquivo; está registrado nos riscos residuais.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { log, type Nivel } from '../src/log.js';

/** Captura a linha emitida, já desserializada. */
function capturar(nivel: Nivel, evento: string, dados?: Record<string, unknown>) {
  const metodo = nivel === 'erro' ? 'error' : nivel === 'aviso' ? 'warn' : 'log';
  const espiao = vi.spyOn(console, metodo).mockImplementation(() => undefined);
  log.registrar(nivel, evento, dados);
  expect(espiao).toHaveBeenCalledTimes(1);
  return JSON.parse(espiao.mock.calls[0]?.[0] as string) as {
    ts: string;
    nivel: Nivel;
    evento: string;
    dados?: Record<string, unknown>;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('higienização do log', () => {
  it('apaga os campos pessoais nomeados, preservando o resto da linha', () => {
    const linha = capturar('info', 'aluno-cadastrado', {
      id: 'a1',
      nome: 'Ana Silva',
      data_nascimento: '2014-03-02',
      dataNascimento: '2014-03-02',
      email: 'ana@exemplo.com',
      faixa: 'cinza',
      faixa_atual: 'cinza',
      total: 7,
    });

    expect(linha.dados).toEqual({ id: 'a1', total: 7 });
  });

  it('descarta objetos e listas inteiros, que é o que protege de campo não previsto', () => {
    // A lista de proibidos é frágil por natureza: basta um nome novo escapar.
    // Quem de fato segura o vazamento é o filtro de TIPO — só primitivo passa.
    // Logar o aluno inteiro, sob qualquer nome de campo, não emite nada dele.
    const linha = capturar('info', 'sincronizacao', {
      aluno: { nome: 'Ana Silva', data_nascimento: '2014-03-02' },
      alunos: [{ nome: 'Ana Silva' }],
      sobrenome_de_solteira: { valor: 'Pereira' },
      id: 'a1',
    });

    expect(linha.dados).toEqual({ id: 'a1' });
    expect(JSON.stringify(linha)).not.toContain('Ana');
    expect(JSON.stringify(linha)).not.toContain('Pereira');
  });

  it('preserva identificadores, contagens, booleanos e nulos', () => {
    const linha = capturar('info', 'rodada', {
      id: 'a1',
      pendentes: 0,
      sucesso: true,
      interrompidaPor: null,
    });

    expect(linha.dados).toEqual({
      id: 'a1',
      pendentes: 0,
      sucesso: true,
      interrompidaPor: null,
    });
  });

  it('omite `dados` quando não há dados, em vez de emitir objeto vazio', () => {
    expect(capturar('info', 'app-iniciado')).not.toHaveProperty('dados');
  });

  it('carimba nível, evento e um instante ISO', () => {
    const linha = capturar('aviso', 'cota-critica');

    expect(linha.nivel).toBe('aviso');
    expect(linha.evento).toBe('cota-critica');
    expect(new Date(linha.ts).toISOString()).toBe(linha.ts);
  });

  it.each([
    ['erro', 'error'],
    ['aviso', 'warn'],
    ['info', 'log'],
    ['debug', 'log'],
  ] as const)('nível %s sai pelo console.%s', (nivel, metodo) => {
    const espiao = vi.spyOn(console, metodo).mockImplementation(() => undefined);
    log.registrar(nivel, 'evento');
    expect(espiao).toHaveBeenCalledTimes(1);
  });

  it('os atalhos info/aviso/erro higienizam igual ao registrar', () => {
    for (const nivel of ['info', 'aviso', 'erro'] as const) {
      const metodo = nivel === 'erro' ? 'error' : nivel === 'aviso' ? 'warn' : 'log';
      const espiao = vi.spyOn(console, metodo).mockImplementation(() => undefined);
      log[nivel]('evento', { nome: 'Ana Silva', id: 'a1' });

      const linha = JSON.parse(espiao.mock.calls[0]?.[0] as string) as {
        dados?: Record<string, unknown>;
      };
      expect(linha.dados).toEqual({ id: 'a1' });
      vi.restoreAllMocks();
    }
  });
});
