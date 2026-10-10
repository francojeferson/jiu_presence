'use client';

/**
 * Shell da aplicação (RF-55).
 *
 * Dispara a inicialização uma vez e mantém a navegação sempre acessível ao
 * polegar — o uso é de pé, com uma mão.
 *
 * A navegação é renderizada ANTES de a inicialização terminar. O shell
 * precisa aparecer em menos de 2 segundos offline (RNF-01), e esperar o
 * IndexedDB abrir para desenhar a casca jogaria esse alvo fora.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { container, iniciar } from '@/composicao/container';
import { IndicadorDeSincronizacao } from './IndicadorDeSincronizacao';

const ABAS = [
  { href: '/chamada', rotulo: 'Chamada' },
  { href: '/alunos', rotulo: 'Alunos' },
  { href: '/turmas', rotulo: 'Turmas' },
] as const;

export function Shell({ children }: { children: React.ReactNode }): React.ReactElement {
  const caminho = usePathname();
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [sessaoConfirmada, setSessaoConfirmada] = useState(false);
  const naTelaDeEntrada = caminho?.startsWith('/entrar') ?? false;

  useEffect(() => {
    if (naTelaDeEntrada) {
      setSessaoConfirmada(false);
      setPronto(true);
      return;
    }

    let ativa = true;
    setPronto(false);
    void (async () => {
      try {
        const { data } = await container().supabase.auth.getSession();
        if (data.session === null) {
          router.replace('/entrar');
          return;
        }
        if (ativa) setSessaoConfirmada(true);
        await iniciar();
      } catch {
        router.replace('/entrar');
      } finally {
        if (ativa) setPronto(true);
      }
    })();

    return () => {
      ativa = false;
    };
  }, [naTelaDeEntrada, router]);

  if (!naTelaDeEntrada && !sessaoConfirmada) {
    return (
      <main>
        <div className={'esqueleto'} />
        <span
          role={'status'}
          aria-live={'polite'}
          className={'visualmente-oculto'}
        >
          Verificando sessão.
        </span>
      </main>
    );
  }

  return (
    <>
      {!naTelaDeEntrada && <IndicadorDeSincronizacao />}

      {children}

      {!naTelaDeEntrada && (
        <nav className="navegacao" aria-label="Navegação principal">
          {ABAS.map((aba) => (
            <Link
              key={aba.href}
              href={aba.href}
              className={caminho?.startsWith(aba.href) ? 'ativa' : undefined}
              aria-current={caminho?.startsWith(aba.href) ? 'page' : undefined}
            >
              {aba.rotulo}
            </Link>
          ))}
        </nav>
      )}

      {/* Anúncio para leitor de tela; invisível na interface. */}
      <span role="status" aria-live="polite" className="visualmente-oculto">
        {pronto ? 'Aplicativo pronto.' : 'Carregando dados salvos no aparelho.'}
      </span>
    </>
  );
}
