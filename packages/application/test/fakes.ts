/**
 * Repositórios fake, em memória.
 *
 * A existência destes fakes é a prova de que a inversão de dependência
 * funciona: nenhum caso de uso precisou ser alterado para ser testado, e
 * nenhum mock de Supabase ou de IndexedDB é necessário.
 *
 * No projeto Flutter anterior isso era impossível — `RegistrationScreen`
 * instanciava `SupabaseService()` diretamente, e foi preciso criar um método
 * público `setTestState` só para contornar.
 */

import {
  Aluno,
  Chamada,
  DataCivil,
  Matricula,
  Turma,
  type Id,
  type RepositorioDeAlunos,
  type RepositorioDeChamadas,
  type RepositorioDeMatriculas,
  type RepositorioDeTurmas,
  type Relogio,
} from '@jiupresence/domain';

export class RelogioFixo implements Relogio {
  constructor(private instante: Date) {}
  agora(): Date {
    return new Date(this.instante);
  }
  hoje(): DataCivil {
    return DataCivil.deInstante(this.instante);
  }
  avancar(ms: number): void {
    this.instante = new Date(this.instante.getTime() + ms);
  }
}

export class AlunosEmMemoria implements RepositorioDeAlunos {
  readonly itens = new Map<Id, Aluno>();
  presencasPorAluno = new Map<Id, number>();
  constructor(private readonly matriculas: MatriculasEmMemoria) {}

  async porId(id: Id): Promise<Aluno | null> {
    return this.itens.get(id) ?? null;
  }

  async listar(opcoes?: { apenasAtivos?: boolean }): Promise<Aluno[]> {
    const todos = [...this.itens.values()];
    return opcoes?.apenasAtivos === true ? todos.filter((a) => a.ativo) : todos;
  }

  async daTurma(turmaId: Id, em: DataCivil): Promise<Aluno[]> {
    const vigentes = [...this.matriculas.itens].filter(
      (m) => m.turmaId === turmaId && m.vigenteEm(em),
    );
    return vigentes
      .map((m) => this.itens.get(m.alunoId))
      .filter((a): a is Aluno => a !== undefined && a.ativo);
  }

  async salvar(aluno: Aluno): Promise<void> {
    this.itens.set(aluno.id, aluno);
  }

  async excluir(id: Id): Promise<void> {
    this.itens.delete(id);
  }

  async contarPresencas(alunoId: Id): Promise<number> {
    return this.presencasPorAluno.get(alunoId) ?? 0;
  }
}

export class TurmasEmMemoria implements RepositorioDeTurmas {
  readonly itens = new Map<Id, Turma>();
  chamadasPorTurma = new Map<Id, number>();

  async porId(id: Id): Promise<Turma | null> {
    return this.itens.get(id) ?? null;
  }
  async listar(opcoes?: { apenasAtivas?: boolean }): Promise<Turma[]> {
    const todas = [...this.itens.values()];
    return opcoes?.apenasAtivas === true ? todas.filter((t) => t.ativa) : todas;
  }
  async salvar(turma: Turma): Promise<void> {
    this.itens.set(turma.id, turma);
  }
  async excluir(id: Id): Promise<void> {
    this.itens.delete(id);
  }
  async contarChamadas(turmaId: Id): Promise<number> {
    return this.chamadasPorTurma.get(turmaId) ?? 0;
  }
}

export class MatriculasEmMemoria implements RepositorioDeMatriculas {
  readonly itens: Matricula[] = [];

  async daTurma(turmaId: Id): Promise<Matricula[]> {
    return this.itens.filter((m) => m.turmaId === turmaId);
  }
  async doAluno(alunoId: Id): Promise<Matricula[]> {
    return this.itens.filter((m) => m.alunoId === alunoId);
  }
  async salvar(matricula: Matricula): Promise<void> {
    const i = this.itens.findIndex(
      (m) =>
        m.alunoId === matricula.alunoId &&
        m.turmaId === matricula.turmaId &&
        m.dados().matriculadoEm.iso === matricula.dados().matriculadoEm.iso,
    );
    if (i >= 0) this.itens[i] = matricula;
    else this.itens.push(matricula);
  }
}

export class ChamadasEmMemoria implements RepositorioDeChamadas {
  readonly itens = new Map<Id, Chamada>();
  salvamentos = 0;

  async porId(id: Id): Promise<Chamada | null> {
    return this.itens.get(id) ?? null;
  }
  async porTurmaEData(turmaId: Id, data: DataCivil): Promise<Chamada | null> {
    for (const c of this.itens.values()) {
      if (c.turmaId === turmaId && c.data.igual(data)) return c;
    }
    return null;
  }
  async listarRecentes(limite: number): Promise<Chamada[]> {
    return [...this.itens.values()].slice(0, limite);
  }
  async salvar(chamada: Chamada): Promise<void> {
    this.salvamentos += 1;
    this.itens.set(chamada.id, chamada);
  }
}

export function montarCenario(agora = new Date('2026-10-05T19:00:00')) {
  const relogio = new RelogioFixo(agora);
  const matriculas = new MatriculasEmMemoria();
  const alunos = new AlunosEmMemoria(matriculas);
  const turmas = new TurmasEmMemoria();
  const chamadas = new ChamadasEmMemoria();
  return { relogio, alunos, turmas, matriculas, chamadas };
}
