import './setup.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LinhaChamada, LinhaPresenca } from '@jiupresence/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BancoLocal } from '../src/local/db.js';
import { SincronizadorDeCache } from '../src/sync/cache.js';

function id(numero: number): string {
  return `00000000-0000-7000-8000-${numero.toString(16).padStart(12, '0')}`;
}

const chamada: LinhaChamada = {
  id: id(1),
  turma_id: id(2),
  data: '2026-10-09',
  realizada_em: '2026-10-09T22:00:00Z',
  origem: 'manual',
  total_detectado: null,
  confirmada: true,
  criada_offline: false,
};

function presenca(numero: number, chamadaId = chamada.id): LinhaPresenca {
  return {
    id: id(numero + 100),
    chamada_id: chamadaId,
    aluno_id: id(numero + 2_000),
    origem: 'manual',
    confianca: null,
    registrada_em: '2026-10-09T22:00:00Z',
  };
}

function clienteFalso(requisicoes: URL[]): SupabaseClient {
  const presencas = [
    ...Array.from({ length: 1_001 }, (_, i) => presenca(i)),
    presenca(1_001, id(3)),
  ];
  const buscar = vi.fn(
    async (entrada: RequestInfo | URL, opcoes?: RequestInit): Promise<Response> => {
      const requisicao = new Request(entrada, opcoes);
      const url = new URL(requisicao.url);
      requisicoes.push(url);
      const tabela = url.pathname.split('/').at(-1);
      let dados: unknown[] =
        tabela === 'chamada' ? [chamada] : tabela === 'presenca' ? presencas : [];

      if (tabela === 'presenca') {
        if (url.searchParams.has('chamada_id')) {
          dados = presencas.filter((item) => item.chamada_id === chamada.id);
        }
        const inicio = Number(url.searchParams.get('offset') ?? 0);
        const limite = Math.min(Number(url.searchParams.get('limit') ?? 1_000), 1_000);
        dados = dados.slice(inicio, inicio + limite);
      }

      return new Response(JSON.stringify(dados), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  );

  return createClient('http://supabase.test', 'chave-de-teste', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: buscar },
  });
}

describe('SincronizadorDeCache', () => {
  let db: BancoLocal;

  beforeEach(() => {
    db = new BancoLocal(`cache-${Math.random()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('pagina somente as presenças das chamadas recentes', async () => {
    const requisicoes: URL[] = [];
    const sincronizador = new SincronizadorDeCache(clienteFalso(requisicoes), db);

    await sincronizador.puxar();

    expect((await db.cache.get('presencas'))?.valor).toHaveLength(1_001);
    const paginas = requisicoes.filter((url) => url.pathname.endsWith('/presenca'));
    expect(paginas).toHaveLength(2);
    expect(paginas.map((url) => url.searchParams.get('offset'))).toEqual([
      '0',
      '1000',
    ]);
    expect(paginas.map((url) => url.searchParams.get('chamada_id'))).toEqual([
      `in.(${chamada.id})`,
      `in.(${chamada.id})`,
    ]);
    expect(paginas.map((url) => url.searchParams.get('order'))).toEqual([
      'id.asc',
      'id.asc',
    ]);
  });
});
