import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { criarCliente } from '@jiupresence/infrastructure';

/**
 * O cenário crítico da feature 001.
 *
 * Roteiro equivalente ao manual descrito em `onboarding.md` §5.4:
 * instalar, ficar offline, fazer a chamada, recarregar, voltar a rede,
 * confirmar que a presença subiu COM A DATA DA AULA.
 *
 * O fluxo local roda sempre. Com o Supabase local ativo, o cenário final
 * também valida RLS, reconexão, envio e recarga contra o servidor real.
 */

/** Semeia o cache local, substituindo a sincronização com o servidor. */
async function semear(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const abrir = (): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('jiupresence');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

    const db = await abrir();
    const tx = db.transaction('cache', 'readwrite');
    const loja = tx.objectStore('cache');
    const agora = new Date().toISOString();

    const turmaId = '01930000-0000-7000-8000-000000000001';
    const alunoA = '01930000-0000-7000-8000-00000000000a';
    const alunoB = '01930000-0000-7000-8000-00000000000b';

    loja.put({
      chave: 'turmas',
      valor: [
        {
          id: turmaId,
          nome: 'Adulto Noite',
          dias_semana: [0, 1, 2, 3, 4, 5, 6],
          horario: '19:00',
          ativa: true,
          criado_em: agora,
        },
      ],
      atualizadoEm: agora,
      versaoSchema: 1,
    });

    loja.put({
      chave: 'alunos',
      valor: [alunoA, alunoB].map((id, i) => ({
        id,
        nome: i === 0 ? 'Ana Silva' : 'Bruno Costa',
        data_nascimento: '1995-01-01',
        escala: 'adulta',
        faixa_atual: 'azul',
        data_ultima_graduacao: null,
        ativo: true,
        criado_em: agora,
        atualizado_em: agora,
      })),
      atualizadoEm: agora,
      versaoSchema: 1,
    });

    loja.put({
      chave: 'matriculas',
      valor: [alunoA, alunoB].map((aluno_id) => ({
        aluno_id,
        turma_id: turmaId,
        matriculado_em: '2026-01-01',
        desmatriculado_em: null,
      })),
      atualizadoEm: agora,
      versaoSchema: 1,
    });

    loja.put({ chave: 'chamadas', valor: [], atualizadoEm: agora, versaoSchema: 1 });
    loja.put({ chave: 'presencas', valor: [], atualizadoEm: agora, versaoSchema: 1 });

    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
}

async function itensNaFila(page: Page): Promise<unknown[]> {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const req = indexedDB.open('jiupresence');
        req.onsuccess = () => {
          const db = req.result;
          const consulta = db
            .transaction('outbox', 'readonly')
            .objectStore('outbox')
            .getAll();
          consulta.onsuccess = () => {
            resolve(consulta.result as unknown[]);
            db.close();
          };
          consulta.onerror = () => reject(consulta.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
}

/**
 * Espera o service worker ativar E assumir o controle da aba.
 *
 * `navigator.serviceWorker.controller` é null na PRIMEIRA carga, porque o
 * worker ainda nem instalou. Esperar só por ele, sem antes aguardar a
 * ativação, expira sempre.
 */
async function aguardarServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      const registro = await navigator.serviceWorker?.ready;
      return registro?.active?.state === 'activated';
    },
    { timeout: 30_000 },
  );
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, {
    timeout: 15_000,
  });
}

async function autenticar(context: BrowserContext): Promise<void> {
  const url =
    process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'https://exemplo.supabase.co';
  const chaveDoStorage =
    'sb-' + new URL(url).hostname.split('.')[0] + '-auth-token';

  await context.addInitScript((chave) => {
    const codificar = (valor: object): string =>
      btoa(JSON.stringify(valor))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
    const operadorId = '01930000-0000-7000-8000-0000000000ff';
    const expiraEm = 4_102_444_800;
    const accessToken = [
      codificar({ alg: 'HS256', typ: 'JWT' }),
      codificar({
        aud: 'authenticated',
        exp: expiraEm,
        sub: operadorId,
        email: 'professor@example.com',
        role: 'authenticated',
      }),
      'assinatura',
    ].join('.');

    localStorage.setItem(
      chave,
      JSON.stringify({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: expiraEm - Math.floor(Date.now() / 1000),
        expires_at: expiraEm,
        refresh_token: 'refresh-de-teste',
        user: {
          id: operadorId,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'professor@example.com',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          identities: [],
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      }),
    );
  }, chaveDoStorage);
}

function ambienteSupabase():
  | { url: string; chaveAnonima: string; chaveDeServico: string }
  | null {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const chaveAnonima = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const chaveDeServico = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  return url && chaveAnonima && chaveDeServico
    ? { url, chaveAnonima, chaveDeServico }
    : null;
}

test('uma rota privada exige sessão', async ({ page }) => {
  await page.goto('/chamada');

  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chamada' })).toHaveCount(0);
});

test('o service worker não guarda respostas privadas do Supabase', async ({
  page,
  context,
}) => {
  await autenticar(context);
  const origem =
    process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'https://exemplo.supabase.co';
  const urlPrivada = new URL('/rest/v1/segredo-e2e', origem).href;

  await context.route(urlPrivada, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify([{ segredo: true }]),
    });
  });

  await page.goto('/chamada');
  await aguardarServiceWorker(page);

  const resultado = await page.evaluate(async (url) => {
    const resposta = await fetch(url);
    // O NetworkFirst preenche o cache em segundo plano via waitUntil.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      corpo: await resposta.json(),
      cacheada: (await caches.match(url)) !== undefined,
    };
  }, urlPrivada);

  expect(resultado).toEqual({ corpo: [{ segredo: true }], cacheada: false });
});

test.describe('chamada offline', () => {
  test.beforeEach(async ({ context }) => {
    await autenticar(context);
  });

  test('o shell abre sem rede', async ({ page, context }) => {
    await page.goto('/chamada');
    await expect(page.getByRole('heading', { name: 'Chamada' })).toBeVisible();

    await aguardarServiceWorker(page);

    // Segunda visita ONLINE, agora com o service worker no controle.
    // A primeira carga acontece durante a instalação dele, então aquela
    // resposta nunca passa pelo worker e não entra no cache. É o mesmo
    // que ocorre na vida real: o professor abre o app com rede pelo menos
    // uma vez antes de levar para o tatame (EC-01).
    await page.goto('/chamada');
    await expect(page.getByRole('heading', { name: 'Chamada' })).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    // RNF-01: o shell renderiza offline, sem erro de rede.
    await expect(page.getByRole('heading', { name: 'Chamada' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('registra a chamada da turma sem rede e enfileira', async ({ page, context }) => {
    await page.goto('/chamada');
    await aguardarServiceWorker(page);
    await semear(page);
    await page.reload();
    await context.setOffline(true);

    await expect(page.getByRole('button', { name: /Ana Silva/ })).toBeVisible({
      timeout: 10_000,
    });

    // RF-17: a lista mostra TODOS os matriculados, não só os presentes.
    await expect(page.getByRole('button', { name: /Bruno Costa/ })).toBeVisible();

    // Um toque marca (RF-18).
    await page.getByRole('button', { name: /Ana Silva/ }).click();
    await expect(page.getByRole('button', { name: /Ana Silva/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // RF-19: a contagem acompanha.
    await expect(page.getByText('1', { exact: false }).first()).toBeVisible();

    await page.getByRole('button', { name: /Confirmar 1 presente/ }).click();
    await expect(page.getByText(/Chamada registrada/)).toBeVisible();

    // RF-20 e RF-23: gravou localmente e enfileirou, sem erro visível.
    const fila = await itensNaFila(page);
    expect(fila.length).toBeGreaterThan(0);
  });

  test('a fila sobrevive à recarga e ao fechamento da aba', async ({ page, context }) => {
    await page.goto('/chamada');
    await aguardarServiceWorker(page);
    await semear(page);
    await page.reload();
    await context.setOffline(true);

    await page.getByRole('button', { name: /Ana Silva/ }).click();
    await page.getByRole('button', { name: /Confirmar/ }).click();
    await expect(page.getByText(/Chamada registrada/)).toBeVisible();

    const antes = await itensNaFila(page);

    // RF-24: equivalente a fechar o app e reiniciar o aparelho.
    await page.reload();
    const depois = await itensNaFila(page);

    expect(depois.length).toBe(antes.length);
  });

  test('editar depois de confirmar exige nova confirmação', async ({ page, context }) => {
    await page.goto('/chamada');
    await aguardarServiceWorker(page);
    await semear(page);
    await page.reload();
    await context.setOffline(true);

    await page.getByRole('button', { name: /Ana Silva/ }).click();
    await page.getByRole('button', { name: /Confirmar 1 presente/ }).click();
    await expect(page.getByText(/Chamada registrada/)).toBeVisible();

    // RF-14: a edição invalida a confirmação anterior, que passou a descrever
    // uma lista diferente da que está na tela.
    await page.getByRole('button', { name: /Bruno Costa/ }).click();
    await expect(page.getByText(/Chamada registrada/)).toBeHidden();

    await page.getByRole('button', { name: /Confirmar 2 presentes/ }).click();
    await expect(page.getByText(/Chamada registrada/)).toBeVisible();

    // A reconfirmação precisa ter gravado a lista editada, não a anterior.
    await page.reload();
    await expect(page.getByRole('button', { name: /Bruno Costa/ })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 10_000 },
    );
  });

  test('o indicador mostra as pendências offline', async ({ page, context }) => {
    await page.goto('/chamada');
    await aguardarServiceWorker(page);
    await semear(page);
    await page.reload();
    await context.setOffline(true);

    await page.getByRole('button', { name: /Ana Silva/ }).click();
    await page.getByRole('button', { name: /Confirmar/ }).click();

    // RF-29: visível em qualquer tela, sem interação adicional.
    await expect(page.getByText(/aguardando envio/)).toBeVisible({
      timeout: 10_000,
    });
  });
});

test('RLS e sincronização funcionam contra o Supabase local', async ({
  page,
  context,
}) => {
  const ambiente = ambienteSupabase();
  test.skip(ambiente === null, 'Supabase local não está ativo.');
  if (ambiente === null) return;

  const admin = criarCliente({
    url: ambiente.url,
    chaveAnonima: ambiente.chaveDeServico,
  });
  const sufixo = crypto.randomUUID();
  const senha = 'Senha-de-teste-123!';
  const emailSemAcesso = 'sem-acesso-' + sufixo + '@example.com';
  const emailOperador = 'operador-' + sufixo + '@example.com';
  const turmaId = crypto.randomUUID();
  const alunoA = crypto.randomUUID();
  const alunoB = crypto.randomUUID();
  let usuarioSemAcessoId: string | undefined;
  let operadorId: string | undefined;

  try {
    const contaSemAcesso = await admin.auth.admin.createUser({
      email: emailSemAcesso,
      password: senha,
      email_confirm: true,
    });
    expect(contaSemAcesso.error).toBeNull();
    usuarioSemAcessoId = contaSemAcesso.data.user!.id;

    const semAcesso = criarCliente({
      url: ambiente.url,
      chaveAnonima: ambiente.chaveAnonima,
    });
    expect(
      (await semAcesso.auth.signInWithPassword({
        email: emailSemAcesso,
        password: senha,
      })).error,
    ).toBeNull();
    const leituraNegada = await semAcesso.from('aluno').select('id');
    expect(leituraNegada.error).toBeNull();
    expect(leituraNegada.data).toEqual([]);
    const autoprovimento = await semAcesso.from('operador').insert({
      id: usuarioSemAcessoId,
      email: emailSemAcesso,
      nome: 'Não autorizado',
    });
    expect(autoprovimento.error?.code).toBe('42501');

    const contaOperador = await admin.auth.admin.createUser({
      email: emailOperador,
      password: senha,
      email_confirm: true,
    });
    expect(contaOperador.error).toBeNull();
    operadorId = contaOperador.data.user!.id;

    expect(
      (await admin.from('operador').insert({
        id: operadorId,
        email: emailOperador,
        nome: 'Professor E2E',
      })).error,
    ).toBeNull();
    expect(
      (await admin.from('turma').insert({
        id: turmaId,
        nome: 'Turma Supabase',
        dias_semana: [0, 1, 2, 3, 4, 5, 6],
        horario: '19:00',
        ativa: true,
      })).error,
    ).toBeNull();
    expect(
      (await admin.from('aluno').insert([
        {
          id: alunoA,
          nome: 'Ana Supabase',
          escala: 'adulta',
          faixa_atual: 'azul',
          ativo: true,
        },
        {
          id: alunoB,
          nome: 'Bruno Supabase',
          escala: 'adulta',
          faixa_atual: 'branca',
          ativo: true,
        },
      ])).error,
    ).toBeNull();
    expect(
      (await admin.from('matricula').insert([
        {
          aluno_id: alunoA,
          turma_id: turmaId,
          matriculado_em: '2026-01-01',
        },
        {
          aluno_id: alunoB,
          turma_id: turmaId,
          matriculado_em: '2026-01-01',
        },
      ])).error,
    ).toBeNull();

    await page.goto('/entrar');
    await page.getByLabel('Email').fill(emailOperador);
    await page.getByLabel('Senha').fill(senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/chamada$/);
    await expect(page.getByRole('button', { name: /Ana Supabase/ })).toBeVisible();
    const dataDaAula = await page.evaluate(() =>
      new Date().toLocaleDateString('sv-SE', {
        timeZone: 'America/Sao_Paulo',
      }),
    );

    await context.setOffline(true);
    await page.getByRole('button', { name: /Ana Supabase/ }).click();
    await page.getByRole('button', { name: /Confirmar 1 presente/ }).click();
    await expect(page.getByText(/Chamada registrada/)).toBeVisible();
    expect(await itensNaFila(page)).not.toHaveLength(0);

    await context.setOffline(false);
    let chamadaId: string | undefined;
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('chamada')
            .select('id, data')
            .eq('turma_id', turmaId)
            .maybeSingle();
          chamadaId = data?.id;
          return data?.data;
        },
        { timeout: 30_000 },
      )
      .toBe(dataDaAula);
    await expect
      .poll(async () => {
        const { data } = await admin
          .from('presenca')
          .select('aluno_id')
          .eq('chamada_id', chamadaId!);
        return data?.map((item) => item.aluno_id);
      })
      .toEqual([alunoA]);
    await expect.poll(async () => (await itensNaFila(page)).length).toBe(0);

    await page.reload();
    await expect(page.getByRole('button', { name: /Ana Supabase/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  } finally {
    await admin.from('chamada').delete().eq('turma_id', turmaId);
    await admin.from('matricula').delete().eq('turma_id', turmaId);
    await admin.from('aluno').delete().in('id', [alunoA, alunoB]);
    await admin.from('turma').delete().eq('id', turmaId);
    if (operadorId) await admin.auth.admin.deleteUser(operadorId);
    if (usuarioSemAcessoId) {
      await admin.auth.admin.deleteUser(usuarioSemAcessoId);
    }
  }
});
