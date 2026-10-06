import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright com perfil móvel e controle de rede.
 *
 * O cenário crítico desta feature — chamada offline, recarga, sincronização
 * com a data da aula preservada — só é verificável em navegador real com
 * controle de conectividade. Nenhum teste em jsdom prova isso.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'list',

  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'celular',
      use: {
        ...devices['Pixel 7'],
        // O professor usa o celular dele, não um desktop.
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
      },
    },
  ],

  webServer: {
    // Produção, não desenvolvimento: o service worker é desligado em dev
    // (ver next.config.ts), e sem ele não há como testar offline.
    command: 'pnpm run build && pnpm exec next start --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'https://exemplo.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? 'chave-de-teste',
    },
  },
});
