import { describe, expect, it } from 'vitest';
import { DataCivil } from '../src/valor/data.js';
import { ValorInvalido } from '../src/erros.js';

describe('DataCivil', () => {
  it('interpreta uma data ISO', () => {
    const data = DataCivil.deIso('2026-10-04');
    expect(data.ano).toBe(2026);
    expect(data.mes).toBe(10);
    expect(data.dia).toBe(4);
  });

  it('recusa formato inválido', () => {
    expect(() => DataCivil.deIso('04/10/2026')).toThrow(ValorInvalido);
    expect(() => DataCivil.deIso('2026-10')).toThrow(ValorInvalido);
  });

  it('recusa data inexistente no calendário', () => {
    expect(() => DataCivil.deIso('2026-02-30')).toThrow(/inexistente/);
    expect(() => DataCivil.deIso('2026-13-01')).toThrow(/inexistente/);
  });

  it('aceita 29 de fevereiro em ano bissexto', () => {
    expect(DataCivil.deIso('2028-02-29').iso).toBe('2028-02-29');
  });

  it('recusa 29 de fevereiro em ano não bissexto', () => {
    expect(() => DataCivil.deIso('2027-02-29')).toThrow(/inexistente/);
  });

  it('não desloca de dia conforme o fuso', () => {
    // O bug clássico: usar Date para data civil faz a chamada de 4 de outubro
    // aparecer no dia 3 para quem consulta de outro fuso.
    const data = DataCivil.deIso('2026-10-04');
    expect(data.iso).toBe('2026-10-04');
    expect(DataCivil.deIso(data.iso).iso).toBe('2026-10-04');
  });

  it('calcula o dia da semana', () => {
    expect(DataCivil.deIso('2026-10-04').diaDaSemana).toBe(0); // domingo
    expect(DataCivil.deIso('2026-10-05').diaDaSemana).toBe(1); // segunda
    expect(DataCivil.deIso('2026-10-10').diaDaSemana).toBe(6); // sábado
  });

  it('formata em padrão brasileiro', () => {
    expect(DataCivil.deIso('2026-01-09').brasileiro).toBe('09/01/2026');
  });

  it('compara por ordem cronológica', () => {
    const antes = DataCivil.deIso('2026-10-04');
    const depois = DataCivil.deIso('2026-10-05');
    expect(antes.anteriorA(depois)).toBe(true);
    expect(depois.anteriorA(antes)).toBe(false);
    expect(antes.anteriorA(antes)).toBe(false);
  });

  it('compara por valor', () => {
    expect(
      DataCivil.deIso('2026-10-04').igual(DataCivil.deIso('2026-10-04')),
    ).toBe(true);
  });

  describe('idade', () => {
    it('calcula a idade completa', () => {
      const nascimento = DataCivil.deIso('2000-06-15');
      expect(DataCivil.idadeEm(nascimento, DataCivil.deIso('2026-06-15'))).toBe(26);
      expect(DataCivil.idadeEm(nascimento, DataCivil.deIso('2026-10-04'))).toBe(26);
    });

    it('não conta o ano antes do aniversário', () => {
      const nascimento = DataCivil.deIso('2000-12-31');
      expect(DataCivil.idadeEm(nascimento, DataCivil.deIso('2026-12-30'))).toBe(25);
      expect(DataCivil.idadeEm(nascimento, DataCivil.deIso('2026-12-31'))).toBe(26);
    });

    it('devolve null sem data de nascimento', () => {
      expect(DataCivil.idadeEm(null, DataCivil.hoje())).toBeNull();
    });
  });

  it('deriva a data civil de um instante local', () => {
    const instante = new Date(2026, 9, 4, 23, 45);
    expect(DataCivil.deInstante(instante).iso).toBe('2026-10-04');
  });

  it('serializa como ISO', () => {
    expect(`${DataCivil.deIso('2026-10-04')}`).toBe('2026-10-04');
  });
});
