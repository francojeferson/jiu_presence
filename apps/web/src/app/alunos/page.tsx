'use client';

/**
 * Listagem e cadastro de alunos.
 *
 * O formulário adapta a escala de faixa conforme a idade calculada, sem
 * perguntar "adulto ou infantil": um campo a menos e uma classe de erro de
 * preenchimento a menos. A exceção é o aluno sem data de nascimento, em que
 * a escolha precisa ser explícita (EC-02).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  FAIXAS_ADULTA,
  FAIXAS_INFANTIL,
  type Aluno,
  type Escala,
  type Turma,
} from '@jiupresence/domain';
import { container } from '@/composicao/container';
import { alternativaDe, mensagemDe } from '@/lib/erros';
import { normalizar } from './busca';

export default function PaginaDeAlunos(): React.ReactElement {
  const [alunos, setAlunos] = useState<Aluno[] | null>(null);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [busca, setBusca] = useState('');
  const [cadastrando, setCadastrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ofereceInativar, setOfereceInativar] = useState<string | null>(null);

  async function recarregar(): Promise<void> {
    const c = container();
    const [lista, listaTurmas] = await Promise.all([
      c.aluno.listar(),
      c.turma.listarAtivas(),
    ]);
    setAlunos(lista);
    setTurmas(listaTurmas);
  }

  useEffect(() => {
    void recarregar().catch((e: unknown) => {
      setErro(mensagemDe(e));
      setAlunos([]);
    });
  }, []);

  // RF-34: busca insensível a acento e caixa. Ganha relevância acima de
  // ~30 alunos, quando rolar a lista deixa de ser viável.
  const visiveis = useMemo(() => {
    if (alunos === null) return null;
    const termo = normalizar(busca);
    if (termo === '') return alunos;
    return alunos.filter((a) => normalizar(a.nome).includes(termo));
  }, [alunos, busca]);

  async function excluir(aluno: Aluno): Promise<void> {
    setErro(null);
    setOfereceInativar(null);
    try {
      await container().aluno.excluir(aluno.id);
      await recarregar();
    } catch (e) {
      setErro(mensagemDe(e));
      // RF-15: a alternativa é oferecida na MESMA tela que recusou.
      if (alternativaDe(e) === 'inativar') setOfereceInativar(aluno.id);
    }
  }

  async function inativar(alunoId: string): Promise<void> {
    setErro(null);
    setOfereceInativar(null);
    try {
      await container().aluno.inativar(alunoId as never);
      await recarregar();
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }

  if (visiveis === null) {
    return (
      <main>
        <h1>Alunos</h1>
        <div className="esqueleto" />
        <div className="esqueleto" />
        <div className="esqueleto" />
      </main>
    );
  }

  return (
    <main>
      <h1>Alunos</h1>

      {erro !== null && (
        <div className="cartao" style={{ borderColor: 'var(--erro)', marginBottom: '1rem' }}>
          <p className="erro-texto" style={{ marginTop: 0 }}>
            {erro}
          </p>
          {ofereceInativar !== null && (
            <button type="button" onClick={() => void inativar(ofereceInativar)}>
              Inativar em vez de excluir
            </button>
          )}
        </div>
      )}

      {cadastrando ? (
        <FormularioDeAluno
          turmas={turmas}
          aoConcluir={() => {
            setCadastrando(false);
            void recarregar();
          }}
          aoCancelar={() => setCadastrando(false)}
        />
      ) : (
        <>
          <button
            type="button"
            className="primario"
            style={{ width: '100%', marginBottom: '1rem' }}
            onClick={() => setCadastrando(true)}
          >
            Cadastrar aluno
          </button>

          {alunos !== null && alunos.length > 8 && (
            <label>
              <span>Buscar</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome do aluno"
              />
            </label>
          )}

          {visiveis.length === 0 ? (
            <p className="vazio">
              {busca === ''
                ? 'Nenhum aluno cadastrado ainda. Comece cadastrando o primeiro.'
                : 'Nenhum aluno com esse nome.'}
            </p>
          ) : (
            <ul className="lista-chamada">
              {visiveis.map((aluno) => (
                <li key={aluno.id}>
                  <div className="linha-aluno" style={{ cursor: 'default' }}>
                    <span className="nome-aluno">
                      {aluno.nome}
                      {!aluno.ativo && (
                        <span className="faixa-aluno"> · inativo</span>
                      )}
                    </span>
                    <span className="faixa-aluno">{aluno.faixa.nome}</span>
                    <button
                      type="button"
                      onClick={() =>
                        aluno.ativo ? void inativar(aluno.id) : void excluir(aluno)
                      }
                      style={{ minWidth: 'auto', padding: '0 0.75rem' }}
                    >
                      {aluno.ativo ? 'Inativar' : 'Excluir'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function FormularioDeAluno({
  turmas,
  aoConcluir,
  aoCancelar,
}: {
  turmas: readonly Turma[];
  aoConcluir: () => void;
  aoCancelar: () => void;
}): React.ReactElement {
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [escalaManual, setEscalaManual] = useState<Escala>('adulta');
  const [faixa, setFaixa] = useState('branca');
  const [turmaIds, setTurmaIds] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const escalaSugerida = useMemo(() => {
    if (dataNascimento === '') return null;
    try {
      return container().aluno.escalaSugerida(dataNascimento);
    } catch {
      return null;
    }
  }, [dataNascimento]);

  const escala = escalaSugerida ?? escalaManual;
  const faixas = escala === 'adulta' ? FAIXAS_ADULTA : FAIXAS_INFANTIL;

  // Trocar de escala pode invalidar a faixa escolhida.
  useEffect(() => {
    if (!faixas.includes(faixa as never)) setFaixa(faixas[0]!);
  }, [faixas, faixa]);

  async function salvar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await container().aluno.cadastrar({
        nome,
        ...(dataNascimento !== '' ? { dataNascimento } : { escala: escalaManual }),
        faixa,
        ...(turmaIds.length > 0 ? { turmaIds: turmaIds as never[] } : {}),
      });
      aoConcluir();
    } catch (e) {
      // Falha ao salvar MANTÉM o formulário preenchido. Nunca descartar o
      // que o professor digitou.
      setErro(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="cartao" onSubmit={(e) => void salvar(e)}>
      <label>
        <span>Nome</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          autoFocus
        />
      </label>

      <label>
        <span>Data de nascimento (opcional)</span>
        <input
          type="date"
          value={dataNascimento}
          onChange={(e) => setDataNascimento(e.target.value)}
        />
      </label>

      {escalaSugerida === null && (
        <label>
          <span>Graduação</span>
          <select
            value={escalaManual}
            onChange={(e) => setEscalaManual(e.target.value as Escala)}
          >
            <option value="adulta">Adulta</option>
            <option value="infantil">Infantil</option>
          </select>
        </label>
      )}

      <label>
        <span>
          Faixa atual
          {escalaSugerida !== null && ` · graduação ${escalaSugerida}`}
        </span>
        <select value={faixa} onChange={(e) => setFaixa(e.target.value)}>
          {faixas.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      {turmas.length > 0 && (
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 1rem' }}>
          <legend style={{ color: 'var(--texto-suave)', fontSize: '0.9rem', padding: 0 }}>
            Turmas
          </legend>
          {turmas.map((t) => (
            <label
              key={t.id}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minHeight: 48 }}
            >
              <input
                type="checkbox"
                style={{ width: 22, height: 22, minHeight: 22 }}
                checked={turmaIds.includes(t.id)}
                onChange={(e) =>
                  setTurmaIds((atual) =>
                    e.target.checked
                      ? [...atual, t.id]
                      : atual.filter((id) => id !== t.id),
                  )
                }
              />
              <span style={{ margin: 0 }}>
                {t.nome} · {t.horario}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {erro !== null && <p className="erro-texto">{erro}</p>}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="submit" className="primario" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={aoCancelar} disabled={salvando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
