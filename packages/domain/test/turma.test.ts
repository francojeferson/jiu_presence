import { describe, expect, it } from 'vitest';
import { Matricula, Turma } from '../src/turma/turma.js';
import { DataCivil } from '../src/valor/data.js';
import { novoId } from '../src/valor/identidade.js';
import {
  CampoObrigatorio,
  ExclusaoBloqueadaPorHistorico,
  ValorInvalido,
} from '../src/erros.js';

const ALUNO = novoId();
const TURMA = novoId();

function turmaNoite() {
  // Segunda, quarta e sexta às 19h.
  return Turma.criar({ nome: 'Adulto Noite', diasSemana: [1, 3, 5], horario: '19:00' });
}

describe('Turma', () => {
  it('cria com nome, dias e horário', () => {
    const turma = turmaNoite();
    expect(turma.nome).toBe('Adulto Noite');
    expect(turma.diasSemana).toEqual([1, 3, 5]);
    expect(turma.horario).toBe('19:00');
    expect(turma.ativa).toBe(true);
  });

  it('exige nome', () => {
    expect(() =>
      Turma.criar({ nome: '  ', diasSemana: [1], horario: '19:00' }),
    ).toThrow(CampoObrigatorio);
  });

  it('ordena e desduplica os dias da semana', () => {
    const turma = Turma.criar({
      nome: 'Bagunçada',
      diasSemana: [5, 1, 3, 1],
      horario: '07:00',
    });
    expect(turma.diasSemana).toEqual([1, 3, 5]);
  });

  it('recusa dia da semana fora do intervalo', () => {
    expect(() =>
      Turma.criar({ nome: 'X', diasSemana: [7], horario: '19:00' }),
    ).toThrow(ValorInvalido);
    expect(() =>
      Turma.criar({ nome: 'X', diasSemana: [-1], horario: '19:00' }),
    ).toThrow(ValorInvalido);
  });

  it('recusa horário em formato inválido', () => {
    expect(() =>
      Turma.criar({ nome: 'X', diasSemana: [1], horario: '19h' }),
    ).toThrow(ValorInvalido);
    expect(() =>
      Turma.criar({ nome: 'X', diasSemana: [1], horario: '25:00' }),
    ).toThrow(ValorInvalido);
  });

  it('aceita turma sem dias definidos', () => {
    const turma = Turma.criar({ nome: 'Avulsa', diasSemana: [], horario: '10:00' });
    expect(turma.diasSemana).toEqual([]);
  });

  describe('grade', () => {
    it('reconhece os dias em que tem aula', () => {
      const turma = turmaNoite();
      expect(turma.temAulaEm(DataCivil.deIso('2026-10-05'))).toBe(true); // segunda
      expect(turma.temAulaEm(DataCivil.deIso('2026-10-07'))).toBe(true); // quarta
    });

    it('reconhece os dias em que não tem aula', () => {
      const turma = turmaNoite();
      expect(turma.temAulaEm(DataCivil.deIso('2026-10-04'))).toBe(false); // domingo
      expect(turma.temAulaEm(DataCivil.deIso('2026-10-06'))).toBe(false); // terça
    });

    // EC-12: a grade orienta, não restringe. Aula extra e reposição são
    // permitidas com confirmação; a decisão fica na camada de aplicação.
  });

  describe('ciclo de vida', () => {
    it('desativa e reativa', () => {
      const turma = turmaNoite();
      turma.desativar();
      expect(turma.ativa).toBe(false);
      turma.reativar();
      expect(turma.ativa).toBe(true);
    });

    it('recusa excluir turma com chamadas registradas', () => {
      expect(() => turmaNoite().garantirQuePodeSerExcluida(3)).toThrow(
        ExclusaoBloqueadaPorHistorico,
      );
    });

    it('permite excluir turma sem chamadas', () => {
      expect(() => turmaNoite().garantirQuePodeSerExcluida(0)).not.toThrow();
    });
  });

  it('reconstitui a partir de dados persistidos', () => {
    const original = turmaNoite();
    const copia = Turma.reconstituir(original.dados());
    expect(copia.id).toBe(original.id);
    expect(copia.diasSemana).toEqual(original.diasSemana);
  });
});

describe('Matricula', () => {
  it('nasce vigente', () => {
    expect(Matricula.criar(ALUNO, TURMA).vigente).toBe(true);
  });

  it('referencia os agregados por identidade, não por objeto', () => {
    const matricula = Matricula.criar(ALUNO, TURMA);
    expect(matricula.alunoId).toBe(ALUNO);
    expect(matricula.turmaId).toBe(TURMA);
  });

  it('deixa de ser vigente ao encerrar', () => {
    const matricula = Matricula.criar(ALUNO, TURMA, DataCivil.deIso('2026-01-10'));
    matricula.encerrar(DataCivil.deIso('2026-06-30'));
    expect(matricula.vigente).toBe(false);
  });

  it('encerrar duas vezes é idempotente', () => {
    const matricula = Matricula.criar(ALUNO, TURMA, DataCivil.deIso('2026-01-10'));
    matricula.encerrar(DataCivil.deIso('2026-06-30'));
    matricula.encerrar(DataCivil.deIso('2026-07-30'));
    expect(matricula.dados().desmatriculadoEm?.iso).toBe('2026-06-30');
  });

  it('recusa desmatrícula anterior à matrícula', () => {
    const matricula = Matricula.criar(ALUNO, TURMA, DataCivil.deIso('2026-06-01'));
    expect(() => matricula.encerrar(DataCivil.deIso('2026-01-01'))).toThrow(
      ValorInvalido,
    );
  });

  describe('vigência em uma data', () => {
    const matricula = Matricula.reconstituir({
      alunoId: ALUNO,
      turmaId: TURMA,
      matriculadoEm: DataCivil.deIso('2026-03-01'),
      desmatriculadoEm: DataCivil.deIso('2026-08-31'),
    });

    it('não vale antes da matrícula', () => {
      expect(matricula.vigenteEm(DataCivil.deIso('2026-02-28'))).toBe(false);
    });

    it('vale no dia da matrícula', () => {
      expect(matricula.vigenteEm(DataCivil.deIso('2026-03-01'))).toBe(true);
    });

    it('vale durante o período', () => {
      expect(matricula.vigenteEm(DataCivil.deIso('2026-05-15'))).toBe(true);
    });

    it('vale no dia da desmatrícula', () => {
      // EC-10: presenças anteriores à saída permanecem válidas.
      expect(matricula.vigenteEm(DataCivil.deIso('2026-08-31'))).toBe(true);
    });

    it('não vale depois da desmatrícula', () => {
      expect(matricula.vigenteEm(DataCivil.deIso('2026-09-01'))).toBe(false);
    });

    it('matrícula aberta vale indefinidamente', () => {
      const aberta = Matricula.criar(ALUNO, TURMA, DataCivil.deIso('2026-01-01'));
      expect(aberta.vigenteEm(DataCivil.deIso('2030-01-01'))).toBe(true);
    });
  });
});
