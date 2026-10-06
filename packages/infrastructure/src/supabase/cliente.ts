/**
 * Cliente Supabase.
 *
 * Credenciais SEMPRE de variáveis de ambiente (RF-36). O projeto Flutter
 * anterior tinha `your-project-id.supabase.co` escrito dentro de
 * `lib/services/supabase_service.dart`; este não repete isso.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ConfiguracaoSupabase {
  readonly url: string;
  readonly chaveAnonima: string;
}

export class ConfiguracaoAusente extends Error {
  constructor(variavel: string) {
    super(
      `A variável de ambiente ${variavel} não está definida. ` +
        'Copie apps/web/.env.example para .env.local e preencha.',
    );
    this.name = 'ConfiguracaoAusente';
  }
}

export function lerConfiguracao(
  ambiente: Record<string, string | undefined>,
): ConfiguracaoSupabase {
  const url = ambiente['NEXT_PUBLIC_SUPABASE_URL'];
  const chaveAnonima = ambiente['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  // Falhar no início, com o nome da variável, em vez de produzir um erro
  // incompreensível em tempo de execução para o professor (EC-05).
  if (!url) throw new ConfiguracaoAusente('NEXT_PUBLIC_SUPABASE_URL');
  if (!chaveAnonima) throw new ConfiguracaoAusente('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return { url, chaveAnonima };
}

export function criarCliente(config: ConfiguracaoSupabase): SupabaseClient {
  return createClient(config.url, config.chaveAnonima, {
    auth: {
      // RF-09: a sessão precisa sobreviver ao reinício do dispositivo.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-client-info': 'jiupresence-web' },
    },
  });
}

export type { SupabaseClient };
