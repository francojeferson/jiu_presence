/**
 * Porta do reconhecimento facial — DECLARADA, NÃO IMPLEMENTADA (D-13).
 *
 * Esta feature entrega a chamada manual. O pipeline facial depende de um
 * spike de validação que ainda não foi executado e que tem critério de
 * abandono explícito em _reversa_sdd/sdd/biometria-facial-on-device.md §13.
 *
 * A porta existe aqui por duas razões:
 *
 * 1. Fixa o ponto de extensão antes de haver pressa para construí-lo, o que
 *    evita que a biometria seja enxertada em qualquer lugar depois.
 *
 * 2. O tipo da assinatura torna estruturalmente impossível uma implementação
 *    remota: o método recebe bytes de imagem e devolve candidatos pontuados,
 *    sem nenhuma noção de endpoint. Inferência no dispositivo é restrição de
 *    arquitetura, não de boa vontade (RF-05 daquela spec).
 *
 * ⚠️ A dimensionalidade do embedding é SAÍDA do spike, não entrada. Por isso
 * `Embedding` é agnóstico ao tamanho e nenhuma coluna `vector(N)` foi criada
 * nas migrações desta feature (risco R4 do PRD).
 */

import type { Id } from '../valor/identidade.js';

/** Vetor de características de um rosto. Dimensão definida pelo modelo. */
export interface Embedding {
  readonly vetor: Float32Array;
  readonly modeloId: string;
  readonly modeloVersao: string;
}

export interface RostoDetectado {
  readonly caixa: { x: number; y: number; largura: number; altura: number };
  readonly qualidade: number | null;
  readonly embedding: Embedding;
}

export interface CandidatoPontuado {
  readonly alunoId: Id;
  readonly similaridade: number;
}

export type ClassificacaoDeRosto = 'reconhecido' | 'ambiguo' | 'desconhecido';

export interface RostoClassificado {
  readonly rosto: RostoDetectado;
  readonly candidatos: readonly CandidatoPontuado[];
  readonly classificacao: ClassificacaoDeRosto;
}

export interface ServicoDeReconhecimentoFacial {
  /** Garante que os modelos estão carregados. Exige rede na primeira vez. */
  preparar(): Promise<void>;

  /**
   * Processa uma imagem no DISPOSITIVO e devolve os rostos classificados
   * contra os candidatos informados.
   *
   * @param candidatos embeddings dos alunos da turma. Restringir ao recorte
   *                   da turma é a mitigação mais barata do risco R1.
   */
  processar(
    imagem: Blob,
    candidatos: ReadonlyMap<Id, readonly Embedding[]>,
    aoProgredir?: (processados: number, total: number) => void,
  ): Promise<readonly RostoClassificado[]>;

  /** Extrai o embedding de um rosto único, para o cadastro. */
  extrairRostoUnico(imagem: Blob): Promise<Embedding>;
}
