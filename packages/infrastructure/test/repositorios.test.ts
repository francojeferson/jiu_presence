import './setup.js';
import type { LinhaAluno, LinhaTurma } from '@jiupresence/contracts';
import { novoId } from '@jiupresence/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BancoLocal } from '../src/local/db.js';
import { Outbox } from '../src/local/outbox.js';
import { RepositoriosLocais } from '../src/local/repositorios.js';

const AGORA = '2026-10-09T22:00:00Z';

describe('exclusões locais', () => {
  let db: BancoLocal;
  let repositorios: RepositoriosLocais;

  beforeEach(() => {
    db = new BancoLocal('repositorios-' + Math.random());
    repositorios = new RepositoriosLocais(db);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete();
  });

  it('exclui aluno e enfileira a remoção na mesma transação', async () => {
    const alunoId = novoId();
    const aluno: LinhaAluno = {
      id: alunoId,
      nome: 'Ana',
      data_nascimento: null,
      escala: 'adulta',
      faixa_atual: 'azul',
      data_ultima_graduacao: null,
      ativo: true,
      criado_em: AGORA,
      atualizado_em: AGORA,
    };
    await db.cache.put({
      chave: 'alunos',
      valor: [aluno],
      atualizadoEm: AGORA,
      versaoSchema: 1,
    });

    await repositorios.excluir(alunoId);

    expect((await db.cache.get('alunos'))?.valor).toEqual([]);
    expect(await db.outbox.toArray()).toMatchObject([
      {
        chaveDeIdempotencia: aluno.id,
        tipo: 'excluir_aluno',
        payload: { id: aluno.id },
        estado: 'pendente',
      },
    ]);
  });

  it('exclui turma e enfileira a remoção na mesma transação', async () => {
    const turmaId = novoId();
    const turma: LinhaTurma = {
      id: turmaId,
      nome: 'Iniciantes',
      dias_semana: [1, 3, 5],
      horario: '19:00',
      ativa: true,
      criado_em: AGORA,
    };
    await db.cache.put({
      chave: 'turmas',
      valor: [turma],
      atualizadoEm: AGORA,
      versaoSchema: 1,
    });

    await repositorios.excluirTurma(turmaId);

    expect((await db.cache.get('turmas'))?.valor).toEqual([]);
    expect(await db.outbox.toArray()).toMatchObject([
      {
        chaveDeIdempotencia: turma.id,
        tipo: 'excluir_turma',
        payload: { id: turma.id },
        estado: 'pendente',
      },
    ]);
  });

  it('restaura o cache se não conseguir enfileirar a exclusão', async () => {
    const alunoId = novoId();
    const aluno: LinhaAluno = {
      id: alunoId,
      nome: 'Ana',
      data_nascimento: null,
      escala: 'adulta',
      faixa_atual: 'azul',
      data_ultima_graduacao: null,
      ativo: true,
      criado_em: AGORA,
      atualizado_em: AGORA,
    };
    await db.cache.put({
      chave: 'alunos',
      valor: [aluno],
      atualizadoEm: AGORA,
      versaoSchema: 1,
    });
    vi.spyOn(Outbox.prototype, 'enfileirar').mockRejectedValueOnce(
      new Error('falha simulada'),
    );

    await expect(repositorios.excluir(alunoId)).rejects.toThrow('falha simulada');

    expect((await db.cache.get('alunos'))?.valor).toEqual([aluno]);
    expect(await db.outbox.count()).toBe(0);
  });
});
