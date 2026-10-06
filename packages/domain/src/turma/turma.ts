/**
 * Agregado `Turma` e a entidade `Matricula`.
 *
 * A turma é o conceito que não existia no schema legado, e sua ausência é o
 * que impedia responder "quem faltou". Além disso, é o recorte que reduz o
 * conjunto candidato do futuro matching facial de "todos os alunos da
 * academia" para "os ~20 da aula" — a mitigação mais barata do risco R1.
 *
 * `Matricula` referencia `Aluno` e `Turma` por IDENTIDADE, não por objeto,
 * para que os dois agregados permaneçam independentes.
 */

import { CampoObrigatorio, ExclusaoBloqueadaPorHistorico, ValorInvalido } from '../erros.js';
import { DataCivil } from '../valor/data.js';
import { novoId, type Id } from '../valor/identidade.js';

export type DiaDaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const NOMES_DOS_DIAS = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
] as const;

const FORMATO_HORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface DadosTurma {
  readonly id: Id;
  readonly nome: string;
  readonly diasSemana: readonly DiaDaSemana[];
  readonly horario: string; // HH:MM
  readonly ativa: boolean;
  readonly criadoEm: string;
}

export class Turma {
  private constructor(private estado: DadosTurma) {}

  static criar(entrada: {
    nome: string;
    diasSemana: readonly number[];
    horario: string;
    id?: Id;
    agora?: Date;
  }): Turma {
    const nome = entrada.nome.trim();
    if (nome.length === 0) throw new CampoObrigatorio('nome');

    if (!FORMATO_HORARIO.test(entrada.horario)) {
      throw new ValorInvalido(
        `Horário em formato inválido: "${entrada.horario}". Esperado HH:MM.`,
      );
    }

    const dias = [...new Set(entrada.diasSemana)].sort((a, b) => a - b);
    for (const dia of dias) {
      if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
        throw new ValorInvalido(
          `Dia da semana inválido: ${dia}. Use 0 (domingo) a 6 (sábado).`,
        );
      }
    }

    const agora = entrada.agora ?? new Date();
    return new Turma({
      id: entrada.id ?? novoId(agora.getTime()),
      nome,
      diasSemana: dias as DiaDaSemana[],
      horario: entrada.horario,
      ativa: true,
      criadoEm: agora.toISOString(),
    });
  }

  static reconstituir(dados: DadosTurma): Turma {
    return new Turma(dados);
  }

  get id(): Id {
    return this.estado.id;
  }
  get nome(): string {
    return this.estado.nome;
  }
  get horario(): string {
    return this.estado.horario;
  }
  get diasSemana(): readonly DiaDaSemana[] {
    return this.estado.diasSemana;
  }
  get ativa(): boolean {
    return this.estado.ativa;
  }

  dados(): DadosTurma {
    return { ...this.estado, diasSemana: [...this.estado.diasSemana] };
  }

  /**
   * A turma tem aula nesta data segundo a grade?
   *
   * Orienta, não restringe: EC-12 de chamada-e-presenca permite aula extra e
   * reposição fora da grade, com confirmação explícita do professor.
   */
  temAulaEm(data: DataCivil): boolean {
    return this.estado.diasSemana.includes(data.diaDaSemana as DiaDaSemana);
  }

  desativar(): void {
    this.estado = { ...this.estado, ativa: false };
  }

  reativar(): void {
    this.estado = { ...this.estado, ativa: true };
  }

  /** EC-04: turma com chamadas registradas é desativada, nunca excluída. */
  garantirQuePodeSerExcluida(totalDeChamadas: number): void {
    if (totalDeChamadas > 0) {
      throw new ExclusaoBloqueadaPorHistorico('A turma', this.estado.nome);
    }
  }
}

export interface DadosMatricula {
  readonly alunoId: Id;
  readonly turmaId: Id;
  readonly matriculadoEm: DataCivil;
  readonly desmatriculadoEm: DataCivil | null;
}

export class Matricula {
  private constructor(private estado: DadosMatricula) {}

  static criar(
    alunoId: Id,
    turmaId: Id,
    matriculadoEm: DataCivil = DataCivil.hoje(),
  ): Matricula {
    return new Matricula({
      alunoId,
      turmaId,
      matriculadoEm,
      desmatriculadoEm: null,
    });
  }

  static reconstituir(dados: DadosMatricula): Matricula {
    return new Matricula(dados);
  }

  get alunoId(): Id {
    return this.estado.alunoId;
  }
  get turmaId(): Id {
    return this.estado.turmaId;
  }
  get vigente(): boolean {
    return this.estado.desmatriculadoEm === null;
  }

  dados(): DadosMatricula {
    return { ...this.estado };
  }

  encerrar(data: DataCivil = DataCivil.hoje()): void {
    if (!this.vigente) return;
    if (data.anteriorA(this.estado.matriculadoEm)) {
      throw new ValorInvalido(
        'A desmatrícula não pode ser anterior à matrícula.',
      );
    }
    this.estado = { ...this.estado, desmatriculadoEm: data };
  }

  /**
   * A matrícula estava vigente nesta data?
   *
   * EC-10: presenças anteriores à desmatrícula permanecem válidas e
   * contabilizadas. O aluno apenas deixa de aparecer nas chamadas seguintes.
   */
  vigenteEm(data: DataCivil): boolean {
    if (data.anteriorA(this.estado.matriculadoEm)) return false;
    const fim = this.estado.desmatriculadoEm;
    return fim === null || !fim.anteriorA(data);
  }
}
