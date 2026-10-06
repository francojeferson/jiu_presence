import { describe, expect, it } from 'vitest';
import { Chamada } from '../src/chamada/chamada.js';
import { DataCivil } from '../src/valor/data.js';
import { novoId } from '../src/valor/identidade.js';
import { InvarianteViolada } from '../src/erros.js';

const TURMA = novoId();
const ALUNO_A = novoId();
const ALUNO_B = novoId();
const HOJE = DataCivil.deIso('2026-10-04');

function chamadaAberta() {
  return Chamada.abrir({ turmaId: TURMA, data: HOJE });
}

describe('Chamada', () => {
  describe('abertura', () => {
    it('abre vazia e não confirmada', () => {
      const chamada = chamadaAberta();
      expect(chamada.totalDePresentes).toBe(0);
      expect(chamada.confirmada).toBe(false);
    });

    it('nasce com origem manual por padrão', () => {
      expect(chamadaAberta().origem).toBe('manual');
    });

    it('usa a data da aula, não a do envio', () => {
      // RN-06: o dispositivo pode ficar dias offline. A chamada sincroniza
      // depois mas pertence ao dia em que a aula ocorreu.
      const dataDaAula = DataCivil.deIso('2026-09-28');
      const chamada = Chamada.abrir({
        turmaId: TURMA,
        data: dataDaAula,
        agora: new Date('2026-10-04T20:00:00Z'),
      });
      expect(chamada.data.iso).toBe('2026-09-28');
    });

    it('marca quando foi criada offline', () => {
      const chamada = Chamada.abrir({ turmaId: TURMA, criadaOffline: true });
      expect(chamada.criadaOffline).toBe(true);
    });
  });

  describe('invariante de aluno único (RN-03)', () => {
    it('não registra o mesmo aluno duas vezes', () => {
      const chamada = chamadaAberta();
      chamada.marcarPresenca(ALUNO_A);
      chamada.marcarPresenca(ALUNO_A);
      expect(chamada.totalDePresentes).toBe(1);
    });

    it('marcar duas vezes é idempotente, não um erro', () => {
      // Duplo toque acidental no tatame não pode quebrar a chamada.
      const chamada = chamadaAberta();
      chamada.marcarPresenca(ALUNO_A);
      expect(() => chamada.marcarPresenca(ALUNO_A)).not.toThrow();
    });

    it('registra alunos distintos separadamente', () => {
      const chamada = chamadaAberta();
      chamada.marcarPresenca(ALUNO_A);
      chamada.marcarPresenca(ALUNO_B);
      expect(chamada.totalDePresentes).toBe(2);
    });
  });

  describe('marcação', () => {
    it('alterna o estado a cada toque', () => {
      const chamada = chamadaAberta();
      expect(chamada.alternarPresenca(ALUNO_A)).toBe(true);
      expect(chamada.temPresencaDe(ALUNO_A)).toBe(true);
      expect(chamada.alternarPresenca(ALUNO_A)).toBe(false);
      expect(chamada.temPresencaDe(ALUNO_A)).toBe(false);
    });

    it('desmarcar aluno ausente não faz nada', () => {
      const chamada = chamadaAberta();
      expect(() => chamada.desmarcarPresenca(ALUNO_A)).not.toThrow();
      expect(chamada.totalDePresentes).toBe(0);
    });

    it('presença manual não carrega confiança', () => {
      const chamada = chamadaAberta();
      chamada.marcarPresenca(ALUNO_A);
      expect(chamada.presencas[0]?.confianca).toBeNull();
      expect(chamada.presencas[0]?.origem).toBe('manual');
    });

    it('presença manual ignora confiança informada por engano', () => {
      const chamada = chamadaAberta();
      chamada.marcarPresenca(ALUNO_A, { origem: 'manual', confianca: 0.9 });
      expect(chamada.presencas[0]?.confianca).toBeNull();
    });

    it('presença automática exige confiança', () => {
      const chamada = chamadaAberta();
      expect(() =>
        chamada.marcarPresenca(ALUNO_A, { origem: 'automatica' }),
      ).toThrow(InvarianteViolada);
    });

    it('presença automática aceita confiança no intervalo [0,1]', () => {
      const chamada = chamadaAberta();
      chamada.marcarPresenca(ALUNO_A, { origem: 'automatica', confianca: 0.91 });
      expect(chamada.presencas[0]?.confianca).toBeCloseTo(0.91);
    });

    it('recusa confiança fora do intervalo', () => {
      const chamada = chamadaAberta();
      expect(() =>
        chamada.marcarPresenca(ALUNO_A, { origem: 'automatica', confianca: 1.5 }),
      ).toThrow(InvarianteViolada);
      expect(() =>
        chamada.marcarPresenca(ALUNO_B, { origem: 'automatica', confianca: -0.1 }),
      ).toThrow(InvarianteViolada);
    });

    it('toda presença pertence à chamada que a criou', () => {
      const chamada = chamadaAberta();
      chamada.marcarPresenca(ALUNO_A);
      expect(chamada.presencas[0]?.chamadaId).toBe(chamada.id);
    });
  });

  describe('confirmação e carência de edição', () => {
    it('chamada não confirmada é sempre editável', () => {
      expect(chamadaAberta().editavelEm(new Date('2030-01-01'))).toBe(true);
    });

    it('chamada confirmada continua editável dentro da carência', () => {
      const agora = new Date('2026-10-04T19:00:00Z');
      const chamada = Chamada.abrir({ turmaId: TURMA, agora });
      chamada.confirmar();
      const umaHoraDepois = new Date(agora.getTime() + 60 * 60 * 1000);
      expect(chamada.editavelEm(umaHoraDepois)).toBe(true);
    });

    it('chamada confirmada vira somente leitura após a carência', () => {
      const agora = new Date('2026-10-04T19:00:00Z');
      const chamada = Chamada.abrir({ turmaId: TURMA, agora });
      chamada.confirmar();
      const doisDiasDepois = new Date(agora.getTime() + 48 * 60 * 60 * 1000);
      expect(chamada.editavelEm(doisDiasDepois)).toBe(false);
      expect(() => chamada.reabrir(doisDiasDepois)).toThrow(InvarianteViolada);
    });

    it('reabre dentro da carência', () => {
      const chamada = chamadaAberta();
      chamada.confirmar();
      chamada.reabrir();
      expect(chamada.confirmada).toBe(false);
    });
  });

  it('reconstitui a partir de dados persistidos', () => {
    const original = chamadaAberta();
    original.marcarPresenca(ALUNO_A);
    original.confirmar();

    const copia = Chamada.reconstituir(original.dados());
    expect(copia.id).toBe(original.id);
    expect(copia.totalDePresentes).toBe(1);
    expect(copia.confirmada).toBe(true);
    expect(copia.temPresencaDe(ALUNO_A)).toBe(true);
  });

  it('dados() devolve cópia da lista de presenças', () => {
    const chamada = chamadaAberta();
    chamada.marcarPresenca(ALUNO_A);
    const dados = chamada.dados();
    (dados.presencas as unknown[]).push({});
    expect(chamada.totalDePresentes).toBe(1);
  });
});
