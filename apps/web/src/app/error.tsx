'use client';

/**
 * Fronteira de erro global (RF-33).
 *
 * Nenhum stack trace chega à tela. O professor recebe uma frase em português
 * e um botão que resolve. Em desenvolvimento, o detalhe técnico fica atrás
 * de um `details` fechado, para não atrapalhar quem está depurando.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { mensagemDe } from '@/lib/erros';

export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ evento: 'erro-nao-tratado', digest: error.digest }));
  }, [error]);

  return (
    <main>
      <h1>Algo não funcionou</h1>
      <div className="cartao">
        <p>{mensagemDe(error)}</p>
        <p style={{ color: 'var(--texto-suave)', fontSize: '0.9rem' }}>
          Nada do que você já registrou foi perdido. As chamadas confirmadas
          continuam salvas no aparelho e serão enviadas quando houver conexão.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button type="button" className="primario" onClick={reset}>
            Tentar de novo
          </button>
          <Link href="/chamada">
            <button type="button">Ir para a chamada</button>
          </Link>
        </div>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <details style={{ marginTop: '1.5rem', color: 'var(--texto-suave)' }}>
          <summary>Detalhe técnico (apenas em desenvolvimento)</summary>
          <pre style={{ overflowX: 'auto', fontSize: '0.8rem' }}>
            {error.stack ?? error.message}
          </pre>
        </details>
      )}
    </main>
  );
}
