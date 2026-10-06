import { beforeEach, describe, expect, it } from 'vitest';
import { Aluno, Chamada, DataCivil, InvarianteViolada, Turma } from '@jiupresence/domain';
import {
  CasosDeUsoDaChamada,
  type ChamadaEmAndamento,
} from '../src/chamada/casos-de-uso.js';
import { montarCenario } from './fakes.js';

// 2026-10-05 é uma SEGUNDA-FEIRA. A turma tem aula seg/qua/sex.
const SEGUNDA = new Date('2026-10-05T19:00:00');

describe('CasosDeUsoDaChamada', () => {
  let cenario: ReturnType<typeof montarCenario>;
  let casos: CasosDeUsoDaChamada;
  let turma: Turma;

  beforeEach(async () => {
    cenario = montarCenario(SEGUNDA);
    casos = new CasosDeUsoDaChamada({
      chamadas: cenario.chamadas,
      turmas: cenario.turmas,
      alunos: cenario.alunos,
      relogio: cenario.relogio,
    });

    turma = Turma.criar({
      nome: 'Adulto Noite',
      diasSemana: [1, 3, 5],
      horario: '19:00',
    });
    await cenario.turmas.salvar(turma);
  });

  async function matricular(nome: string): Promise<Aluno> {
    const aluno = Aluno.criar({ nome, escala: 'adulta', faixa: 'azul' });
    await cenario.alunos.salvar(aluno);
    const { Matricula } = await import('@jiupresence/domain');
    await cenario.matriculas.salvar(
      Matricula.criar(aluno.id, turma.id, DataCivil.deIso('2026-01-01')),
    );
    return aluno;
  }

  describe('abertura', () => {
    it('lista TODOS os alunos matriculados, não só os presentes', async () => {
      // RF-17: a pergunta do professor é "quem faltou". Lista só de presentes
      // transferiria a subtração para ele, no momento de maior pressa.
      await matricular('Ana');
      await matricular('Bruno');
      await matricular('Carla');

      const chamada = await casos.abrir(turma.id);

      expect(chamada.linhas).toHaveLength(3);
      expect(chamada.linhas.every((l) => !l.presente)).toBe(true);
      expect(chamada.totalDeAusentes).toBe(3);
      expect(chamada.totalDePresentes).toBe(0);
    });

    it('recusa chamada de turma sem alunos matriculados', async () => {
      // EC-06: direcionar para a matrícula, explicando o motivo.
      await expect(casos.abrir(turma.id)).rejects.toThrow(InvarianteViolada);
      await expect(casos.abrir(turma.id)).rejects.toThrow(/matriculado/);
    });

    it('recusa turma inexistente', async () => {
      const { novoId } = await import('@jiupresence/domain');
      await expect(casos.abrir(novoId())).rejects.toThrow(/não encontrada/);
    });

    it('não sinaliza fora da grade em dia de aula', async () => {
      await matricular('Ana');
      const chamada = await casos.abrir(turma.id);
      expect(chamada.foraDaGrade).toBe(false);
    });

    it('sinaliza aula fora da grade sem bloquear', async () => {
      // EC-12: aula extra e reposição são legítimas. A grade orienta.
      await matricular('Ana');
      const domingo = DataCivil.deIso('2026-10-04');
      const chamada = await casos.abrir(turma.id, domingo);
      expect(chamada.foraDaGrade).toBe(true);
      expect(chamada.linhas).toHaveLength(1);
    });

    it('exclui alunos inativos da chamada', async () => {
      const ana = await matricular('Ana');
      await matricular('Bruno');
      ana.inativar();
      await cenario.alunos.salvar(ana);

      const chamada = await casos.abrir(turma.id);
      expect(chamada.linhas.map((l) => l.aluno.nome)).toEqual(['Bruno']);
    });

    it('exclui alunos desmatriculados antes da data', async () => {
      const ana = await matricular('Ana');
      await matricular('Bruno');
      const matriculas = await cenario.matriculas.doAluno(ana.id);
      matriculas[0]!.encerrar(DataCivil.deIso('2026-06-30'));
      await cenario.matriculas.salvar(matriculas[0]!);

      const chamada = await casos.abrir(turma.id);
      expect(chamada.linhas.map((l) => l.aluno.nome)).toEqual(['Bruno']);
    });
  });

  describe('chamada duplicada (RF-21)', () => {
    it('reabre a chamada existente em vez de criar uma segunda', async () => {
      const ana = await matricular('Ana');

      const primeira = await casos.abrir(turma.id);
      await casos.alternarPresenca(primeira, ana.id);
      await casos.confirmar(primeira);

      const segunda = await casos.abrir(turma.id);

      expect(segunda.jaExistia).toBe(true);
      expect(segunda.chamada.id).toBe(primeira.chamada.id);
      expect(cenario.chamadas.itens.size).toBe(1);
    });

    it('a chamada reaberta preserva as presenças já marcadas', async () => {
      const ana = await matricular('Ana');
      await matricular('Bruno');

      const primeira = await casos.abrir(turma.id);
      await casos.alternarPresenca(primeira, ana.id);
      await casos.confirmar(primeira);

      const segunda = await casos.abrir(turma.id);
      const linhaAna = segunda.linhas.find((l) => l.aluno.id === ana.id);
      expect(linhaAna?.presente).toBe(true);
      expect(segunda.totalDePresentes).toBe(1);
    });

    it('chamadas em datas diferentes são independentes', async () => {
      await matricular('Ana');
      const segunda = await casos.abrir(turma.id, DataCivil.deIso('2026-10-05'));
      await casos.confirmar(segunda);
      const quarta = await casos.abrir(turma.id, DataCivil.deIso('2026-10-07'));
      await casos.confirmar(quarta);
      expect(cenario.chamadas.itens.size).toBe(2);
    });
  });

  describe('marcação', () => {
    let ana: Aluno;
    let emAndamento: ChamadaEmAndamento;

    beforeEach(async () => {
      ana = await matricular('Ana');
      await matricular('Bruno');
      emAndamento = await casos.abrir(turma.id);
    });

    it('um toque marca presença', async () => {
      const depois = await casos.alternarPresenca(emAndamento, ana.id);
      expect(depois.totalDePresentes).toBe(1);
      expect(depois.totalDeAusentes).toBe(1);
      expect(depois.linhas.find((l) => l.aluno.id === ana.id)?.presente).toBe(true);
    });

    it('outro toque desmarca', async () => {
      let atual = await casos.alternarPresenca(emAndamento, ana.id);
      atual = await casos.alternarPresenca(atual, ana.id);
      expect(atual.totalDePresentes).toBe(0);
    });

    it('a marcação manual registra a origem', async () => {
      const depois = await casos.alternarPresenca(emAndamento, ana.id);
      expect(depois.linhas.find((l) => l.aluno.id === ana.id)?.origem).toBe('manual');
    });

    it('a contagem acompanha cada marcação', async () => {
      // RF-19: o professor confere o total contra a turma visível.
      const bruno = emAndamento.linhas[1]!.aluno;
      let atual = await casos.alternarPresenca(emAndamento, ana.id);
      expect(atual.totalDePresentes).toBe(1);
      atual = await casos.alternarPresenca(atual, bruno.id);
      expect(atual.totalDePresentes).toBe(2);
      expect(atual.totalDeAusentes).toBe(0);
    });
  });

  describe('confirmação', () => {
    it('persiste a chamada confirmada', async () => {
      const ana = await matricular('Ana');
      const emAndamento = await casos.abrir(turma.id);
      const comPresenca = await casos.alternarPresenca(emAndamento, ana.id);

      await casos.confirmar(comPresenca);

      expect(comPresenca.chamada.confirmada).toBe(true);
      expect(cenario.chamadas.salvamentos).toBe(1);
    });

    it('a chamada é salva com a data da AULA, não a do envio', async () => {
      // RN-06: o dispositivo pode ficar dias offline.
      await matricular('Ana');
      const dataDaAula = DataCivil.deIso('2026-09-28');
      const emAndamento = await casos.abrir(turma.id, dataDaAula);
      await casos.confirmar(emAndamento);

      const salva = [...cenario.chamadas.itens.values()][0] as Chamada;
      expect(salva.data.iso).toBe('2026-09-28');
    });

    it('a chamada manual nasce com origem manual', async () => {
      await matricular('Ana');
      const emAndamento = await casos.abrir(turma.id);
      expect(emAndamento.chamada.origem).toBe('manual');
    });
  });
});
