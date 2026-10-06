/**
 * Schemas de fronteira.
 *
 * Fonte ÚNICA de validação e de tipo (D-17): o tipo é derivado do schema, não
 * declarado em paralelo. Tipo manual mais validação separada divergem com o
 * tempo, e a divergência aparece justamente quando o dado vem de fora.
 *
 * Isto é a fronteira entre o mundo externo (linhas do Postgres, JSON do
 * outbox) e o domínio. Nada daqui conhece as entidades: `contracts` é folha,
 * verificado pela regra `contracts-e-folha`.
 */

import { z } from 'zod';

export const idSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Identificador em formato inválido.',
  );

export const dataIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar em AAAA-MM-DD.');

export const horarioSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário deve estar em HH:MM.');

export const escalaSchema = z.enum(['adulta', 'infantil']);
export const origemChamadaSchema = z.enum(['manual', 'foto', 'mista']);
export const origemPresencaSchema = z.enum(['manual', 'automatica']);

// ------------------------------------------------------------------ linhas

/** Linha da tabela `aluno`, como o PostgREST devolve. */
export const linhaAlunoSchema = z.object({
  id: idSchema,
  nome: z.string().min(1),
  data_nascimento: dataIsoSchema.nullable(),
  escala: escalaSchema,
  faixa_atual: z.string().min(1),
  data_ultima_graduacao: dataIsoSchema.nullable(),
  ativo: z.boolean(),
  criado_em: z.string(),
  atualizado_em: z.string(),
});

export const linhaTurmaSchema = z.object({
  id: idSchema,
  nome: z.string().min(1),
  dias_semana: z.array(z.number().int().min(0).max(6)),
  horario: z.string(),
  ativa: z.boolean(),
  criado_em: z.string(),
});

export const linhaMatriculaSchema = z.object({
  aluno_id: idSchema,
  turma_id: idSchema,
  matriculado_em: dataIsoSchema,
  desmatriculado_em: dataIsoSchema.nullable(),
});

export const linhaChamadaSchema = z.object({
  id: idSchema,
  turma_id: idSchema,
  data: dataIsoSchema,
  realizada_em: z.string(),
  origem: origemChamadaSchema,
  total_detectado: z.number().int().nullable(),
  confirmada: z.boolean(),
  criada_offline: z.boolean(),
});

export const linhaPresencaSchema = z.object({
  id: idSchema,
  chamada_id: idSchema,
  aluno_id: idSchema,
  origem: origemPresencaSchema,
  confianca: z.number().min(0).max(1).nullable(),
  registrada_em: z.string(),
});

export type LinhaAluno = z.infer<typeof linhaAlunoSchema>;
export type LinhaTurma = z.infer<typeof linhaTurmaSchema>;
export type LinhaMatricula = z.infer<typeof linhaMatriculaSchema>;
export type LinhaChamada = z.infer<typeof linhaChamadaSchema>;
export type LinhaPresenca = z.infer<typeof linhaPresencaSchema>;

// ------------------------------------------------------- payloads do outbox

/**
 * O payload de cada tipo de operação da fila.
 *
 * Validado na LEITURA, não só na escrita: um item pode ter sido gravado por
 * uma versão anterior do app e ficado dias na fila (EC-07 de
 * sincronizacao-offline-first). Ler sem validar faria o sincronizador
 * enviar lixo e classificar o resultado como falha permanente.
 */
export const payloadPorTipo = {
  criar_aluno: linhaAlunoSchema,
  atualizar_aluno: linhaAlunoSchema,
  inativar_aluno: z.object({ id: idSchema, ativo: z.literal(false) }),
  criar_turma: linhaTurmaSchema,
  atualizar_turma: linhaTurmaSchema,
  criar_matricula: linhaMatriculaSchema,
  encerrar_matricula: linhaMatriculaSchema,
  criar_chamada: linhaChamadaSchema,
  confirmar_chamada: z.object({ id: idSchema, confirmada: z.literal(true) }),
  criar_presenca: linhaPresencaSchema,
  remover_presenca: z.object({ id: idSchema }),
} as const;

export type TipoDePayload = keyof typeof payloadPorTipo;

// -------------------------------------------------------- entrada das telas

export const entradaDeAlunoSchema = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome do aluno.'),
    dataNascimento: dataIsoSchema.optional(),
    escala: escalaSchema.optional(),
    faixa: z.string().min(1, 'Escolha a faixa atual.'),
    dataUltimaGraduacao: dataIsoSchema.optional(),
    turmaIds: z.array(idSchema).optional(),
  })
  .refine((v) => v.dataNascimento !== undefined || v.escala !== undefined, {
    // EC-02: sem data de nascimento, o professor precisa escolher a escala.
    // Presumir "adulta" daria o seletor de faixa errado para toda criança.
    message:
      'Sem data de nascimento, informe se o aluno segue a graduação adulta ou a infantil.',
    path: ['escala'],
  });

export const entradaDeTurmaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da turma.'),
  diasSemana: z.array(z.number().int().min(0).max(6)),
  horario: horarioSchema,
});

export type EntradaDeAluno = z.infer<typeof entradaDeAlunoSchema>;
export type EntradaDeTurma = z.infer<typeof entradaDeTurmaSchema>;

// ------------------------------------------------------------- validação

export class DadosEmFormatoInesperado extends Error {
  constructor(
    readonly origem: string,
    readonly detalhe: string,
  ) {
    super(`Dados de ${origem} em formato inesperado: ${detalhe}`);
    this.name = 'DadosEmFormatoInesperado';
  }
}

/**
 * Valida uma lista vinda de fora.
 *
 * Exportado para que as outras camadas não precisem importar Zod: `contracts`
 * é o único pacote que conhece a biblioteca de validação, e trocá-la não
 * deve tocar em mais nada.
 *
 * Validar na fronteira não é cerimônia. Uma coluna renomeada no servidor sem
 * migração correspondente no cliente produziria `undefined` silencioso e um
 * aluno sem nome na tela da chamada.
 */
export function validarLista<T>(
  schema: z.ZodType<T>,
  dados: unknown,
  origem: string,
): T[] {
  const resultado = z.array(schema).safeParse(dados ?? []);
  if (!resultado.success) {
    throw new DadosEmFormatoInesperado(
      origem,
      resultado.error.issues[0]?.message ?? 'estrutura desconhecida',
    );
  }
  return resultado.data;
}

export type Schema<T> = z.ZodType<T>;
