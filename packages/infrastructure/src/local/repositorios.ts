/**
 * Repositórios locais: implementam as portas do domínio sobre IndexedDB.
 *
 * A propriedade central deste arquivo é que **a gravação local e o
 * enfileiramento acontecem na MESMA transação**. Se fossem duas operações
 * separadas, uma falha entre elas deixaria o estado divergente de dois modos
 * possíveis, ambos ruins:
 *
 *   gravou e não enfileirou  -> o professor vê a presença na tela e ela
 *                               nunca chega ao servidor. Pior caso: a perda
 *                               é silenciosa e só aparece no relatório.
 *   enfileirou e não gravou  -> a presença some da tela mas sobe depois,
 *                               confundindo quem olha o app.
 *
 * Nenhum caso de uso sabe que existe uma fila. Ele chama `salvar` numa porta.
 */

import {
  Aluno,
  Chamada,
  Matricula,
  Turma,
  type DataCivil,
  type Id,
  type RepositorioDeAlunos,
  type RepositorioDeChamadas,
  type RepositorioDeMatriculas,
  type RepositorioDeTurmas,
} from '@jiupresence/domain';
import type { LinhaAluno, LinhaChamada, LinhaMatricula, LinhaPresenca, LinhaTurma } from '@jiupresence/contracts';

import { bancoLocal, type BancoLocal } from './db.js';
import { Outbox } from './outbox.js';
import { garantirEspacoParaEscrita } from './cota.js';
import {
  alunoDaLinha,
  chamadaDaLinha,
  linhaDaChamada,
  linhaDaMatricula,
  linhaDaTurma,
  linhaDoAluno,
  linhasDasPresencas,
  matriculaDaLinha,
  turmaDaLinha,
} from '../mapeadores.js';

/** Chaves do cache local. */
const CHAVE = {
  alunos: 'alunos',
  turmas: 'turmas',
  matriculas: 'matriculas',
  chamadas: 'chamadas',
  presencas: 'presencas',
} as const;

type Colecao = keyof typeof CHAVE;

async function ler<T>(db: BancoLocal, colecao: Colecao): Promise<T[]> {
  const entrada = await db.cache.get(CHAVE[colecao]);
  return (entrada?.valor as T[] | undefined) ?? [];
}

async function escrever<T>(
  db: BancoLocal,
  colecao: Colecao,
  valor: T[],
): Promise<void> {
  await db.cache.put({
    chave: CHAVE[colecao],
    valor,
    atualizadoEm: new Date().toISOString(),
    versaoSchema: 1,
  });
}

function substituir<T>(lista: T[], item: T, mesmo: (a: T) => boolean): T[] {
  const i = lista.findIndex(mesmo);
  if (i >= 0) {
    const copia = [...lista];
    copia[i] = item;
    return copia;
  }
  return [...lista, item];
}

/**
 * Implementação única das quatro portas.
 *
 * NÃO declara `implements` para as quatro: os nomes colidem — `porId`,
 * `listar` e `salvar` existem em mais de uma porta com assinaturas
 * diferentes. A conformidade é garantida por `portasLocais()`, no fim do
 * arquivo, que monta um objeto por porta e é verificada pelo compilador no
 * tipo de retorno daquela função.
 */
export class RepositoriosLocais {
  private readonly outbox: Outbox;

  constructor(private readonly db: BancoLocal = bancoLocal()) {
    this.outbox = new Outbox(db);
  }

  // ------------------------------------------------------------- alunos

  async porId(id: Id): Promise<Aluno | null> {
    const linhas = await ler<LinhaAluno>(this.db, 'alunos');
    const linha = linhas.find((l) => l.id === id);
    return linha ? alunoDaLinha(linha) : null;
  }

  async listar(opcoes?: { apenasAtivos?: boolean }): Promise<Aluno[]> {
    const linhas = await ler<LinhaAluno>(this.db, 'alunos');
    const filtradas =
      opcoes?.apenasAtivos === true ? linhas.filter((l) => l.ativo) : linhas;
    return filtradas
      .map(alunoDaLinha)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async daTurma(turmaId: Id, em: DataCivil): Promise<Aluno[]> {
    const matriculas = (await ler<LinhaMatricula>(this.db, 'matriculas'))
      .filter((m) => m.turma_id === turmaId)
      .map(matriculaDaLinha)
      .filter((m) => m.vigenteEm(em));

    const idsVigentes = new Set(matriculas.map((m) => m.alunoId));

    return (await ler<LinhaAluno>(this.db, 'alunos'))
      .filter((l) => l.ativo && idsVigentes.has(l.id as Id))
      .map(alunoDaLinha)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async salvar(aluno: Aluno): Promise<void> {
    await garantirEspacoParaEscrita();
    const linha = linhaDoAluno(aluno);
    const existia = (await this.porId(aluno.id)) !== null;

    await this.db.transaction('rw', this.db.cache, this.db.outbox, this.db.contadores, async () => {
      const lista = await ler<LinhaAluno>(this.db, 'alunos');
      await escrever(this.db, 'alunos', substituir(lista, linha, (l) => l.id === linha.id));
      await this.outbox.enfileirar(
        aluno.id,
        existia ? 'atualizar_aluno' : 'criar_aluno',
        linha,
        linha.atualizado_em,
      );
    });
  }

  async excluir(id: Id): Promise<void> {
    await garantirEspacoParaEscrita();
    await this.db.transaction('rw', this.db.cache, this.db.outbox, this.db.contadores, async () => {
      const lista = await ler<LinhaAluno>(this.db, 'alunos');
      await escrever(this.db, 'alunos', lista.filter((l) => l.id !== id));
      await this.outbox.enfileirar(
        id,
        'excluir_aluno',
        { id },
        new Date().toISOString(),
      );
    });
  }

  async contarPresencas(alunoId: Id): Promise<number> {
    const presencas = await ler<LinhaPresenca>(this.db, 'presencas');
    return presencas.filter((p) => p.aluno_id === alunoId).length;
  }

  // -------------------------------------------------------------- turmas

  async turmaPorId(id: Id): Promise<Turma | null> {
    const linhas = await ler<LinhaTurma>(this.db, 'turmas');
    const linha = linhas.find((l) => l.id === id);
    return linha ? turmaDaLinha(linha) : null;
  }

  async listarTurmas(opcoes?: { apenasAtivas?: boolean }): Promise<Turma[]> {
    const linhas = await ler<LinhaTurma>(this.db, 'turmas');
    const filtradas =
      opcoes?.apenasAtivas === true ? linhas.filter((l) => l.ativa) : linhas;
    return filtradas.map(turmaDaLinha);
  }

  async salvarTurma(turma: Turma): Promise<void> {
    await garantirEspacoParaEscrita();
    const linha = linhaDaTurma(turma);
    const existia = (await this.turmaPorId(turma.id)) !== null;

    await this.db.transaction('rw', this.db.cache, this.db.outbox, this.db.contadores, async () => {
      const lista = await ler<LinhaTurma>(this.db, 'turmas');
      await escrever(this.db, 'turmas', substituir(lista, linha, (l) => l.id === linha.id));
      await this.outbox.enfileirar(
        turma.id,
        existia ? 'atualizar_turma' : 'criar_turma',
        linha,
        linha.criado_em,
      );
    });
  }

  async excluirTurma(id: Id): Promise<void> {
    await garantirEspacoParaEscrita();
    await this.db.transaction('rw', this.db.cache, this.db.outbox, this.db.contadores, async () => {
      const lista = await ler<LinhaTurma>(this.db, 'turmas');
      await escrever(this.db, 'turmas', lista.filter((l) => l.id !== id));
      await this.outbox.enfileirar(
        id,
        'excluir_turma',
        { id },
        new Date().toISOString(),
      );
    });
  }

  async contarChamadas(turmaId: Id): Promise<number> {
    const chamadas = await ler<LinhaChamada>(this.db, 'chamadas');
    return chamadas.filter((c) => c.turma_id === turmaId).length;
  }

  // ---------------------------------------------------------- matrículas

  async matriculasDaTurma(turmaId: Id): Promise<Matricula[]> {
    return (await ler<LinhaMatricula>(this.db, 'matriculas'))
      .filter((m) => m.turma_id === turmaId)
      .map(matriculaDaLinha);
  }

  async doAluno(alunoId: Id): Promise<Matricula[]> {
    return (await ler<LinhaMatricula>(this.db, 'matriculas'))
      .filter((m) => m.aluno_id === alunoId)
      .map(matriculaDaLinha);
  }

  async salvarMatricula(matricula: Matricula): Promise<void> {
    await garantirEspacoParaEscrita();
    const linha = linhaDaMatricula(matricula);
    const mesma = (l: LinhaMatricula): boolean =>
      l.aluno_id === linha.aluno_id &&
      l.turma_id === linha.turma_id &&
      l.matriculado_em === linha.matriculado_em;

    await this.db.transaction('rw', this.db.cache, this.db.outbox, this.db.contadores, async () => {
      const lista = await ler<LinhaMatricula>(this.db, 'matriculas');
      const existia = lista.some(mesma);
      await escrever(this.db, 'matriculas', substituir(lista, linha, mesma));
      // A matrícula não tem id próprio; a chave de idempotência é derivada
      // da sua chave composta, de forma estável.
      await this.outbox.enfileirar(
        chaveDaMatricula(linha),
        existia ? 'encerrar_matricula' : 'criar_matricula',
        linha,
        new Date().toISOString(),
      );
    });
  }

  // ------------------------------------------------------------ chamadas

  async chamadaPorId(id: Id): Promise<Chamada | null> {
    const linha = (await ler<LinhaChamada>(this.db, 'chamadas')).find(
      (c) => c.id === id,
    );
    if (!linha) return null;
    const presencas = (await ler<LinhaPresenca>(this.db, 'presencas')).filter(
      (p) => p.chamada_id === id,
    );
    return chamadaDaLinha(linha, presencas);
  }

  async porTurmaEData(turmaId: Id, data: DataCivil): Promise<Chamada | null> {
    const linha = (await ler<LinhaChamada>(this.db, 'chamadas')).find(
      (c) => c.turma_id === turmaId && c.data === data.iso,
    );
    if (!linha) return null;
    const presencas = (await ler<LinhaPresenca>(this.db, 'presencas')).filter(
      (p) => p.chamada_id === linha.id,
    );
    return chamadaDaLinha(linha, presencas);
  }

  async listarRecentes(limite: number): Promise<Chamada[]> {
    const linhas = (await ler<LinhaChamada>(this.db, 'chamadas'))
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, limite);
    const todas = await ler<LinhaPresenca>(this.db, 'presencas');
    return linhas.map((l) =>
      chamadaDaLinha(l, todas.filter((p) => p.chamada_id === l.id)),
    );
  }

  /**
   * Grava a chamada e TODAS as suas presenças, enfileirando cada item, em uma
   * única transação.
   *
   * A chamada é enfileirada antes das presenças porque a ordem da fila
   * precisa respeitar a chave estrangeira: enviar uma presença antes da
   * chamada produziria violação de FK no servidor (tratada como transitória,
   * mas é desperdício evitável).
   */
  async salvarChamada(chamada: Chamada): Promise<void> {
    await garantirEspacoParaEscrita();

    const linha = linhaDaChamada(chamada);
    const presencasNovas = linhasDasPresencas(chamada);

    await this.db.transaction('rw', this.db.cache, this.db.outbox, this.db.contadores, async () => {
      const chamadas = await ler<LinhaChamada>(this.db, 'chamadas');
      const jaExistia = chamadas.some((c) => c.id === linha.id);
      await escrever(
        this.db,
        'chamadas',
        substituir(chamadas, linha, (c) => c.id === linha.id),
      );

      if (!jaExistia) {
        await this.outbox.enfileirar(
          chamada.id,
          'criar_chamada',
          linha,
          // A data real do evento: o instante da AULA, não o do envio.
          chamada.dados().realizadaEm,
        );
      } else if (linha.confirmada) {
        await this.outbox.enfileirar(
          `${chamada.id}:confirmada`,
          'confirmar_chamada',
          { id: linha.id, confirmada: true },
          chamada.dados().realizadaEm,
        );
      }

      const anteriores = await ler<LinhaPresenca>(this.db, 'presencas');
      const daChamada = anteriores.filter((p) => p.chamada_id === linha.id);
      const outras = anteriores.filter((p) => p.chamada_id !== linha.id);

      const idsNovos = new Set(presencasNovas.map((p) => p.id));
      const idsAntigos = new Set(daChamada.map((p) => p.id));

      for (const p of presencasNovas) {
        if (!idsAntigos.has(p.id)) {
          await this.outbox.enfileirar(p.id, 'criar_presenca', p, p.registrada_em);
        }
      }
      for (const p of daChamada) {
        if (!idsNovos.has(p.id)) {
          await this.outbox.enfileirar(
            `${p.id}:removida`,
            'remover_presenca',
            { id: p.id },
            new Date().toISOString(),
          );
        }
      }

      await escrever(this.db, 'presencas', [...outras, ...presencasNovas]);
    });
  }
}

function chaveDaMatricula(linha: LinhaMatricula): string {
  return `${linha.aluno_id}:${linha.turma_id}:${linha.matriculado_em}`;
}

/**
 * Adaptadores finos que expõem a mesma instância sob cada porta.
 *
 * As portas são separadas no domínio porque representam responsabilidades
 * distintas; a implementação é uma só porque todas compartilham o mesmo
 * banco local e a mesma transação.
 */
export function portasLocais(repos: RepositoriosLocais): {
  alunos: RepositorioDeAlunos;
  turmas: RepositorioDeTurmas;
  matriculas: RepositorioDeMatriculas;
  chamadas: RepositorioDeChamadas;
} {
  return {
    alunos: {
      porId: (id) => repos.porId(id),
      listar: (o) => repos.listar(o),
      daTurma: (t, e) => repos.daTurma(t, e),
      salvar: (a) => repos.salvar(a),
      excluir: (id) => repos.excluir(id),
      contarPresencas: (id) => repos.contarPresencas(id),
    },
    turmas: {
      porId: (id) => repos.turmaPorId(id),
      listar: (o) => repos.listarTurmas(o),
      salvar: (t) => repos.salvarTurma(t),
      excluir: (id) => repos.excluirTurma(id),
      contarChamadas: (id) => repos.contarChamadas(id),
    },
    matriculas: {
      daTurma: (id) => repos.matriculasDaTurma(id),
      doAluno: (id) => repos.doAluno(id),
      salvar: (m) => repos.salvarMatricula(m),
    },
    chamadas: {
      porId: (id) => repos.chamadaPorId(id),
      porTurmaEData: (t, d) => repos.porTurmaEData(t, d),
      listarRecentes: (n) => repos.listarRecentes(n),
      salvar: (c) => repos.salvarChamada(c),
    },
  };
}
