/**
 * Portas de persistência.
 *
 * Interfaces declaradas no DOMÍNIO e implementadas na INFRAESTRUTURA. É o
 * mecanismo concreto que inverte a dependência: nenhum caso de uso conhece
 * Supabase, Dexie ou HTTP.
 *
 * Nas duas tentativas anteriores em Flutter, a ausência disso produziu o
 * `SupabaseService` instanciado direto dentro de `RegistrationScreen`, o que
 * tornou os testes impossíveis de escrever sem o método público `setTestState`
 * criado só para contornar o problema. Aqui, trocar o adaptador por um fake em
 * teste não exige alterar nenhum caso de uso.
 */

import type { Aluno } from '../aluno/aluno.js';
import type { Chamada } from '../chamada/chamada.js';
import type { Matricula, Turma } from '../turma/turma.js';
import type { DataCivil } from '../valor/data.js';
import type { Id } from '../valor/identidade.js';

export interface RepositorioDeAlunos {
  porId(id: Id): Promise<Aluno | null>;
  listar(opcoes?: { apenasAtivos?: boolean }): Promise<Aluno[]>;
  /** Alunos com matrícula vigente na turma. É a leitura que abre a chamada. */
  daTurma(turmaId: Id, em: DataCivil): Promise<Aluno[]>;
  salvar(aluno: Aluno): Promise<void>;
  excluir(id: Id): Promise<void>;
  contarPresencas(alunoId: Id): Promise<number>;
}

export interface RepositorioDeTurmas {
  porId(id: Id): Promise<Turma | null>;
  listar(opcoes?: { apenasAtivas?: boolean }): Promise<Turma[]>;
  salvar(turma: Turma): Promise<void>;
  excluir(id: Id): Promise<void>;
  contarChamadas(turmaId: Id): Promise<number>;
}

export interface RepositorioDeMatriculas {
  daTurma(turmaId: Id): Promise<Matricula[]>;
  doAluno(alunoId: Id): Promise<Matricula[]>;
  salvar(matricula: Matricula): Promise<void>;
}

export interface RepositorioDeChamadas {
  porId(id: Id): Promise<Chamada | null>;
  /** RF-21: é o que permite detectar a chamada já existente antes de criar outra. */
  porTurmaEData(turmaId: Id, data: DataCivil): Promise<Chamada | null>;
  listarRecentes(limite: number): Promise<Chamada[]>;
  salvar(chamada: Chamada): Promise<void>;
}

/**
 * Relógio como porta.
 *
 * O domínio não lê `Date.now()` em pontos de decisão, porque isso torna a
 * regra não-testável de forma determinística. A implementação real é trivial;
 * o valor está em poder injetar um relógio fixo nos testes.
 */
export interface Relogio {
  agora(): Date;
  hoje(): DataCivil;
}

/** Estado da fila de sincronização, exposto à interface (RF-29). */
export interface EstadoDeSincronizacao {
  readonly online: boolean;
  readonly pendentes: number;
  readonly falhasPermanentes: number;
  readonly sincronizando: boolean;
}

export interface Sincronizador {
  estado(): Promise<EstadoDeSincronizacao>;
  /** Dispara uma tentativa. Em operação normal nunca é chamada pelo usuário. */
  sincronizarAgora(): Promise<void>;
  observar(ouvinte: (estado: EstadoDeSincronizacao) => void): () => void;
}
