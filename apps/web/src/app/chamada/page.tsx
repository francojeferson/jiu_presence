'use client';

/**
 * Tela de chamada manual.
 *
 * A tela mais importante do produto: é onde a métrica primária é ganha ou
 * perdida (menos de 90 segundos para 20 alunos no caminho manual).
 *
 * Três decisões de interface vêm direto da spec:
 *
 *  1. A lista mostra TODOS os matriculados, presentes e ausentes (RF-17).
 *     A pergunta real do professor é "quem faltou"; uma lista só de
 *     presentes transferiria a subtração para ele, no pior momento.
 *
 *  2. A linha inteira é o alvo de toque, com 64 px de altura. Um toque
 *     alterna. Zero navegação durante a marcação.
 *
 *  3. O botão de confirmar é fixo e sempre visível, nunca atrás de rolagem.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Turma } from '@jiupresence/domain';
import type { ChamadaEmAndamento } from '@jiupresence/application';
import { container } from '@/composicao/container';
import { mensagemDe } from '@/lib/erros';

export default function PaginaDeChamada(): React.ReactElement {
  const [turmas, setTurmas] = useState<Turma[] | null>(null);
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [chamada, setChamada] = useState<ChamadaEmAndamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmada, setConfirmada] = useState(false);

  // Pré-seleção da turma do horário atual (RF-01): um toque a menos no
  // momento de maior pressa.
  useEffect(() => {
    void (async () => {
      try {
        const casos = container().turma;
        const [lista, doHorario] = await Promise.all([
          casos.listarAtivas(),
          casos.doHorarioAtual(),
        ]);
        setTurmas(lista);
        setTurmaId(doHorario?.id ?? lista[0]?.id ?? null);
      } catch (e) {
        setErro(mensagemDe(e));
        setTurmas([]);
      }
    })();
  }, []);

  const abrir = useCallback(async (id: string) => {
    setErro(null);
    setConfirmada(false);
    try {
      const emAndamento = await container().chamada.abrir(id as never);
      setChamada(emAndamento);
    } catch (e) {
      setChamada(null);
      setErro(mensagemDe(e));
    }
  }, []);

  useEffect(() => {
    if (turmaId !== null) void abrir(turmaId);
  }, [turmaId, abrir]);

  async function alternar(alunoId: string): Promise<void> {
    if (chamada === null) return;
    try {
      setChamada(await container().chamada.alternarPresenca(chamada, alunoId as never));
      // A confirmação anterior deixou de descrever a lista na tela: a versão
      // editada só existe em memória até uma nova confirmação (RF-14).
      setConfirmada(false);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }

  async function confirmar(): Promise<void> {
    if (chamada === null) return;
    setSalvando(true);
    setErro(null);
    try {
      await container().chamada.confirmar(chamada);
      setConfirmada(true);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  }

  if (turmas === null) {
    return (
      <main>
        <h1>Chamada</h1>
        <div className="esqueleto" />
        <div className="esqueleto" />
        <div className="esqueleto" />
      </main>
    );
  }

  if (turmas.length === 0) {
    return (
      <main>
        <h1>Chamada</h1>
        <p className="vazio">
          Nenhuma turma cadastrada ainda.
          <br />
          Crie uma turma para começar a fazer a chamada.
        </p>
      </main>
    );
  }

  return (
    <main>
      <div className="cabecalho-chamada">
        <h1>Chamada</h1>
        {chamada !== null && (
          <span className="contagem">
            <strong>{chamada.totalDePresentes}</strong> de{' '}
            {chamada.totalDePresentes + chamada.totalDeAusentes}
          </span>
        )}
      </div>

      <label>
        <span>Turma</span>
        <select
          value={turmaId ?? ''}
          onChange={(e) => setTurmaId(e.target.value)}
          disabled={salvando}
        >
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome} · {t.horario}
            </option>
          ))}
        </select>
      </label>

      {chamada?.jaExistia === true && !confirmada && (
        <p className="aviso">
          Já havia uma chamada registrada para esta turma hoje. Você está
          editando a existente.
        </p>
      )}

      {chamada?.foraDaGrade === true && (
        <p className="aviso">
          Esta turma não tem aula neste dia da semana. Registrando mesmo assim.
        </p>
      )}

      {erro !== null && <p className="erro-texto">{erro}</p>}

      {confirmada && (
        <p className="aviso" role="status">
          Chamada registrada. Pode começar a aula.
        </p>
      )}

      {chamada !== null && (
        <>
          <ul className="lista-chamada">
            {chamada.linhas.map((linha) => (
              <li key={linha.aluno.id}>
                <button
                  type="button"
                  className={`linha-aluno${linha.presente ? ' presente' : ''}`}
                  onClick={() => void alternar(linha.aluno.id)}
                  aria-pressed={linha.presente}
                >
                  <span className="marcador" aria-hidden="true">
                    ✓
                  </span>
                  <span className="nome-aluno">{linha.aluno.nome}</span>
                  <span className="faixa-aluno">{linha.aluno.faixa.nome}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="barra-acao">
            <button
              type="button"
              className="primario"
              onClick={() => void confirmar()}
              disabled={salvando}
            >
              {salvando
                ? 'Salvando…'
                : `Confirmar ${chamada.totalDePresentes} presente${chamada.totalDePresentes === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
