import { describe, expect, it } from 'vitest';
import {
  Faixa,
  FAIXAS_ADULTA,
  FAIXAS_INFANTIL,
  IDADE_CORTE_ESCALA,
  faixasDa,
} from '../src/valor/faixa.js';
import { ValorInvalido } from '../src/erros.js';

describe('Faixa', () => {
  it('cria uma faixa válida da escala adulta', () => {
    const faixa = Faixa.criar('adulta', 'azul');
    expect(faixa.nome).toBe('azul');
    expect(faixa.escala).toBe('adulta');
  });

  it('cria uma faixa válida da escala infantil', () => {
    const faixa = Faixa.criar('infantil', 'laranja');
    expect(faixa.nome).toBe('laranja');
    expect(faixa.escala).toBe('infantil');
  });

  it('recusa faixa que não existe na escala informada', () => {
    // "azul" é adulta; não deve ser aceita como infantil.
    expect(() => Faixa.criar('infantil', 'azul')).toThrow(ValorInvalido);
    // "laranja" é infantil; não deve ser aceita como adulta.
    expect(() => Faixa.criar('adulta', 'laranja')).toThrow(ValorInvalido);
  });

  it('a mensagem de recusa lista as faixas válidas', () => {
    expect(() => Faixa.criar('adulta', 'verde')).toThrow(/branca, azul, roxa/);
  });

  it('recusa escala desconhecida', () => {
    expect(() => Faixa.criar('juvenil' as never, 'branca')).toThrow(
      ValorInvalido,
    );
  });

  it('as duas escalas não se misturam, exceto pela branca', () => {
    const adultas = new Set<string>(FAIXAS_ADULTA);
    const infantis = new Set<string>(FAIXAS_INFANTIL);
    const comuns = [...adultas].filter((f) => infantis.has(f));
    expect(comuns).toEqual(['branca']);
  });

  describe('progressão', () => {
    it('devolve a próxima faixa da mesma escala', () => {
      expect(Faixa.criar('adulta', 'branca').proxima()?.nome).toBe('azul');
      expect(Faixa.criar('adulta', 'roxa').proxima()?.nome).toBe('marrom');
      expect(Faixa.criar('infantil', 'cinza').proxima()?.nome).toBe('amarela');
    });

    it('a próxima faixa permanece na mesma escala', () => {
      const proxima = Faixa.criar('infantil', 'branca').proxima();
      expect(proxima?.escala).toBe('infantil');
    });

    it('não propõe próxima faixa a quem já está na última', () => {
      const preta = Faixa.criar('adulta', 'preta');
      expect(preta.ehMaxima).toBe(true);
      expect(preta.proxima()).toBeNull();

      const verde = Faixa.criar('infantil', 'verde');
      expect(verde.ehMaxima).toBe(true);
      expect(verde.proxima()).toBeNull();
    });

    it('percorre a escala inteira até a última faixa', () => {
      let atual: Faixa | null = Faixa.criar('adulta', 'branca');
      const percorridas: string[] = [];
      while (atual !== null) {
        percorridas.push(atual.nome);
        atual = atual.proxima();
      }
      expect(percorridas).toEqual([...FAIXAS_ADULTA]);
    });
  });

  describe('escala por idade', () => {
    it('usa a escala adulta a partir da idade de corte', () => {
      expect(Faixa.escalaPorIdade(IDADE_CORTE_ESCALA)).toBe('adulta');
      expect(Faixa.escalaPorIdade(25)).toBe('adulta');
    });

    it('usa a escala infantil abaixo da idade de corte', () => {
      expect(Faixa.escalaPorIdade(IDADE_CORTE_ESCALA - 1)).toBe('infantil');
      expect(Faixa.escalaPorIdade(7)).toBe('infantil');
    });

    it('não presume escala quando a idade é desconhecida', () => {
      // EC-02: sem data de nascimento, o professor escolhe explicitamente.
      // Presumir "adulta" daria o seletor errado para toda criança
      // cadastrada sem data.
      expect(Faixa.escalaPorIdade(null)).toBeNull();
    });

    it('não presume escala para idade inválida', () => {
      expect(Faixa.escalaPorIdade(-1)).toBeNull();
      expect(Faixa.escalaPorIdade(Number.NaN)).toBeNull();
    });
  });

  it('é imutável', () => {
    const faixa = Faixa.criar('adulta', 'azul');
    expect(Object.isFrozen(faixa)).toBe(true);
  });

  it('compara por valor, não por referência', () => {
    expect(Faixa.criar('adulta', 'azul').igual(Faixa.criar('adulta', 'azul')))
      .toBe(true);
    expect(
      Faixa.criar('adulta', 'branca').igual(Faixa.criar('infantil', 'branca')),
    ).toBe(false);
  });

  it('faixasDa devolve a lista canônica de cada escala', () => {
    expect(faixasDa('adulta')).toEqual(FAIXAS_ADULTA);
    expect(faixasDa('infantil')).toEqual(FAIXAS_INFANTIL);
  });

  it('serializa como o nome da faixa', () => {
    expect(`${Faixa.criar('adulta', 'marrom')}`).toBe('marrom');
  });
});
