/**
 * Cota de armazenamento local (RF-32, EC-05).
 *
 * A regra que não pode ser quebrada: quando a cota esgota, o sistema alerta e
 * IMPEDE a nova escrita antes de perder dado. Jamais remove item da fila para
 * abrir espaço. O cache é descartável; a fila não é.
 */

export interface SituacaoDaCota {
  readonly usadoBytes: number;
  readonly disponivelBytes: number;
  readonly percentualUsado: number;
  readonly critica: boolean;
}

/** Acima disto, novas escritas são bloqueadas e o professor é alertado. */
export const LIMIAR_CRITICO = 0.92;

/** Acima deste número de pendências, alertar que é hora de conectar (RF-14). */
export const LIMITE_DE_PENDENCIAS_PARA_ALERTA = 50;

export class ErroDeCotaEsgotada extends Error {
  readonly codigo = 'COTA_ESGOTADA';
  constructor(readonly situacao: SituacaoDaCota) {
    super(
      'O armazenamento do dispositivo está cheio. Libere espaço antes de ' +
        'registrar novas chamadas — nada do que já foi registrado será perdido.',
    );
    this.name = 'ErroDeCotaEsgotada';
  }
}

export async function situacaoDaCota(): Promise<SituacaoDaCota | null> {
  const navegador = globalThis.navigator as Navigator | undefined;
  if (!navegador?.storage?.estimate) return null;

  const estimativa = await navegador.storage.estimate();
  const usado = estimativa.usage ?? 0;
  const total = estimativa.quota ?? 0;
  if (total === 0) return null;

  const percentual = usado / total;
  return {
    usadoBytes: usado,
    disponivelBytes: total - usado,
    percentualUsado: percentual,
    critica: percentual >= LIMIAR_CRITICO,
  };
}

/**
 * Chamado antes de cada escrita. Lança quando a cota está crítica.
 *
 * Quando o navegador não expõe a estimativa, deixa passar: bloquear a chamada
 * por ausência de informação seria pior do que o risco que se pretende evitar.
 */
export async function garantirEspacoParaEscrita(): Promise<void> {
  const situacao = await situacaoDaCota();
  if (situacao?.critica) throw new ErroDeCotaEsgotada(situacao);
}

/**
 * Pede ao navegador que o armazenamento seja persistente, para reduzir a
 * chance de despejo automático sob pressão de espaço. Chamado uma vez na
 * inicialização. Falhar aqui não é erro: é só uma proteção a menos.
 */
export async function solicitarArmazenamentoPersistente(): Promise<boolean> {
  const navegador = globalThis.navigator as Navigator | undefined;
  if (!navegador?.storage?.persist) return false;
  try {
    if (await navegador.storage.persisted()) return true;
    return await navegador.storage.persist();
  } catch {
    return false;
  }
}
