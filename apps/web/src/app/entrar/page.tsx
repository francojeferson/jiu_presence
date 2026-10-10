'use client';

/**
 * Entrada (RF-07, RF-08).
 *
 * Operador único, conta provisionada manualmente. Não há cadastro aberto,
 * não há recuperação de senha automática.
 *
 * A mensagem de erro NÃO distingue email errado de senha errada: além de ser
 * boa prática, evita que o professor fique tentando adivinhar qual campo
 * está errado quando o problema é outro.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { container, iniciar } from '@/composicao/container';

export default function PaginaDeEntrada(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      const { error } = await container().supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) {
        // Nenhum código do Supabase chega à tela.
        setErro('Email ou senha incorretos.');
        return;
      }
      await iniciar();
      router.replace('/chamada');
    } catch {
      setErro(
        'Não foi possível entrar. Verifique sua conexão e tente de novo.',
      );
    } finally {
      setEntrando(false);
    }
  }

  return (
    <main>
      <h1>JiuPresence</h1>
      <form className="cartao" onSubmit={(e) => void entrar(e)}>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </label>

        <label>
          <span>Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {erro !== null && <p className="erro-texto">{erro}</p>}

        <button
          type="submit"
          className="primario"
          style={{ width: '100%' }}
          disabled={entrando}
        >
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p style={{ color: 'var(--texto-suave)', fontSize: '0.9rem', marginTop: '1rem' }}>
        A primeira entrada exige conexão. Depois disso, o aplicativo abre e a
        chamada funciona mesmo sem internet.
      </p>
    </main>
  );
}
