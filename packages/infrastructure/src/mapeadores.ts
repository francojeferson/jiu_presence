/**
 * Tradução entre as linhas do banco e os agregados do domínio.
 *
 * Fica na infraestrutura por desenho: o domínio não deve saber que existe uma
 * coluna chamada `data_nascimento`. O vocabulário (Aluno, Turma, Chamada,
 * Faixa) é o mesmo dos dois lados, em português, porque o único falante do
 * domínio é brasileiro — traduzir para inglês criaria um glossário paralelo
 * sem benefício.
 */

import {
  Aluno,
  Chamada,
  DataCivil,
  Faixa,
  Matricula,
  Turma,
  comoId,
  type DadosPresenca,
  type DiaDaSemana,
} from '@jiupresence/domain';
import type {
  LinhaAluno,
  LinhaChamada,
  LinhaMatricula,
  LinhaPresenca,
  LinhaTurma,
} from '@jiupresence/contracts';

const dataOuNulo = (iso: string | null): DataCivil | null =>
  iso === null ? null : DataCivil.deIso(iso);

export function alunoDaLinha(linha: LinhaAluno): Aluno {
  return Aluno.reconstituir({
    id: comoId(linha.id),
    nome: linha.nome,
    dataNascimento: dataOuNulo(linha.data_nascimento),
    faixa: Faixa.criar(linha.escala, linha.faixa_atual),
    dataUltimaGraduacao: dataOuNulo(linha.data_ultima_graduacao),
    ativo: linha.ativo,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  });
}

export function linhaDoAluno(aluno: Aluno): LinhaAluno {
  const d = aluno.dados();
  return {
    id: d.id,
    nome: d.nome,
    data_nascimento: d.dataNascimento?.iso ?? null,
    escala: d.faixa.escala,
    faixa_atual: d.faixa.nome,
    data_ultima_graduacao: d.dataUltimaGraduacao?.iso ?? null,
    ativo: d.ativo,
    criado_em: d.criadoEm,
    atualizado_em: d.atualizadoEm,
  };
}

export function turmaDaLinha(linha: LinhaTurma): Turma {
  return Turma.reconstituir({
    id: comoId(linha.id),
    nome: linha.nome,
    diasSemana: linha.dias_semana as DiaDaSemana[],
    // O Postgres devolve `time` como HH:MM:SS; o domínio trabalha com HH:MM.
    horario: linha.horario.slice(0, 5),
    ativa: linha.ativa,
    criadoEm: linha.criado_em,
  });
}

export function linhaDaTurma(turma: Turma): LinhaTurma {
  const d = turma.dados();
  return {
    id: d.id,
    nome: d.nome,
    dias_semana: [...d.diasSemana],
    horario: d.horario,
    ativa: d.ativa,
    criado_em: d.criadoEm,
  };
}

export function matriculaDaLinha(linha: LinhaMatricula): Matricula {
  return Matricula.reconstituir({
    alunoId: comoId(linha.aluno_id),
    turmaId: comoId(linha.turma_id),
    matriculadoEm: DataCivil.deIso(linha.matriculado_em),
    desmatriculadoEm: dataOuNulo(linha.desmatriculado_em),
  });
}

export function linhaDaMatricula(matricula: Matricula): LinhaMatricula {
  const d = matricula.dados();
  return {
    aluno_id: d.alunoId,
    turma_id: d.turmaId,
    matriculado_em: d.matriculadoEm.iso,
    desmatriculado_em: d.desmatriculadoEm?.iso ?? null,
  };
}

export function chamadaDaLinha(
  linha: LinhaChamada,
  presencas: readonly LinhaPresenca[],
): Chamada {
  return Chamada.reconstituir({
    id: comoId(linha.id),
    turmaId: comoId(linha.turma_id),
    data: DataCivil.deIso(linha.data),
    realizadaEm: linha.realizada_em,
    origem: linha.origem,
    totalDetectado: linha.total_detectado,
    confirmada: linha.confirmada,
    criadaOffline: linha.criada_offline,
    presencas: presencas.map(
      (p): DadosPresenca => ({
        id: comoId(p.id),
        chamadaId: comoId(p.chamada_id),
        alunoId: comoId(p.aluno_id),
        origem: p.origem,
        confianca: p.confianca,
        registradaEm: p.registrada_em,
      }),
    ),
  });
}

export function linhaDaChamada(chamada: Chamada): LinhaChamada {
  const d = chamada.dados();
  return {
    id: d.id,
    turma_id: d.turmaId,
    // A data da AULA. Nunca substituir por `now()` na subida (RN-06).
    data: d.data.iso,
    realizada_em: d.realizadaEm,
    origem: d.origem,
    total_detectado: d.totalDetectado,
    confirmada: d.confirmada,
    criada_offline: d.criadaOffline,
  };
}

export function linhasDasPresencas(chamada: Chamada): LinhaPresenca[] {
  return chamada.presencas.map((p) => ({
    id: p.id,
    chamada_id: p.chamadaId,
    aluno_id: p.alunoId,
    origem: p.origem,
    confianca: p.confianca,
    registrada_em: p.registradaEm,
  }));
}
