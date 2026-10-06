/**
 * Agregado `Aluno`.
 *
 * Raiz de agregado. Na feature de biometria passa a conter também seus
 * `EmbeddingFacial` — nenhum embedding existe sem aluno, e remover o aluno
 * remove seus embeddings.
 */

import { CampoObrigatorio, ExclusaoBloqueadaPorHistorico } from '../erros.js';
import { DataCivil } from '../valor/data.js';
import { Faixa, type Escala } from '../valor/faixa.js';
import { novoId, type Id } from '../valor/identidade.js';

export interface DadosAluno {
  readonly id: Id;
  readonly nome: string;
  readonly dataNascimento: DataCivil | null;
  readonly faixa: Faixa;
  readonly dataUltimaGraduacao: DataCivil | null;
  readonly ativo: boolean;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface EntradaNovoAluno {
  readonly nome: string;
  readonly dataNascimento?: DataCivil | null;
  readonly escala: Escala;
  readonly faixa: string;
  readonly dataUltimaGraduacao?: DataCivil | null;
  readonly id?: Id;
  readonly agora?: Date;
}

export class Aluno {
  private constructor(private estado: DadosAluno) {}

  static criar(entrada: EntradaNovoAluno): Aluno {
    const nome = entrada.nome.trim();
    if (nome.length === 0) throw new CampoObrigatorio('nome');

    const agora = entrada.agora ?? new Date();
    const instante = agora.toISOString();

    return new Aluno({
      id: entrada.id ?? novoId(agora.getTime()),
      nome,
      dataNascimento: entrada.dataNascimento ?? null,
      faixa: Faixa.criar(entrada.escala, entrada.faixa),
      dataUltimaGraduacao: entrada.dataUltimaGraduacao ?? null,
      ativo: true,
      criadoEm: instante,
      atualizadoEm: instante,
    });
  }

  /** Reconstrói a partir de dados persistidos, sem reaplicar regras de criação. */
  static reconstituir(dados: DadosAluno): Aluno {
    return new Aluno(dados);
  }

  get id(): Id {
    return this.estado.id;
  }
  get nome(): string {
    return this.estado.nome;
  }
  get faixa(): Faixa {
    return this.estado.faixa;
  }
  get escala(): Escala {
    return this.estado.faixa.escala;
  }
  get dataNascimento(): DataCivil | null {
    return this.estado.dataNascimento;
  }
  get dataUltimaGraduacao(): DataCivil | null {
    return this.estado.dataUltimaGraduacao;
  }
  get ativo(): boolean {
    return this.estado.ativo;
  }

  dados(): DadosAluno {
    return { ...this.estado };
  }

  idadeEm(referencia: DataCivil): number | null {
    return DataCivil.idadeEm(this.estado.dataNascimento, referencia);
  }

  /**
   * A escala registrada diverge da que a idade sugere?
   *
   * EC-01 de gestao-de-alunos-e-turmas: quando a criança cruza a idade de
   * corte, o sistema SINALIZA mas não converte. A escala em que o aluno
   * compete é decisão do professor, não consequência automática de um
   * aniversário.
   */
  escalaDivergeDaIdade(referencia: DataCivil): boolean {
    const sugerida = Faixa.escalaPorIdade(this.idadeEm(referencia));
    return sugerida !== null && sugerida !== this.escala;
  }

  renomear(nome: string, agora: Date = new Date()): void {
    const limpo = nome.trim();
    if (limpo.length === 0) throw new CampoObrigatorio('nome');
    this.estado = {
      ...this.estado,
      nome: limpo,
      atualizadoEm: agora.toISOString(),
    };
  }

  alterarFaixa(escala: Escala, faixa: string, agora: Date = new Date()): void {
    this.estado = {
      ...this.estado,
      faixa: Faixa.criar(escala, faixa),
      atualizadoEm: agora.toISOString(),
    };
  }

  registrarGraduacao(
    escala: Escala,
    faixa: string,
    data: DataCivil,
    agora: Date = new Date(),
  ): void {
    this.estado = {
      ...this.estado,
      faixa: Faixa.criar(escala, faixa),
      dataUltimaGraduacao: data,
      atualizadoEm: agora.toISOString(),
    };
  }

  /**
   * RF-14: inativação preserva o histórico. O aluno some da chamada, mas tudo
   * que ele já fez continua consultável e contabilizado no período em que
   * esteve ativo.
   */
  inativar(agora: Date = new Date()): void {
    if (!this.estado.ativo) return;
    this.estado = {
      ...this.estado,
      ativo: false,
      atualizadoEm: agora.toISOString(),
    };
  }

  reativar(agora: Date = new Date()): void {
    if (this.estado.ativo) return;
    this.estado = {
      ...this.estado,
      ativo: true,
      atualizadoEm: agora.toISOString(),
    };
  }

  /**
   * RF-15: a exclusão é recusada quando há histórico, e o erro carrega a
   * alternativa para que a interface possa oferecê-la na mesma tela.
   *
   * A regra vive aqui, no domínio, e é reforçada por `on delete restrict` na
   * tabela `presenca`. Duas camadas de defesa porque o histórico de frequência
   * é o ativo central do produto: perdê-lo inutiliza a decisão de graduação.
   */
  garantirQuePodeSerExcluido(totalDePresencas: number): void {
    if (totalDePresencas > 0) {
      throw new ExclusaoBloqueadaPorHistorico('O aluno', this.estado.nome);
    }
  }
}
