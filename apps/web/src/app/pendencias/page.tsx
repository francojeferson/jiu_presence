'use client';

/**
 * Registros que falharam em definitivo (RF-11).
 *
 * Falha permanente nunca é descartada em silêncio: é visível, explicada em
 * português e acionável. O professor decide se tenta de novo ou se descarta,
 * e descartar exige confirmação explícita.
 */

import { useEffect, useState } from 'react';
import { Outbox, bancoLocal, type ItemDaFila } from '@jiupresence/infrastructure';
import { container } from '@/composicao/container';
import { mensagemDe } from '@/lib/erros';

const ROTULOS: Record<string, string> = {
  criar_aluno: 'Cadastro de aluno',
  atualizar_aluno: 'Edição de aluno',
  inativar_aluno: 'Inativação de aluno',
  criar_turma: 'Cadastro de turma',
  atualizar_turma: 'Edição de turma',
  criar_matricula: 'Matrícula',
  encerrar_matricula: 'Desmatrícula',
  criar_chamada: 'Chamada',
  confirmar_chamada: 'Confirmação de chamada',
  criar_presenca: 'Presença',
  remover_presenca: 'Remoção de presença',
};

export default function PaginaDePendencias(): React.ReactElement {
  const [itens, setItens] = useState<ItemDaFila[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState<string | null>(null);

  const outbox = new Outbox(bancoLocal());

  async function recarregar(): Promise<void> {
    setItens(await outbox.falhasPermanentes());
  }

  useEffect(() => {
    void recarregar().catch((e: unknown) => {
      setErro(mensagemDe(e));
      setItens([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tentarDeNovo(id: string): Promise<void> {
    setErro(null);
    try {
      await outbox.reativar(id);
      await container().sincronizador.sincronizarAgora();
      await recarregar();
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }

  async function descartar(id: string): Promise<void> {
    setErro(null);
    setConfirmandoDescarte(null);
    try {
      await outbox.concluir(id);
      await recarregar();
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }

  if (itens === null) {
    return (
      <main>
        <h1>Pendências</h1>
        <div className="esqueleto" />
      </main>
    );
  }

  if (itens.length === 0) {
    return (
      <main>
        <h1>Pendências</h1>
        <p className="vazio">
          Nada pendente. Tudo o que você registrou já chegou ao servidor.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Pendências</h1>
      <p style={{ color: 'var(--texto-suave)' }}>
        Estes registros não puderam ser enviados e precisam da sua decisão.
        Nada foi apagado.
      </p>

      {erro !== null && <p className="erro-texto">{erro}</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {itens.map((item) => (
          <li key={item.id} className="cartao" style={{ marginBottom: '0.75rem' }}>
            <strong>{ROTULOS[item.tipo] ?? item.tipo}</strong>
            <p style={{ margin: '0.4rem 0', color: 'var(--texto-suave)' }}>
              {item.erro ?? 'Motivo não registrado.'}
            </p>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--texto-suave)' }}>
              Registrado em {new Date(item.criadoEm).toLocaleString('pt-BR')}
            </p>

            {confirmandoDescarte === item.id ? (
              <>
                <p className="erro-texto">
                  Descartar apaga este registro definitivamente. Não dá para desfazer.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" onClick={() => void descartar(item.id)}>
                    Sim, descartar
                  </button>
                  <button type="button" onClick={() => setConfirmandoDescarte(null)}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="primario"
                  onClick={() => void tentarDeNovo(item.id)}
                >
                  Tentar de novo
                </button>
                <button type="button" onClick={() => setConfirmandoDescarte(item.id)}>
                  Descartar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
