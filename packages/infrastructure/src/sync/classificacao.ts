/**
 * Classificação da resposta do servidor (interfaces/sync-outbox.md §4).
 *
 * É o ponto mais delicado do protocolo de sincronização, e o lugar onde um
 * erro custa dado.
 *
 * O caso que exige atenção é o 409. Conflito na CHAVE PRIMÁRIA significa
 * "você já me mandou isso" e é SUCESSO idempotente. Conflito na UNICIDADE DE
 * NEGÓCIO com id diferente significa "outro registro ocupa esse lugar" e é
 * falha permanente. Tratar os dois igual quebra a idempotência ou perde dado,
 * dependendo do lado para o qual se erre.
 *
 * Há ainda uma assimetria entre entidades:
 *
 *   chamada  — conflito em (turma_id, data) com id diferente é CONFLITO REAL.
 *              Existe outra chamada ocupando aquele dia (EC-10).
 *
 *   presenca — conflito em (chamada_id, aluno_id) é SUCESSO. A intenção era
 *              "este aluno esteve presente nesta chamada", e isso já é
 *              verdade. Não há informação a perder.
 */

import type { TipoDeOperacao } from '../local/db.js';

export type Classificacao = 'sucesso' | 'transitorio' | 'permanente';

export interface RespostaDoServidor {
  readonly status: number;
  /** Código do PostgREST, ex.: '23505' para unique_violation. */
  readonly codigo?: string | undefined;
  /** Nome da constraint violada, extraído da mensagem do Postgres. */
  readonly constraint?: string | undefined;
  readonly mensagem?: string | undefined;
}

const CONSTRAINTS_IDEMPOTENTES = new Set([
  // Chave primária: o item já havia sido gravado em tentativa anterior.
  'chamada_pkey',
  'presenca_pkey',
  'aluno_pkey',
  'turma_pkey',
  'matricula_pkey',
  'operador_pkey',
  // Unicidade de negócio cujo conflito significa que o fato desejado já é
  // verdade.
  'presenca_unica_por_chamada_e_aluno',
]);

const CONSTRAINTS_DE_CONFLITO_REAL = new Set([
  // Outra chamada ocupa aquele turma+data. Precisa de decisão do professor.
  'chamada_unica_por_turma_e_data',
]);

const STATUS_TRANSITORIOS = new Set([401, 408, 429, 500, 502, 503, 504]);

export function classificar(
  resposta: RespostaDoServidor,
  tipo: TipoDeOperacao,
): Classificacao {
  const { status, codigo, constraint } = resposta;

  if (status >= 200 && status < 300) return 'sucesso';

  // Violação de chave estrangeira ANTES do tratamento genérico de 409: o
  // Postgres responde 409 também para FK, e cair no ramo de unicidade abaixo
  // classificaria como permanente um item que só precisa esperar o anterior
  // subir. O resultado seria a presença saindo da fila ativa e o professor
  // tendo que resolver na mão algo que se resolveria sozinho.
  if (codigo === '23503') return 'transitorio';

  if (status === 409 || codigo === '23505') {
    if (constraint && CONSTRAINTS_IDEMPOTENTES.has(constraint)) return 'sucesso';
    if (constraint && CONSTRAINTS_DE_CONFLITO_REAL.has(constraint)) {
      return 'permanente';
    }
    // Constraint desconhecida em conflito: tratar como permanente, porque
    // retentar em laço não resolveria e esconderia o problema do professor.
    return 'permanente';
  }

  // Remoção de algo que já não existe: o estado desejado é o atual.
  if (status === 404 && tipo === 'remover_presenca') return 'sucesso';

  // Atualizar entidade removida no servidor exige decisão do professor.
  if (status === 404) return 'permanente';

  // Dado inválido. Nunca retentar em laço.
  if (status === 400 || status === 422) return 'permanente';

  if (STATUS_TRANSITORIOS.has(status)) return 'transitorio';

  // Qualquer código não previsto é TRANSITÓRIO por desenho: errar para o lado
  // de retentar preserva o dado; errar para o lado de descartar o perde.
  return 'transitorio';
}

/** Traduz a falha para o professor. Nenhum código técnico chega à tela. */
export function mensagemParaOProfessor(
  resposta: RespostaDoServidor,
  tipo: TipoDeOperacao,
): string {
  if (resposta.constraint === 'chamada_unica_por_turma_e_data') {
    return 'Já existe uma chamada registrada para esta turma neste dia.';
  }
  if (resposta.status === 404) {
    return 'O registro que você alterou não existe mais no servidor. ' +
      'Ele pode ter sido removido de outro dispositivo.';
  }
  if (resposta.status === 400 || resposta.status === 422) {
    return 'Algum dado deste registro ficou inválido e o servidor recusou.';
  }
  return `Não foi possível enviar esta alteração (${rotuloDe(tipo)}).`;
}

function rotuloDe(tipo: TipoDeOperacao): string {
  const rotulos: Record<TipoDeOperacao, string> = {
    criar_aluno: 'cadastro de aluno',
    atualizar_aluno: 'edição de aluno',
    inativar_aluno: 'inativação de aluno',
    criar_turma: 'cadastro de turma',
    atualizar_turma: 'edição de turma',
    criar_matricula: 'matrícula',
    encerrar_matricula: 'desmatrícula',
    criar_chamada: 'chamada',
    confirmar_chamada: 'confirmação de chamada',
    criar_presenca: 'presença',
    remover_presenca: 'remoção de presença',
  };
  return rotulos[tipo];
}
