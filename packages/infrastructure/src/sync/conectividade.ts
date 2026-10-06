/**
 * Detecção de conectividade.
 *
 * `navigator.onLine` NÃO é confiável: um portal cativo de Wi-Fi reporta
 * conectado sem internet real, e é exatamente o cenário de uma academia com
 * rede de visitante (EC-01 de sincronizacao-offline-first).
 *
 * Por isso o status da interface serve apenas como GATILHO para tentar. A
 * verdade vem do resultado da requisição.
 */

export type OuvinteDeConectividade = (online: boolean) => void;

export interface SondaDeRede {
  /** Faz uma requisição real e devolve se houve resposta do servidor. */
  verificar(): Promise<boolean>;
}

export const TIMEOUT_DA_SONDA_MS = 5_000;

export class SondaHttp implements SondaDeRede {
  constructor(
    private readonly url: string,
    private readonly chaveAnonima: string,
  ) {}

  async verificar(): Promise<boolean> {
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), TIMEOUT_DA_SONDA_MS);
    try {
      const resposta = await fetch(`${this.url}/rest/v1/`, {
        method: 'HEAD',
        headers: { apikey: this.chaveAnonima },
        signal: controlador.signal,
        cache: 'no-store',
      });
      // Qualquer resposta HTTP prova que há internet real; o código em si
      // não importa aqui.
      return resposta.status > 0;
    } catch {
      return false;
    } finally {
      clearTimeout(limite);
    }
  }
}

export class MonitorDeConectividade {
  private ouvintes = new Set<OuvinteDeConectividade>();
  private ultimoEstado: boolean | null = null;
  private desinscrever: (() => void) | null = null;

  constructor(private readonly sonda: SondaDeRede) {}

  /** Último estado conhecido. `true` por padrão, até a primeira sonda. */
  get online(): boolean {
    return this.ultimoEstado ?? true;
  }

  iniciar(): void {
    if (this.desinscrever !== null) return;

    const aoMudar = (): void => {
      void this.sondar();
    };

    globalThis.addEventListener?.('online', aoMudar);
    globalThis.addEventListener?.('offline', aoMudar);

    this.desinscrever = () => {
      globalThis.removeEventListener?.('online', aoMudar);
      globalThis.removeEventListener?.('offline', aoMudar);
    };

    void this.sondar();
  }

  parar(): void {
    this.desinscrever?.();
    this.desinscrever = null;
  }

  /** Verifica de fato e notifica os ouvintes quando o estado muda. */
  async sondar(): Promise<boolean> {
    // Se a interface diz offline, acreditar: ela erra para o lado otimista,
    // não para o pessimista. Evita uma requisição certamente perdida.
    const navegador = globalThis.navigator as Navigator | undefined;
    const online =
      navegador?.onLine === false ? false : await this.sonda.verificar();

    if (online !== this.ultimoEstado) {
      this.ultimoEstado = online;
      for (const ouvinte of this.ouvintes) ouvinte(online);
    }
    return online;
  }

  /** Registra o resultado observado de uma requisição real do sincronizador. */
  registrarResultado(houveResposta: boolean): void {
    if (houveResposta !== this.ultimoEstado) {
      this.ultimoEstado = houveResposta;
      for (const ouvinte of this.ouvintes) ouvinte(houveResposta);
    }
  }

  observar(ouvinte: OuvinteDeConectividade): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }
}
