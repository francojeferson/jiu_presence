/**
 * Sincronização do cache de leitura.
 *
 * Puxa turmas, alunos ativos, matrículas e as chamadas recentes para o
 * IndexedDB, de modo que a chamada funcione offline (RF-22).
 *
 * A ordem importa: o cache é reescrito só depois de TODAS as consultas
 * terem sucesso. Reescrever parcialmente deixaria o dispositivo com alunos
 * novos mas matrículas velhas, e a chamada mostraria a turma errada.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  linhaAlunoSchema,
  linhaChamadaSchema,
  linhaMatriculaSchema,
  linhaPresencaSchema,
  linhaTurmaSchema,
  validarLista,
  type LinhaPresenca,
  type Schema,
} from '@jiupresence/contracts';

import { bancoLocal, VERSAO_DO_SCHEMA_LOCAL, type BancoLocal } from '../local/db.js';

/** Quantas chamadas recentes manter localmente. */
export const CHAMADAS_RECENTES = 60;
const TAMANHO_DA_PAGINA = 1_000;

/**
 * Recorte mínimo da consulta do PostgREST que usamos aqui.
 *
 * Declarado em vez de importado porque os tipos do SDK dependem do schema
 * gerado, que este pacote não possui. É o que permite encadear `.order()` e
 * `.limit()` mantendo o resultado tipado e aguardável.
 */
interface ConsultaSupabase
  extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  in(coluna: string, valores: readonly string[]): ConsultaSupabase;
  order(coluna: string, opcoes?: { ascending?: boolean }): ConsultaSupabase;
  limit(n: number): ConsultaSupabase;
  range(inicio: number, fim: number): ConsultaSupabase;
}

export class SincronizadorDeCache {
  constructor(
    private readonly cliente: SupabaseClient,
    private readonly db: BancoLocal = bancoLocal(),
  ) {}

  /**
   * Reconstrói o cache a partir do servidor.
   *
   * Lança quando qualquer consulta falha, deixando o cache anterior intacto.
   * Cache velho é melhor que cache meio atualizado.
   */
  async puxar(): Promise<void> {
    const [turmas, alunos, matriculas, chamadas] = await Promise.all([
      this.buscar('turma', linhaTurmaSchema),
      this.buscar('aluno', linhaAlunoSchema),
      this.buscar('matricula', linhaMatriculaSchema),
      this.buscar('chamada', linhaChamadaSchema, (q) =>
        q.order('data', { ascending: false }).limit(CHAMADAS_RECENTES),
      ),
    ]);
    const presencas = await this.buscarPresencas(chamadas.map((chamada) => chamada.id));

    const agora = new Date().toISOString();
    const entradas = [
      { chave: 'turmas', valor: turmas },
      { chave: 'alunos', valor: alunos },
      { chave: 'matriculas', valor: matriculas },
      { chave: 'chamadas', valor: chamadas },
      { chave: 'presencas', valor: presencas },
    ].map((e) => ({ ...e, atualizadoEm: agora, versaoSchema: VERSAO_DO_SCHEMA_LOCAL }));

    // Só agora, com tudo em mãos, o cache é substituído.
    await this.db.transaction('rw', this.db.cache, async () => {
      await this.db.cache.bulkPut(entradas);
    });
  }

  /**
   * RF-17: schema local defasado dispara reconstrução.
   *
   * A fila NUNCA é tocada aqui. Cache é descartável; outbox é a única cópia
   * de uma intenção do professor.
   */
  async reconstruirSeDefasado(): Promise<boolean> {
    const entradas = await this.db.cache.toArray();
    const defasado = entradas.some((e) => e.versaoSchema !== VERSAO_DO_SCHEMA_LOCAL);
    if (!defasado && entradas.length > 0) return false;

    await this.db.cache.clear();
    await this.puxar();
    return true;
  }

  private async buscarPresencas(chamadaIds: readonly string[]): Promise<LinhaPresenca[]> {
    if (chamadaIds.length === 0) return [];

    const presencas: LinhaPresenca[] = [];
    for (let inicio = 0; ; inicio += TAMANHO_DA_PAGINA) {
      const pagina = await this.buscar('presenca', linhaPresencaSchema, (q) =>
        q
          .in('chamada_id', chamadaIds)
          .order('id')
          .range(inicio, inicio + TAMANHO_DA_PAGINA - 1),
      );
      presencas.push(...pagina);
      if (pagina.length < TAMANHO_DA_PAGINA) return presencas;
    }
  }

  private async buscar<T>(
    tabela: string,
    schema: Schema<T>,
    refinar?: (consulta: ConsultaSupabase) => ConsultaSupabase,
  ): Promise<T[]> {
    const base = this.cliente.from(tabela).select('*') as unknown as ConsultaSupabase;
    const consulta = refinar ? refinar(base) : base;

    const { data, error } = await consulta;
    if (error) {
      throw new Error(`Falha ao buscar ${tabela}: ${error.message}`);
    }

    // Validar na fronteira, não confiar no servidor.
    return validarLista(schema, data, tabela);
  }
}
