/**
 * Log estruturado mínimo.
 *
 * Sem APM e sem tracing distribuído: operador único (NG-05 de
 * fundacao-arquitetural). O que importa é poder reconstruir o que aconteceu
 * com a fila depois de um dia offline.
 *
 * ⚠️ Nenhum dado pessoal entra no log. Nome de aluno, data de nascimento e
 * faixa ficam de fora; apenas identificadores e contagens.
 */

export type Nivel = 'debug' | 'info' | 'aviso' | 'erro';

export interface EventoDeLog {
  readonly ts: string;
  readonly nivel: Nivel;
  readonly evento: string;
  readonly dados?: Record<string, string | number | boolean | null>;
}

const CAMPOS_PROIBIDOS = new Set([
  'nome',
  'data_nascimento',
  'dataNascimento',
  'email',
  'faixa',
  'faixa_atual',
]);

function higienizar(
  dados: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!dados) return undefined;
  const saida: Record<string, string | number | boolean | null> = {};
  for (const [chave, valor] of Object.entries(dados)) {
    if (CAMPOS_PROIBIDOS.has(chave)) continue;
    if (
      typeof valor === 'string' ||
      typeof valor === 'number' ||
      typeof valor === 'boolean' ||
      valor === null
    ) {
      saida[chave] = valor;
    }
  }
  return saida;
}

export const log = {
  registrar(nivel: Nivel, evento: string, dados?: Record<string, unknown>): void {
    const linha: EventoDeLog = {
      ts: new Date().toISOString(),
      nivel,
      evento,
      ...(higienizar(dados) ? { dados: higienizar(dados)! } : {}),
    };
    const metodo = nivel === 'erro' ? 'error' : nivel === 'aviso' ? 'warn' : 'log';
    // eslint-disable-next-line no-console
    console[metodo](JSON.stringify(linha));
  },
  info(evento: string, dados?: Record<string, unknown>): void {
    log.registrar('info', evento, dados);
  },
  aviso(evento: string, dados?: Record<string, unknown>): void {
    log.registrar('aviso', evento, dados);
  },
  erro(evento: string, dados?: Record<string, unknown>): void {
    log.registrar('erro', evento, dados);
  },
};
