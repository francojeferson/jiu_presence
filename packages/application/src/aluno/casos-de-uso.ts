/**
 * Casos de uso de aluno, turma e matrícula.
 */

import {
  Aluno,
  DataCivil,
  Faixa,
  InvarianteViolada,
  Matricula,
  Turma,
  type Escala,
  type Id,
  type RepositorioDeAlunos,
  type RepositorioDeMatriculas,
  type RepositorioDeTurmas,
  type Relogio,
} from '@jiupresence/domain';

export interface DependenciasDeCadastro {
  readonly alunos: RepositorioDeAlunos;
  readonly turmas: RepositorioDeTurmas;
  readonly matriculas: RepositorioDeMatriculas;
  readonly relogio: Relogio;
}

export interface EntradaDeCadastroDeAluno {
  readonly nome: string;
  readonly dataNascimento?: string | undefined;
  /** Obrigatória apenas quando não há data de nascimento (EC-02). */
  readonly escala?: Escala | undefined;
  readonly faixa: string;
  readonly dataUltimaGraduacao?: string | undefined;
  readonly turmaIds?: readonly Id[] | undefined;
}

export class CasosDeUsoDeAluno {
  constructor(private readonly dep: DependenciasDeCadastro) {}

  /**
   * Escala sugerida para a idade, ou `null` quando não há data de nascimento.
   *
   * A tela usa isto para oferecer o seletor de faixa certo sem perguntar ao
   * professor se o aluno é "adulto ou infantil" — uma pergunta a menos e uma
   * classe de erro de preenchimento a menos (decision log de
   * gestao-de-alunos-e-turmas).
   */
  escalaSugerida(dataNascimento: string | null): Escala | null {
    if (dataNascimento === null) return null;
    const nascimento = DataCivil.deIso(dataNascimento);
    return Faixa.escalaPorIdade(
      DataCivil.idadeEm(nascimento, this.dep.relogio.hoje()),
    );
  }

  async cadastrar(entrada: EntradaDeCadastroDeAluno): Promise<Aluno> {
    const nascimento =
      entrada.dataNascimento != null
        ? DataCivil.deIso(entrada.dataNascimento)
        : null;

    const sugerida = this.escalaSugerida(entrada.dataNascimento ?? null);
    const escala = sugerida ?? entrada.escala ?? null;

    if (escala === null) {
      // EC-02: sem data de nascimento, o professor precisa escolher.
      // Presumir "adulta" daria o seletor errado para toda criança.
      throw new InvarianteViolada(
        'Sem data de nascimento, é preciso informar se o aluno segue a ' +
          'graduação adulta ou a infantil.',
      );
    }

    const aluno = Aluno.criar({
      nome: entrada.nome,
      dataNascimento: nascimento,
      escala,
      faixa: entrada.faixa,
      dataUltimaGraduacao:
        entrada.dataUltimaGraduacao != null
          ? DataCivil.deIso(entrada.dataUltimaGraduacao)
          : null,
      agora: this.dep.relogio.agora(),
    });

    await this.dep.alunos.salvar(aluno);

    for (const turmaId of entrada.turmaIds ?? []) {
      await this.matricular(aluno.id, turmaId);
    }

    return aluno;
  }

  async listar(): Promise<Aluno[]> {
    return this.dep.alunos.listar();
  }

  async matricular(alunoId: Id, turmaId: Id): Promise<void> {
    const vigentes = await this.dep.matriculas.doAluno(alunoId);
    const jaMatriculado = vigentes.some(
      (m) => m.turmaId === turmaId && m.vigente,
    );
    if (jaMatriculado) return;

    await this.dep.matriculas.salvar(
      Matricula.criar(alunoId, turmaId, this.dep.relogio.hoje()),
    );
  }

  async desmatricular(alunoId: Id, turmaId: Id): Promise<void> {
    const matriculas = await this.dep.matriculas.doAluno(alunoId);
    const vigente = matriculas.find((m) => m.turmaId === turmaId && m.vigente);
    if (!vigente) return;

    vigente.encerrar(this.dep.relogio.hoje());
    await this.dep.matriculas.salvar(vigente);
  }

  async inativar(alunoId: Id): Promise<void> {
    const aluno = await this.exigirAluno(alunoId);
    aluno.inativar(this.dep.relogio.agora());
    await this.dep.alunos.salvar(aluno);
  }

  async reativar(alunoId: Id): Promise<void> {
    const aluno = await this.exigirAluno(alunoId);
    aluno.reativar(this.dep.relogio.agora());
    await this.dep.alunos.salvar(aluno);
  }

  /**
   * RF-15: a exclusão é recusada quando há histórico.
   *
   * O erro lançado pelo domínio carrega `alternativa: 'inativar'`, para que a
   * tela ofereça a inativação sem precisar interpretar a mensagem.
   */
  async excluir(alunoId: Id): Promise<void> {
    const aluno = await this.exigirAluno(alunoId);
    const presencas = await this.dep.alunos.contarPresencas(alunoId);
    aluno.garantirQuePodeSerExcluido(presencas);
    await this.dep.alunos.excluir(alunoId);
  }

  private async exigirAluno(alunoId: Id): Promise<Aluno> {
    const aluno = await this.dep.alunos.porId(alunoId);
    if (aluno === null) throw new InvarianteViolada('Aluno não encontrado.');
    return aluno;
  }
}

export class CasosDeUsoDeTurma {
  constructor(private readonly dep: DependenciasDeCadastro) {}

  async cadastrar(entrada: {
    nome: string;
    diasSemana: readonly number[];
    horario: string;
  }): Promise<Turma> {
    const turma = Turma.criar({ ...entrada, agora: this.dep.relogio.agora() });
    await this.dep.turmas.salvar(turma);
    return turma;
  }

  async listarAtivas(): Promise<Turma[]> {
    const turmas = await this.dep.turmas.listar({ apenasAtivas: true });
    return turmas.sort((a, b) => a.horario.localeCompare(b.horario));
  }

  /** A turma que tem aula agora, para pré-seleção na chamada (RF-01). */
  async doHorarioAtual(): Promise<Turma | null> {
    const hoje = this.dep.relogio.hoje();
    const turmas = await this.dep.turmas.listar({ apenasAtivas: true });
    const doDia = turmas.filter((t) => t.temAulaEm(hoje));
    if (doDia.length === 0) return null;

    const agora = this.dep.relogio.agora();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

    // A turma cujo horário está mais próximo do momento atual.
    return doDia.reduce((maisProxima, turma) => {
      const distancia = (t: Turma): number => {
        const [h, m] = t.horario.split(':').map(Number);
        return Math.abs((h! * 60 + m!) - minutosAgora);
      };
      return distancia(turma) < distancia(maisProxima) ? turma : maisProxima;
    });
  }

  async desativar(turmaId: Id): Promise<void> {
    const turma = await this.dep.turmas.porId(turmaId);
    if (turma === null) throw new InvarianteViolada('Turma não encontrada.');
    turma.desativar();
    await this.dep.turmas.salvar(turma);
  }

  /** EC-04: turma com chamadas é desativada, nunca excluída. */
  async excluir(turmaId: Id): Promise<void> {
    const turma = await this.dep.turmas.porId(turmaId);
    if (turma === null) throw new InvarianteViolada('Turma não encontrada.');
    const chamadas = await this.dep.turmas.contarChamadas(turmaId);
    turma.garantirQuePodeSerExcluida(chamadas);
    await this.dep.turmas.excluir(turmaId);
  }
}
