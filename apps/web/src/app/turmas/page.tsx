'use client';

import { useEffect, useState } from 'react';
import { NOMES_DOS_DIAS, type Turma } from '@jiupresence/domain';
import { container } from '@/composicao/container';
import { alternativaDe, mensagemDe } from '@/lib/erros';

export default function PaginaDeTurmas(): React.ReactElement {
  const [turmas, setTurmas] = useState<Turma[] | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ofereceDesativar, setOfereceDesativar] = useState<string | null>(null);

  async function recarregar(): Promise<void> {
    setTurmas(await container().turma.listarAtivas());
  }

  useEffect(() => {
    void recarregar().catch((e: unknown) => {
      setErro(mensagemDe(e));
      setTurmas([]);
    });
  }, []);

  async function excluir(turma: Turma): Promise<void> {
    setErro(null);
    setOfereceDesativar(null);
    try {
      await container().turma.excluir(turma.id);
      await recarregar();
    } catch (e) {
      setErro(mensagemDe(e));
      // EC-04: a alternativa aparece na mesma tela que recusou.
      if (alternativaDe(e) === 'inativar') setOfereceDesativar(turma.id);
    }
  }

  async function desativar(turmaId: string): Promise<void> {
    setErro(null);
    setOfereceDesativar(null);
    try {
      await container().turma.desativar(turmaId as never);
      await recarregar();
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }

  if (turmas === null) {
    return (
      <main>
        <h1>Turmas</h1>
        <div className="esqueleto" />
        <div className="esqueleto" />
      </main>
    );
  }

  return (
    <main>
      <h1>Turmas</h1>

      {erro !== null && (
        <div className="cartao" style={{ borderColor: 'var(--erro)', marginBottom: '1rem' }}>
          <p className="erro-texto" style={{ marginTop: 0 }}>
            {erro}
          </p>
          {ofereceDesativar !== null && (
            <button type="button" onClick={() => void desativar(ofereceDesativar)}>
              Desativar em vez de excluir
            </button>
          )}
        </div>
      )}

      {criando ? (
        <FormularioDeTurma
          aoConcluir={() => {
            setCriando(false);
            void recarregar();
          }}
          aoCancelar={() => setCriando(false)}
        />
      ) : (
        <>
          <button
            type="button"
            className="primario"
            style={{ width: '100%', marginBottom: '1rem' }}
            onClick={() => setCriando(true)}
          >
            Criar turma
          </button>

          {turmas.length === 0 ? (
            <p className="vazio">
              Nenhuma turma cadastrada. Crie a primeira para poder fazer a chamada.
            </p>
          ) : (
            <ul className="lista-chamada">
              {turmas.map((turma) => (
                <li key={turma.id}>
                  <div className="linha-aluno" style={{ cursor: 'default' }}>
                    <span className="nome-aluno">
                      {turma.nome}
                      <span className="faixa-aluno">
                        {' · '}
                        {turma.diasSemana.length === 0
                          ? 'sem dias fixos'
                          : turma.diasSemana.map((d) => NOMES_DOS_DIAS[d]).join(', ')}
                      </span>
                    </span>
                    <span className="faixa-aluno">{turma.horario}</span>
                    <button
                      type="button"
                      onClick={() => void excluir(turma)}
                      style={{ minWidth: 'auto', padding: '0 0.75rem' }}
                    >
                      Excluir
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

function FormularioDeTurma({
  aoConcluir,
  aoCancelar,
}: {
  aoConcluir: () => void;
  aoCancelar: () => void;
}): React.ReactElement {
  const [nome, setNome] = useState('');
  const [horario, setHorario] = useState('19:00');
  const [dias, setDias] = useState<number[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await container().turma.cadastrar({ nome, diasSemana: dias, horario });
      aoConcluir();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="cartao" onSubmit={(e) => void salvar(e)}>
      <label>
        <span>Nome da turma</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Adulto Noite"
          required
          autoFocus
        />
      </label>

      <label>
        <span>Horário</span>
        <input
          type="time"
          value={horario}
          onChange={(e) => setHorario(e.target.value)}
          required
        />
      </label>

      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 1rem' }}>
        <legend style={{ color: 'var(--texto-suave)', fontSize: '0.9rem', padding: 0 }}>
          Dias da semana
        </legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {NOMES_DOS_DIAS.map((nomeDoDia, indice) => (
            <button
              key={nomeDoDia}
              type="button"
              onClick={() =>
                setDias((atual) =>
                  atual.includes(indice)
                    ? atual.filter((d) => d !== indice)
                    : [...atual, indice],
                )
              }
              aria-pressed={dias.includes(indice)}
              style={{
                minWidth: 56,
                padding: '0 0.6rem',
                textTransform: 'capitalize',
                background: dias.includes(indice) ? 'var(--acento)' : undefined,
                borderColor: dias.includes(indice) ? 'var(--acento)' : undefined,
                color: dias.includes(indice) ? '#06080f' : undefined,
              }}
            >
              {nomeDoDia.slice(0, 3)}
            </button>
          ))}
        </div>
      </fieldset>

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
