import { beforeEach, describe, expect, it } from 'vitest';
import {
  Aluno,
  DataCivil,
  ExclusaoBloqueadaPorHistorico,
  InvarianteViolada,
  Turma,
  ValorInvalido,
} from '@jiupresence/domain';
import {
  CasosDeUsoDeAluno,
  CasosDeUsoDeTurma,
} from '../src/aluno/casos-de-uso.js';
import { montarCenario } from './fakes.js';

// 2026-10-05, segunda-feira, 19h.
const SEGUNDA_19H = new Date('2026-10-05T19:00:00');

describe('CasosDeUsoDeAluno', () => {
  let cenario: ReturnType<typeof montarCenario>;
  let casos: CasosDeUsoDeAluno;

  beforeEach(() => {
    cenario = montarCenario(SEGUNDA_19H);
    casos = new CasosDeUsoDeAluno({
      alunos: cenario.alunos,
      turmas: cenario.turmas,
      matriculas: cenario.matriculas,
      relogio: cenario.relogio,
    });
  });

  describe('escala sugerida pela idade', () => {
    it('sugere adulta a partir de 16 anos', () => {
      expect(casos.escalaSugerida('2010-01-01')).toBe('adulta');
      expect(casos.escalaSugerida('1990-05-20')).toBe('adulta');
    });

    it('sugere infantil abaixo de 16', () => {
      expect(casos.escalaSugerida('2016-01-01')).toBe('infantil');
      expect(casos.escalaSugerida('2020-01-01')).toBe('infantil');
    });

    it('não sugere nada sem data de nascimento', () => {
      expect(casos.escalaSugerida(null)).toBeNull();
    });
  });

  describe('cadastro', () => {
    it('cadastra aluno adulto derivando a escala da idade', async () => {
      const aluno = await casos.cadastrar({
        nome: 'Rickson',
        dataNascimento: '1990-05-20',
        faixa: 'preta',
      });

      expect(aluno.escala).toBe('adulta');
      expect(aluno.faixa.nome).toBe('preta');
      expect(await cenario.alunos.porId(aluno.id)).not.toBeNull();
    });

    it('cadastra criança derivando a escala infantil', async () => {
      const aluno = await casos.cadastrar({
        nome: 'Mini Gracie',
        dataNascimento: '2018-03-10',
        faixa: 'amarela',
      });

      expect(aluno.escala).toBe('infantil');
      expect(aluno.idadeEm(DataCivil.deIso('2026-10-05'))).toBe(8);
    });

    it('a idade prevalece sobre a escala informada', async () => {
      // Se há data de nascimento, ela é a verdade. Informar escala
      // divergente é engano de preenchimento, não intenção.
      const aluno = await casos.cadastrar({
        nome: 'Criança',
        dataNascimento: '2018-03-10',
        escala: 'adulta',
        faixa: 'amarela',
      });
      expect(aluno.escala).toBe('infantil');
    });

    it('recusa cadastro sem data de nascimento E sem escala', async () => {
      // EC-02: presumir "adulta" daria o seletor de faixa errado para toda
      // criança cadastrada sem data.
      await expect(
        casos.cadastrar({ nome: 'Sem data', faixa: 'branca' }),
      ).rejects.toThrow(InvarianteViolada);
      await expect(
        casos.cadastrar({ nome: 'Sem data', faixa: 'branca' }),
      ).rejects.toThrow(/adulta ou a infantil/);
    });

    it('aceita cadastro sem data quando a escala é explícita', async () => {
      const aluno = await casos.cadastrar({
        nome: 'Sem data',
        escala: 'infantil',
        faixa: 'laranja',
      });
      expect(aluno.escala).toBe('infantil');
      expect(aluno.dataNascimento).toBeNull();
    });

    it('recusa faixa incoerente com a escala derivada', async () => {
      await expect(
        casos.cadastrar({
          nome: 'Criança',
          dataNascimento: '2018-03-10',
          faixa: 'roxa', // roxa é adulta
        }),
      ).rejects.toThrow(ValorInvalido);
    });

    it('matricula nas turmas informadas durante o cadastro', async () => {
      const turmaA = Turma.criar({ nome: 'A', diasSemana: [1], horario: '19:00' });
      const turmaB = Turma.criar({ nome: 'B', diasSemana: [3], horario: '07:00' });
      await cenario.turmas.salvar(turmaA);
      await cenario.turmas.salvar(turmaB);

      const aluno = await casos.cadastrar({
        nome: 'Multi',
        dataNascimento: '1995-01-01',
        faixa: 'azul',
        turmaIds: [turmaA.id, turmaB.id],
      });

      const matriculas = await cenario.matriculas.doAluno(aluno.id);
      expect(matriculas).toHaveLength(2);
      expect(matriculas.every((m) => m.vigente)).toBe(true);
    });
  });

  describe('matrícula', () => {
    it('matricular duas vezes na mesma turma é idempotente', async () => {
      const turma = Turma.criar({ nome: 'A', diasSemana: [1], horario: '19:00' });
      await cenario.turmas.salvar(turma);
      const aluno = await casos.cadastrar({
        nome: 'Ana',
        dataNascimento: '1995-01-01',
        faixa: 'azul',
      });

      await casos.matricular(aluno.id, turma.id);
      await casos.matricular(aluno.id, turma.id);

      expect(await cenario.matriculas.doAluno(aluno.id)).toHaveLength(1);
    });

    it('desmatricular encerra a vigência sem apagar o registro', async () => {
      // EC-10: presenças anteriores permanecem válidas.
      const turma = Turma.criar({ nome: 'A', diasSemana: [1], horario: '19:00' });
      await cenario.turmas.salvar(turma);
      const aluno = await casos.cadastrar({
        nome: 'Ana',
        dataNascimento: '1995-01-01',
        faixa: 'azul',
        turmaIds: [turma.id],
      });

      await casos.desmatricular(aluno.id, turma.id);

      const matriculas = await cenario.matriculas.doAluno(aluno.id);
      expect(matriculas).toHaveLength(1);
      expect(matriculas[0]!.vigente).toBe(false);
    });

    it('desmatricular quem não está matriculado não falha', async () => {
      const turma = Turma.criar({ nome: 'A', diasSemana: [1], horario: '19:00' });
      await cenario.turmas.salvar(turma);
      const aluno = await casos.cadastrar({
        nome: 'Ana',
        dataNascimento: '1995-01-01',
        faixa: 'azul',
      });
      await expect(casos.desmatricular(aluno.id, turma.id)).resolves.toBeUndefined();
    });
  });

  describe('ciclo de vida', () => {
    it('inativa e reativa preservando os dados', async () => {
      const aluno = await casos.cadastrar({
        nome: 'Ana',
        dataNascimento: '1995-01-01',
        faixa: 'azul',
      });

      await casos.inativar(aluno.id);
      expect((await cenario.alunos.porId(aluno.id))?.ativo).toBe(false);

      await casos.reativar(aluno.id);
      const reativado = await cenario.alunos.porId(aluno.id);
      expect(reativado?.ativo).toBe(true);
      expect(reativado?.nome).toBe('Ana');
    });

    it('recusa operar sobre aluno inexistente', async () => {
      const { novoId } = await import('@jiupresence/domain');
      await expect(casos.inativar(novoId())).rejects.toThrow(/não encontrado/);
    });
  });

  describe('exclusão (RF-15)', () => {
    it('exclui aluno sem histórico', async () => {
      const aluno = await casos.cadastrar({
        nome: 'Novato',
        dataNascimento: '1995-01-01',
        faixa: 'branca',
      });

      await casos.excluir(aluno.id);
      expect(await cenario.alunos.porId(aluno.id)).toBeNull();
    });

    it('recusa excluir aluno com presenças e oferece a inativação', async () => {
      const aluno = await casos.cadastrar({
        nome: 'Veterano',
        dataNascimento: '1990-01-01',
        faixa: 'roxa',
      });
      cenario.alunos.presencasPorAluno.set(aluno.id, 42);

      await expect(casos.excluir(aluno.id)).rejects.toThrow(
        ExclusaoBloqueadaPorHistorico,
      );
      // E não excluiu.
      expect(await cenario.alunos.porId(aluno.id)).not.toBeNull();
    });
  });
});

describe('CasosDeUsoDeTurma', () => {
  let cenario: ReturnType<typeof montarCenario>;
  let casos: CasosDeUsoDeTurma;

  beforeEach(() => {
    cenario = montarCenario(SEGUNDA_19H);
    casos = new CasosDeUsoDeTurma({
      alunos: cenario.alunos,
      turmas: cenario.turmas,
      matriculas: cenario.matriculas,
      relogio: cenario.relogio,
    });
  });

  it('cadastra turma', async () => {
    const turma = await casos.cadastrar({
      nome: 'Adulto Noite',
      diasSemana: [1, 3, 5],
      horario: '19:00',
    });
    expect(await cenario.turmas.porId(turma.id)).not.toBeNull();
  });

  describe('pré-seleção pelo horário (RF-01)', () => {
    it('escolhe a turma do dia mais próxima do horário atual', async () => {
      // São 19h de uma segunda.
      await casos.cadastrar({ nome: 'Manhã', diasSemana: [1], horario: '07:00' });
      const noite = await casos.cadastrar({
        nome: 'Noite',
        diasSemana: [1],
        horario: '19:00',
      });

      expect((await casos.doHorarioAtual())?.id).toBe(noite.id);
    });

    it('ignora turmas que não têm aula hoje', async () => {
      // Segunda-feira; esta turma só treina terça e quinta.
      await casos.cadastrar({ nome: 'Outra', diasSemana: [2, 4], horario: '19:00' });
      expect(await casos.doHorarioAtual()).toBeNull();
    });

    it('ignora turmas desativadas', async () => {
      const turma = await casos.cadastrar({
        nome: 'Encerrada',
        diasSemana: [1],
        horario: '19:00',
      });
      await casos.desativar(turma.id);
      expect(await casos.doHorarioAtual()).toBeNull();
    });

    it('devolve null quando não há turma nenhuma', async () => {
      expect(await casos.doHorarioAtual()).toBeNull();
    });
  });

  describe('exclusão', () => {
    it('exclui turma sem chamadas', async () => {
      const turma = await casos.cadastrar({
        nome: 'Vazia',
        diasSemana: [1],
        horario: '19:00',
      });
      await casos.excluir(turma.id);
      expect(await cenario.turmas.porId(turma.id)).toBeNull();
    });

    it('recusa excluir turma com chamadas registradas', async () => {
      // EC-04: desativar preserva o histórico de presenças da turma.
      const turma = await casos.cadastrar({
        nome: 'Com histórico',
        diasSemana: [1],
        horario: '19:00',
      });
      cenario.turmas.chamadasPorTurma.set(turma.id, 12);

      await expect(casos.excluir(turma.id)).rejects.toThrow(
        ExclusaoBloqueadaPorHistorico,
      );
      expect(await cenario.turmas.porId(turma.id)).not.toBeNull();
    });
  });
});

describe('Aluno como agregado, pela aplicação', () => {
  it('a inativação mantém o aluno fora da chamada mas no histórico', async () => {
    const cenario = montarCenario(SEGUNDA_19H);
    const turma = Turma.criar({ nome: 'A', diasSemana: [1], horario: '19:00' });
    await cenario.turmas.salvar(turma);

    const casos = new CasosDeUsoDeAluno({
      alunos: cenario.alunos,
      turmas: cenario.turmas,
      matriculas: cenario.matriculas,
      relogio: cenario.relogio,
    });

    const aluno = await casos.cadastrar({
      nome: 'Sumido',
      dataNascimento: '1995-01-01',
      faixa: 'azul',
      turmaIds: [turma.id],
    });

    expect(await cenario.alunos.daTurma(turma.id, DataCivil.deIso('2026-10-05')))
      .toHaveLength(1);

    await casos.inativar(aluno.id);

    expect(await cenario.alunos.daTurma(turma.id, DataCivil.deIso('2026-10-05')))
      .toHaveLength(0);
    expect(await cenario.alunos.porId(aluno.id)).toBeInstanceOf(Aluno);
  });
});
