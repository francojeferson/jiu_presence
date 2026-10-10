import './setup.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  LinhaAluno,
  LinhaChamada,
  LinhaPresenca,
} from '@jiupresence/contracts';
import type { Id } from '@jiupresence/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BancoLocal } from '../src/local/db.js';
import { Outbox } from '../src/local/outbox.js';
import { RepositoriosLocais } from '../src/local/repositorios.js';
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

const alunoLocal: LinhaAluno = {
  id: id(4),
  nome: 'Ana local',
  data_nascimento: null,
  escala: 'adulta',
  faixa_atual: 'azul',
  data_ultima_graduacao: null,
  ativo: true,
  criado_em: '2026-10-09T22:00:00Z',
  atualizado_em: '2026-10-09T22:00:00Z',
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

function clienteFalso(
  requisicoes: URL[],
  aguardar?: Promise<void>,
  alunos: LinhaAluno[] = [],
): SupabaseClient {
  const presencas = [
    ...Array.from({ length: 1_001 }, (_, i) => presenca(i)),
    presenca(1_001, id(3)),
  ];
  const buscar = vi.fn(
    async (entrada: RequestInfo | URL, opcoes?: RequestInit): Promise<Response> => {
      const requisicao = new Request(entrada, opcoes);
      const url = new URL(requisicao.url);
      requisicoes.push(url);
      if (aguardar) await aguardar;
      const tabela = url.pathname.split('/').at(-1);
      let dados: unknown[] =
        tabela === 'chamada'
          ? [chamada]
          : tabela === 'presenca'
            ? presencas
            : tabela === 'aluno'
              ? alunos
              : [];

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

  async function guardarAlunoLocal(): Promise<void> {
    await db.cache.put({
      chave: 'alunos',
      valor: [alunoLocal],
      atualizadoEm: alunoLocal.atualizado_em,
      versaoSchema: 1,
    });
  }

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

  it('preserva o cache enquanto há operação pendente', async () => {
    const requisicoes: URL[] = [];
    await guardarAlunoLocal();
    await new Outbox(db).enfileirar(
      alunoLocal.id,
      'criar_aluno',
      alunoLocal,
      alunoLocal.criado_em,
    );

    await new SincronizadorDeCache(clienteFalso(requisicoes), db).puxar();

    expect(requisicoes).toHaveLength(0);
    expect((await db.cache.get('alunos'))?.valor).toEqual([alunoLocal]);
  });

  it('não deixa aluno excluído reaparecer antes nem depois da sincronização', async () => {
    const requisicoes: URL[] = [];
    const alunosRemotos = [alunoLocal];
    await guardarAlunoLocal();
    await new RepositoriosLocais(db).excluir(alunoLocal.id as Id);
    const sincronizador = new SincronizadorDeCache(
      clienteFalso(requisicoes, undefined, alunosRemotos),
      db,
    );

    expect(await sincronizador.puxar()).toBe(false);
    expect(requisicoes).toHaveLength(0);
    expect((await db.cache.get('alunos'))?.valor).toEqual([]);

    alunosRemotos.length = 0;
    const remocao = (await db.outbox.toArray())[0]!;
    await new Outbox(db).concluir(remocao.id);

    expect(await sincronizador.puxar()).toBe(true);
    expect((await db.cache.get('alunos'))?.valor).toEqual([]);
  });

  it('preserva mudança criada e sincronizada durante o pull', async () => {
    const requisicoes: URL[] = [];
    let liberar!: () => void;
    const aguardar = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const puxar = new SincronizadorDeCache(
      clienteFalso(requisicoes, aguardar),
      db,
    ).puxar();
    await vi.waitFor(() => expect(requisicoes.length).toBeGreaterThan(0));

    await guardarAlunoLocal();
    const outbox = new Outbox(db);
    const operacao = await outbox.enfileirar(
      alunoLocal.id,
      'criar_aluno',
      alunoLocal,
      alunoLocal.criado_em,
    );
    await outbox.concluir(operacao);
    liberar();
    await puxar;

    expect(await db.outbox.count()).toBe(0);
    expect((await db.cache.get('alunos'))?.valor).toEqual([alunoLocal]);
  });
});
