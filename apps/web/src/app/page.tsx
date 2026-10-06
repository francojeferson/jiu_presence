'use client';

/**
 * Raiz: decide entre a entrada e a chamada.
 *
 * A sessão é lida do armazenamento LOCAL, sem revalidar contra o servidor.
 * Offline, uma sessão existente é aceita como válida (Fluxo Alternativo A de
 * fundacao-arquitetural): exigir rede para confirmar o login deixaria o
 * professor de fora do app justamente no tatame.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { container } from '@/composicao/container';

export default function Raiz(): React.ReactElement {
  const router = useRouter();
  const [semConfiguracao, setSemConfiguracao] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await container().supabase.auth.getSession();
        router.replace(data.session !== null ? '/chamada' : '/entrar');
      } catch {
        setSemConfiguracao(true);
      }
    })();
  }, [router]);

  if (semConfiguracao) {
    return (
      <main>
        <h1>Configuração incompleta</h1>
        <div className="cartao">
          <p>
            O aplicativo não encontrou as credenciais de acesso ao servidor.
          </p>
          <p style={{ color: 'var(--texto-suave)', fontSize: '0.9rem' }}>
            Quem instalou precisa preencher <code>NEXT_PUBLIC_SUPABASE_URL</code> e{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. O arquivo de exemplo
            está em <code>apps/web/.env.example</code>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="esqueleto" />
    </main>
  );
}
