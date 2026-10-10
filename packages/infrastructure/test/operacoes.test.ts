import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemDaFila } from '../src/local/db.js';
import { OperacoesRemotas } from '../src/supabase/operacoes.js';

describe('OperacoesRemotas', () => {
  it('preserva HTTP 503 e limita a duração da requisição', async () => {
    let sinal: AbortSignal | undefined;
    const resultado = {
      error: {
        code: 'PGRST000',
        message: 'serviço indisponível',
        details: '',
      },
      status: 503,
    };
    const promessa = Promise.resolve(resultado);
    const consulta = Object.assign(promessa, {
      abortSignal(recebido: AbortSignal) {
        sinal = recebido;
        return promessa;
      },
    });
    const cliente = {
      from: () => ({ insert: () => consulta }),
    } as unknown as SupabaseClient;
    const alunoId = crypto.randomUUID();
    const item: ItemDaFila = {
      id: crypto.randomUUID(),
      tipo: 'criar_aluno',
      payload: {
        id: alunoId,
        nome: 'Ana',
        data_nascimento: null,
        escala: 'adulta',
        faixa_atual: 'azul',
        data_ultima_graduacao: null,
        ativo: true,
        criado_em: '2026-10-09T12:00:00Z',
        atualizado_em: '2026-10-09T12:00:00Z',
      },
      criadoEm: '2026-10-09T12:00:00Z',
      ordem: 1,
      tentativas: 0,
      proximaTentativaEm: null,
      estado: 'pendente',
      erro: null,
    };

    const resposta = await new OperacoesRemotas(cliente).enviar(item);

    expect(resposta.status).toBe(503);
    expect(sinal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['excluir_aluno' as const, {}],
    [
      'operacao_desconhecida' as ItemDaFila['tipo'],
      { id: crypto.randomUUID() },
    ],
  ] as const)('recusa %s sem chamar o Supabase', async (tipo, payload) => {
    const from = vi.fn();
    const cliente = { from } as unknown as SupabaseClient;
    const item: ItemDaFila = {
      id: crypto.randomUUID(),
      tipo,
      payload,
      criadoEm: '2026-10-09T12:00:00Z',
      ordem: 1,
      tentativas: 0,
      proximaTentativaEm: null,
      estado: 'pendente',
      erro: null,
    };

    const resposta = await new OperacoesRemotas(cliente).enviar(item);

    expect(resposta).toMatchObject({
      status: 422,
      codigo: 'PAYLOAD_INVALIDO',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ['excluir_aluno', 'aluno'],
    ['excluir_turma', 'turma'],
  ] as const)('envia %s como DELETE idempotente', async (tipo, tabelaEsperada) => {
    let tabelaRecebida: string | undefined;
    let idRecebido: unknown;
    let sinal: AbortSignal | undefined;
    const promessa = Promise.resolve({ error: null, status: 204 });
    const consulta = Object.assign(promessa, {
      abortSignal(recebido: AbortSignal) {
        sinal = recebido;
        return promessa;
      },
    });
    const cliente = {
      from(tabela: string) {
        tabelaRecebida = tabela;
        return {
          delete: () => ({
            eq(campo: string, id: unknown) {
              expect(campo).toBe('id');
              idRecebido = id;
              return consulta;
            },
          }),
        };
      },
    } as unknown as SupabaseClient;
    const id = crypto.randomUUID();
    const item: ItemDaFila = {
      id: crypto.randomUUID(),
      tipo,
      payload: { id },
      criadoEm: '2026-10-09T12:00:00Z',
      ordem: 1,
      tentativas: 0,
      proximaTentativaEm: null,
      estado: 'pendente',
      erro: null,
    };

    const resposta = await new OperacoesRemotas(cliente).enviar(item);

    expect(resposta.status).toBe(204);
    expect(tabelaRecebida).toBe(tabelaEsperada);
    expect(idRecebido).toBe(id);
    expect(sinal).toBeInstanceOf(AbortSignal);
  });
});
