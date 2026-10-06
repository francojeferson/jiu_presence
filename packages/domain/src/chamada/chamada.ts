/**
 * Agregado `Chamada`, com suas `Presenca`.
 *
 * A invariante central é RN-03: um aluno aparece no máximo uma vez em uma
 * chamada. Ela é aplicada aqui e reforçada pela restrição
 * `presenca_unica_por_chamada_e_aluno` no banco — duas camadas, porque a
 * aplicação sozinha não sobrevive ao reenvio da fila de sincronização.
 *
 * `Presenca` não existe fora de uma `Chamada`. É a diferença central em
 * relação ao modelo legado, onde `presenca` referenciava o aluno diretamente
 * e, por isso, não permitia responder "quem faltou".
 */

import { InvarianteViolada } from '../erros.js';
import { DataCivil } from '../valor/data.js';
import { novoId, type Id } from '../valor/identidade.js';

export type OrigemChamada = 'manual' | 'foto' | 'mista';
export type OrigemPresenca = 'manual' | 'automatica';

export interface DadosPresenca {
  readonly id: Id;
  readonly chamadaId: Id;
  readonly alunoId: Id;
  readonly origem: OrigemPresenca;
  readonly confianca: number | null;
  readonly registradaEm: string;
}

export interface DadosChamada {
  readonly id: Id;
  readonly turmaId: Id;
  readonly data: DataCivil;
  readonly realizadaEm: string;
  readonly origem: OrigemChamada;
  readonly totalDetectado: number | null;
  readonly confirmada: boolean;
  readonly criadaOffline: boolean;
  readonly presencas: readonly DadosPresenca[];
}

export class Chamada {
  private constructor(private estado: DadosChamada) {}

  static abrir(entrada: {
    turmaId: Id;
    data?: DataCivil;
    origem?: OrigemChamada;
    criadaOffline?: boolean;
    id?: Id;
    agora?: Date;
  }): Chamada {
    const agora = entrada.agora ?? new Date();
    return new Chamada({
      id: entrada.id ?? novoId(agora.getTime()),
      turmaId: entrada.turmaId,
      // A data da AULA, não a do envio (RN-06). O dispositivo pode ficar dias
      // offline; a chamada sincroniza depois mas pertence ao dia em que ocorreu.
      data: entrada.data ?? DataCivil.deInstante(agora),
      realizadaEm: agora.toISOString(),
      origem: entrada.origem ?? 'manual',
      totalDetectado: null,
      confirmada: false,
      criadaOffline: entrada.criadaOffline ?? false,
      presencas: [],
    });
  }

  static reconstituir(dados: DadosChamada): Chamada {
    return new Chamada(dados);
  }

  get id(): Id {
    return this.estado.id;
  }
  get turmaId(): Id {
    return this.estado.turmaId;
  }
  get data(): DataCivil {
    return this.estado.data;
  }
  get origem(): OrigemChamada {
    return this.estado.origem;
  }
  get confirmada(): boolean {
    return this.estado.confirmada;
  }
  get criadaOffline(): boolean {
    return this.estado.criadaOffline;
  }
  get presencas(): readonly DadosPresenca[] {
    return this.estado.presencas;
  }
  get totalDePresentes(): number {
    return this.estado.presencas.length;
  }

  dados(): DadosChamada {
    return { ...this.estado, presencas: [...this.estado.presencas] };
  }

  temPresencaDe(alunoId: Id): boolean {
    return this.estado.presencas.some((p) => p.alunoId === alunoId);
  }

  /**
   * RN-03: um aluno, uma presença. Chamar duas vezes para o mesmo aluno é
   * idempotente, não um erro — o fato desejado já é verdade. Tratar como erro
   * faria um duplo toque acidental quebrar a chamada no meio do tatame.
   */
  marcarPresenca(
    alunoId: Id,
    opcoes: {
      origem?: OrigemPresenca;
      confianca?: number | null;
      id?: Id;
      agora?: Date;
    } = {},
  ): void {
    this.garantirEditavel();
    if (this.temPresencaDe(alunoId)) return;

    const origem = opcoes.origem ?? 'manual';
    const confianca = origem === 'manual' ? null : (opcoes.confianca ?? null);

    if (origem === 'automatica' && confianca === null) {
      throw new InvarianteViolada(
        'Presença automática exige uma pontuação de confiança.',
      );
    }
    if (confianca !== null && (confianca < 0 || confianca > 1)) {
      throw new InvarianteViolada(
        `Confiança fora do intervalo [0, 1]: ${confianca}.`,
      );
    }

    const agora = opcoes.agora ?? new Date();
    this.estado = {
      ...this.estado,
      presencas: [
        ...this.estado.presencas,
        {
          id: opcoes.id ?? novoId(agora.getTime()),
          chamadaId: this.estado.id,
          alunoId,
          origem,
          confianca,
          registradaEm: agora.toISOString(),
        },
      ],
    };
  }

  desmarcarPresenca(alunoId: Id): void {
    this.garantirEditavel();
    this.estado = {
      ...this.estado,
      presencas: this.estado.presencas.filter((p) => p.alunoId !== alunoId),
    };
  }

  /** RF-18: um toque alterna o estado. Retorna o estado resultante. */
  alternarPresenca(alunoId: Id, agora: Date = new Date()): boolean {
    if (this.temPresencaDe(alunoId)) {
      this.desmarcarPresenca(alunoId);
      return false;
    }
    this.marcarPresenca(alunoId, { agora });
    return true;
  }

  confirmar(): void {
    this.estado = { ...this.estado, confirmada: true };
  }

  /**
   * RF-14 da spec de chamada: chamada confirmada é editável dentro de um
   * período de carência.
   *
   * ⚠️ OQ-03 de chamada-e-presenca: a duração da carência não foi definida
   * pelo professor. Premissa adotada: 24 horas a partir da realização.
   */
  static readonly CARENCIA_DE_EDICAO_MS = 24 * 60 * 60 * 1000;

  editavelEm(agora: Date = new Date()): boolean {
    if (!this.estado.confirmada) return true;
    const decorrido = agora.getTime() - Date.parse(this.estado.realizadaEm);
    return decorrido <= Chamada.CARENCIA_DE_EDICAO_MS;
  }

  reabrir(agora: Date = new Date()): void {
    if (!this.editavelEm(agora)) {
      throw new InvarianteViolada(
        'O prazo para editar esta chamada já passou. Ela é somente leitura.',
      );
    }
    this.estado = { ...this.estado, confirmada: false };
  }

  private garantirEditavel(agora: Date = new Date()): void {
    if (!this.editavelEm(agora)) {
      throw new InvarianteViolada(
        'O prazo para editar esta chamada já passou. Ela é somente leitura.',
      );
    }
  }
}
