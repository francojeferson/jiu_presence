/**
 * Data civil, sem horário e sem fuso.
 *
 * Existe porque a data da aula é um fato civil, não um instante: uma chamada
 * de 4 de outubro continua sendo de 4 de outubro independentemente do fuso de
 * quem lê. Usar `Date` para isso é a origem clássica do bug em que a presença
 * aparece no dia anterior para quem consulta de outro fuso.
 */

import { ValorInvalido } from '../erros.js';

const FORMATO_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export class DataCivil {
  private constructor(
    readonly ano: number,
    readonly mes: number, // 1 a 12
    readonly dia: number,
  ) {
    Object.freeze(this);
  }

  static deIso(texto: string): DataCivil {
    const partes = FORMATO_ISO.exec(texto);
    if (!partes) {
      throw new ValorInvalido(
        `Data em formato inválido: "${texto}". Esperado AAAA-MM-DD.`,
      );
    }
    const ano = Number(partes[1]);
    const mes = Number(partes[2]);
    const dia = Number(partes[3]);

    const referencia = new Date(Date.UTC(ano, mes - 1, dia));
    const coerente =
      referencia.getUTCFullYear() === ano &&
      referencia.getUTCMonth() === mes - 1 &&
      referencia.getUTCDate() === dia;

    if (!coerente) {
      throw new ValorInvalido(`Data inexistente no calendário: "${texto}".`);
    }
    return new DataCivil(ano, mes, dia);
  }

  /** Data civil correspondente a um instante, no fuso local do dispositivo. */
  static deInstante(instante: Date): DataCivil {
    return new DataCivil(
      instante.getFullYear(),
      instante.getMonth() + 1,
      instante.getDate(),
    );
  }

  static hoje(agora: Date = new Date()): DataCivil {
    return DataCivil.deInstante(agora);
  }

  get iso(): string {
    const mm = String(this.mes).padStart(2, '0');
    const dd = String(this.dia).padStart(2, '0');
    return `${this.ano}-${mm}-${dd}`;
  }

  /** Dia da semana: 0 = domingo .. 6 = sábado. */
  get diaDaSemana(): number {
    return new Date(Date.UTC(this.ano, this.mes - 1, this.dia)).getUTCDay();
  }

  igual(outra: DataCivil): boolean {
    return this.iso === outra.iso;
  }

  anteriorA(outra: DataCivil): boolean {
    return this.iso < outra.iso;
  }

  /**
   * Idade completa em anos nesta data de referência.
   * Retorna `null` quando não há data de nascimento.
   */
  static idadeEm(
    nascimento: DataCivil | null,
    referencia: DataCivil,
  ): number | null {
    if (nascimento === null) return null;
    let idade = referencia.ano - nascimento.ano;
    const aindaNaoFezAniversario =
      referencia.mes < nascimento.mes ||
      (referencia.mes === nascimento.mes && referencia.dia < nascimento.dia);
    if (aindaNaoFezAniversario) idade -= 1;
    return idade;
  }

  toString(): string {
    return this.iso;
  }

  /** Formato brasileiro, para exibição e relatórios (RF-14 de relatórios). */
  get brasileiro(): string {
    const mm = String(this.mes).padStart(2, '0');
    const dd = String(this.dia).padStart(2, '0');
    return `${dd}/${mm}/${this.ano}`;
  }
}
