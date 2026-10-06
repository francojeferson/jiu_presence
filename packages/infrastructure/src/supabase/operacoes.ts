/**
 * Envio de cada tipo de operação do outbox ao Supabase.
 *
 * Implementa `interfaces/sync-outbox.md`. Devolve sempre uma
 * `RespostaDoServidor` normalizada, para que a classificação seja feita em um
 * lugar só e possa ser testada sem rede.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemDaFila, TipoDeOperacao } from '../local/db.js';
import type { RespostaDoServidor } from '../sync/classificacao.js';

export const TIMEOUT_DO_ITEM_MS = 15_000;

interface ErroPostgrest {
  code?: string;
  message?: string;
  details?: string;
}

/**
 * Extrai o nome da constraint da mensagem do Postgres.
 *
 * É o que distingue "você já me mandou isso" (sucesso) de "outro registro
 * ocupa esse lugar" (falha permanente). Sem a constraint, os dois 409 são
 * indistinguíveis e a idempotência quebra.
 */
export function extrairConstraint(erro: ErroPostgrest | null): string | undefined {
  const texto = `${erro?.message ?? ''} ${erro?.details ?? ''}`;
  return /constraint "([^"]+)"/.exec(texto)?.[1];
}

function respostaDeErro(erro: ErroPostgrest, statusPadrao = 400): RespostaDoServidor {
  const codigo = erro.code;
  const status =
    codigo === '23505' || codigo === '23503'
      ? 409
      : codigo === 'PGRST116'
        ? 404
        : statusPadrao;
  return {
    status,
    codigo,
    constraint: extrairConstraint(erro),
    mensagem: erro.message,
  };
}

const TABELA_POR_TIPO: Record<TipoDeOperacao, string> = {
  criar_aluno: 'aluno',
  atualizar_aluno: 'aluno',
  inativar_aluno: 'aluno',
  criar_turma: 'turma',
  atualizar_turma: 'turma',
  criar_matricula: 'matricula',
  encerrar_matricula: 'matricula',
  criar_chamada: 'chamada',
  confirmar_chamada: 'chamada',
  criar_presenca: 'presenca',
  remover_presenca: 'presenca',
};

export class OperacoesRemotas {
  constructor(private readonly cliente: SupabaseClient) {}

  async enviar(item: ItemDaFila): Promise<RespostaDoServidor> {
    const tabela = TABELA_POR_TIPO[item.tipo];
    const payload = item.payload as Record<string, unknown>;

    try {
      switch (item.tipo) {
        case 'criar_aluno':
        case 'criar_turma':
        case 'criar_chamada':
        case 'criar_presenca':
        case 'criar_matricula':
          return await this.inserir(tabela, payload);

        case 'atualizar_aluno':
        case 'atualizar_turma':
        case 'inativar_aluno':
        case 'confirmar_chamada':
          return await this.atualizarPorId(tabela, payload);

        case 'encerrar_matricula':
          return await this.atualizarMatricula(payload);

        case 'remover_presenca':
          return await this.remover(tabela, payload['id'] as string);
      }
    } catch (erro) {
      // Rede caiu, timeout, DNS. Transitório por desenho.
      return {
        status: 0,
        mensagem: erro instanceof Error ? erro.message : 'falha de rede',
      };
    }
  }

  private async inserir(
    tabela: string,
    payload: Record<string, unknown>,
  ): Promise<RespostaDoServidor> {
    const { error, status } = await this.cliente.from(tabela).insert(payload);
    return error ? respostaDeErro(error) : { status: status || 201 };
  }

  private async atualizarPorId(
    tabela: string,
    payload: Record<string, unknown>,
  ): Promise<RespostaDoServidor> {
    const { id, ...campos } = payload;
    const { error, status, count } = await this.cliente
      .from(tabela)
      .update(campos, { count: 'exact' })
      .eq('id', id);

    if (error) return respostaDeErro(error);
    // Atualizar zero linhas significa que a entidade sumiu do servidor.
    if (count === 0) return { status: 404 };
    return { status: status || 204 };
  }

  private async atualizarMatricula(
    payload: Record<string, unknown>,
  ): Promise<RespostaDoServidor> {
    const { error, status } = await this.cliente
      .from('matricula')
      .update({ desmatriculado_em: payload['desmatriculado_em'] })
      .eq('aluno_id', payload['aluno_id'])
      .eq('turma_id', payload['turma_id'])
      .eq('matriculado_em', payload['matriculado_em']);

    return error ? respostaDeErro(error) : { status: status || 204 };
  }

  private async remover(tabela: string, id: string): Promise<RespostaDoServidor> {
    const { error, status } = await this.cliente.from(tabela).delete().eq('id', id);
    // Remover algo que já não existe é sucesso: o estado desejado é o atual.
    return error ? respostaDeErro(error) : { status: status || 204 };
  }
}
