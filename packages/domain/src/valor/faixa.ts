/**
 * Faixa e escala de graduação.
 *
 * Objeto de valor imutável. A lista canônica de faixas vive AQUI e em nenhum
 * outro lugar, por decisão deliberada: a premissa 2 do roadmap registra que a
 * composição da escala infantil ainda não foi confirmada (varia entre
 * federações), e concentrar a lista em um arquivo faz a correção tocar um
 * arquivo e uma constraint de banco, em vez de se espalhar.
 *
 * ⚠️ PREMISSA NÃO CONFIRMADA (roadmap §4, premissa 2):
 *   - corte entre escala infantil e adulta aos 16 anos
 *   - escala infantil: branca, cinza, amarela, laranja, verde
 *   - escala adulta: branca, azul, roxa, marrom, preta
 *   - graus dentro da faixa NÃO são modelados nesta feature
 *
 * Se o professor confirmar outra composição, altere as constantes abaixo e a
 * constraint `aluno_faixa_coerente_com_escala` em
 * infra/supabase/migrations/0003_aluno_turma_matricula.sql.
 */

import { ValorInvalido } from '../erros.js';

export const ESCALAS = ['adulta', 'infantil'] as const;
export type Escala = (typeof ESCALAS)[number];

export const FAIXAS_ADULTA = [
  'branca',
  'azul',
  'roxa',
  'marrom',
  'preta',
] as const;

export const FAIXAS_INFANTIL = [
  'branca',
  'cinza',
  'amarela',
  'laranja',
  'verde',
] as const;

export type FaixaAdulta = (typeof FAIXAS_ADULTA)[number];
export type FaixaInfantil = (typeof FAIXAS_INFANTIL)[number];
export type NomeFaixa = FaixaAdulta | FaixaInfantil;

/** Idade a partir da qual o aluno usa a escala adulta. */
export const IDADE_CORTE_ESCALA = 16;

export function faixasDa(escala: Escala): readonly NomeFaixa[] {
  return escala === 'adulta' ? FAIXAS_ADULTA : FAIXAS_INFANTIL;
}

export class Faixa {
  private constructor(
    readonly escala: Escala,
    readonly nome: NomeFaixa,
  ) {
    Object.freeze(this);
  }

  static criar(escala: Escala, nome: string): Faixa {
    if (!ESCALAS.includes(escala as Escala)) {
      throw new ValorInvalido(`Escala desconhecida: "${escala}".`);
    }
    const validas = faixasDa(escala);
    if (!validas.includes(nome as NomeFaixa)) {
      throw new ValorInvalido(
        `A faixa "${nome}" não existe na escala ${escala}. ` +
          `Faixas válidas: ${validas.join(', ')}.`,
      );
    }
    return new Faixa(escala, nome as NomeFaixa);
  }

  /**
   * Escala sugerida a partir da idade.
   *
   * Retorna `null` quando a idade é desconhecida: nesse caso o professor
   * precisa escolher explicitamente (EC-02 de gestao-de-alunos-e-turmas).
   * Presumir "adulta" por omissão produziria o seletor de faixa errado para
   * toda criança cadastrada sem data de nascimento.
   */
  static escalaPorIdade(idade: number | null): Escala | null {
    if (idade === null || !Number.isFinite(idade) || idade < 0) return null;
    return idade >= IDADE_CORTE_ESCALA ? 'adulta' : 'infantil';
  }

  get indice(): number {
    return faixasDa(this.escala).indexOf(this.nome);
  }

  get ehMaxima(): boolean {
    return this.indice === faixasDa(this.escala).length - 1;
  }

  /**
   * Próxima faixa da mesma escala, ou `null` se já está na última.
   * Usado pela feature de graduação para propor o destino.
   */
  proxima(): Faixa | null {
    if (this.ehMaxima) return null;
    const proximoNome = faixasDa(this.escala)[this.indice + 1]!;
    return new Faixa(this.escala, proximoNome);
  }

  igual(outra: Faixa): boolean {
    return this.escala === outra.escala && this.nome === outra.nome;
  }

  toString(): string {
    return this.nome;
  }
}
