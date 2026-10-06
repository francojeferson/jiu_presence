/**
 * Casos de uso da chamada.
 *
 * Dependem APENAS de portas. Nenhuma importação de Supabase, Dexie, React ou
 * HTTP aparece aqui — se aparecesse, `.dependency-cruiser.cjs` quebraria o
 * build (regra `application-nao-depende-de-infra-nem-ui`).
 */

import {
  Chamada,
  DataCivil,
  InvarianteViolada,
  type Aluno,
  type Id,
  type RepositorioDeAlunos,
  type RepositorioDeChamadas,
  type RepositorioDeTurmas,
  type Relogio,
  type Turma,
} from '@jiupresence/domain';

export interface DependenciasDaChamada {
  readonly chamadas: RepositorioDeChamadas;
  readonly turmas: RepositorioDeTurmas;
  readonly alunos: RepositorioDeAlunos;
  readonly relogio: Relogio;
}

/** Uma linha da tela de marcação. */
export interface LinhaDeChamada {
  readonly aluno: Aluno;
  readonly presente: boolean;
  readonly origem: 'manual' | 'automatica' | null;
}

export interface ChamadaEmAndamento {
  readonly chamada: Chamada;
  readonly turma: Turma;
  /**
   * TODOS os alunos matriculados, presentes e ausentes.
   *
   * A pergunta real do professor é "quem faltou". Uma lista só de presentes
   * transferiria a subtração para ele, no momento de maior pressa
   * (RF-17, decision log de chamada-e-presenca).
   */
  readonly linhas: readonly LinhaDeChamada[];
  readonly totalDePresentes: number;
  readonly totalDeAusentes: number;
  /** A aula está fora da grade da turma? Orienta, não bloqueia (EC-12). */
  readonly foraDaGrade: boolean;
  /** A chamada já existia e foi reaberta para edição (RF-21). */
  readonly jaExistia: boolean;
}

export class CasosDeUsoDaChamada {
  constructor(private readonly dep: DependenciasDaChamada) {}

  /**
   * Abre a chamada de uma turma em uma data.
   *
   * RF-21: se já existe chamada confirmada para turma e data, abre a
   * EXISTENTE em modo de edição em vez de criar uma segunda. Essa é a regra
   * que impede a duplicata do lado da aplicação; a restrição
   * `chamada_unica_por_turma_e_data` cobre o lado do banco, que é o que
   * sobrevive ao reenvio da fila.
   */
  async abrir(turmaId: Id, data?: DataCivil): Promise<ChamadaEmAndamento> {
    const turma = await this.dep.turmas.porId(turmaId);
    if (turma === null) {
      throw new InvarianteViolada('Turma não encontrada.');
    }

    const dia = data ?? this.dep.relogio.hoje();
    const existente = await this.dep.chamadas.porTurmaEData(turmaId, dia);

    const chamada =
      existente ??
      Chamada.abrir({
        turmaId,
        data: dia,
        origem: 'manual',
        agora: this.dep.relogio.agora(),
      });

    const alunos = await this.dep.alunos.daTurma(turmaId, dia);
    if (alunos.length === 0) {
      // EC-06: impedir a chamada e direcionar para a matrícula, explicando.
      throw new InvarianteViolada(
        `A turma "${turma.nome}" não tem nenhum aluno matriculado. ` +
          'Matricule ao menos um aluno antes de fazer a chamada.',
      );
    }

    return this.montar(chamada, turma, alunos, existente !== null);
  }

  async alternarPresenca(
    emAndamento: ChamadaEmAndamento,
    alunoId: Id,
  ): Promise<ChamadaEmAndamento> {
    emAndamento.chamada.alternarPresenca(alunoId, this.dep.relogio.agora());
    return this.montar(
      emAndamento.chamada,
      emAndamento.turma,
      emAndamento.linhas.map((l) => l.aluno),
      emAndamento.jaExistia,
    );
  }

  /**
   * Confirma e persiste.
   *
   * A persistência vai pelo repositório, que grava localmente e enfileira na
   * MESMA transação. O caso de uso não sabe que existe uma fila — isso é
   * detalhe de infraestrutura (decision log de sincronizacao-offline-first).
   */
  async confirmar(emAndamento: ChamadaEmAndamento): Promise<void> {
    emAndamento.chamada.confirmar();
    await this.dep.chamadas.salvar(emAndamento.chamada);
  }

  private montar(
    chamada: Chamada,
    turma: Turma,
    alunos: readonly Aluno[],
    jaExistia: boolean,
  ): ChamadaEmAndamento {
    const porAluno = new Map(chamada.presencas.map((p) => [p.alunoId, p]));

    const linhas: LinhaDeChamada[] = alunos.map((aluno) => {
      const presenca = porAluno.get(aluno.id);
      return {
        aluno,
        presente: presenca !== undefined,
        origem: presenca?.origem ?? null,
      };
    });

    const presentes = linhas.filter((l) => l.presente).length;

    return {
      chamada,
      turma,
      linhas,
      totalDePresentes: presentes,
      totalDeAusentes: linhas.length - presentes,
      foraDaGrade: !turma.temAulaEm(chamada.data),
      jaExistia,
    };
  }
}
