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
    const turmaSemGrade = '01930000-0000-7000-8000-000000000002';
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
        // Sem dias fixos de propósito: fica disponível no seletor mas nunca é
        // pré-selecionada, então a turma inicial não depende da hora em que a
        // suíte roda.
        {
          id: turmaSemGrade,
          nome: 'Reposicao',
          dias_semana: [],
          horario: '07:00',
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
      valor: [turmaId, turmaSemGrade].flatMap((turma_id) =>
        [alunoA, alunoB].map((aluno_id) => ({
          aluno_id,
          turma_id,
          matriculado_em: '2026-01-01',
          desmatriculado_em: null,
        })),
      ),
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
 * Põe na fila um item já recusado em definitivo.
 *
 * Chegar a este estado pelo caminho real exigiria um servidor que recusasse
 * o envio; o que esta suíte precisa provar é o que a tela de Pendências faz
 * com ele depois — que é onde o dado do professor pode ser perdido.
 */
async function semearFalhaPermanente(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('jiupresence');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const id = crypto.randomUUID();
    const chamadaId = '01930000-0000-7000-8000-0000000000c1';
    const tx = db.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').put({
      id,
      chaveDeIdempotencia: chamadaId,
      tipo: 'criar_chamada',
      // Payload VÁLIDO de propósito: um payload truncado seria recusado pela
      // validação local antes de qualquer rede, e o teste passaria a ser
      // sobre corrupção local em vez de sobre a decisão do professor.
      payload: {
        id: chamadaId,
        turma_id: '01930000-0000-7000-8000-000000000001',
        data: '2026-10-04',
        realizada_em: '2026-10-04T22:00:00Z',
        origem: 'manual',
        total_detectado: null,
        confirmada: true,
        criada_offline: true,
      },
      criadoEm: new Date().toISOString(),
      ordem: 9_999,
      tentativas: 3,
      proximaTentativaEm: null,
      estado: 'falha_permanente',
      erro: 'Já existe uma chamada registrada para esta turma neste dia.',
    });
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
    return id;
  });
}

/** Chaves presentes no cache local. Vazio significa aparelho limpo. */
async function chavesNoCache(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const req = indexedDB.open('jiupresence');
        req.onsuccess = () => {
          const db = req.result;
          const consulta = db
            .transaction('cache', 'readonly')
            .objectStore('cache')
            .getAllKeys();
          consulta.onsuccess = () => {
            resolve(consulta.result as string[]);
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

/** Onde o supabase-js guarda a sessão neste ambiente. */
function chaveDaSessao(): string {
  const url =
    process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'https://exemplo.supabase.co';
  return 'sb-' + new URL(url).hostname.split('.')[0] + '-auth-token';
}

async function autenticar(context: BrowserContext): Promise<void> {
  const chaveDoStorage = chaveDaSessao();

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

/**
 * Uma página que o professor nunca abriu diretamente precisa abrir sem rede.
 *
 * O manifesto gerado pelo Serwist traz só JS, CSS e ícones — nenhum HTML.
 * Sem as entradas extras de `next.config.ts`, a única página que funcionava
 * offline era a que por acaso já tinha sido carregada online, e o fallback
 * `/offline` nem podia ser servido, porque ele próprio não estava em cache.
 * O professor via o erro de rede do navegador.
 */
test('qualquer página abre sem rede, não só a última visitada', async ({
  page,
  context,
}) => {
  await autenticar(context);
  await page.goto('/');
  await aguardarServiceWorker(page);

  await context.setOffline(true);
  await page.goto('/turmas');

  await expect(page.getByRole('heading', { name: 'Turmas' })).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
});

/**
 * Um endereço desconhecido, sem rede, cai na página de fallback.
 *
 * É o único caso em que `/offline` ainda aparece. As rotas do app estão todas
 * no pré-cache, e numa abertura sem rede ANTES da primeira visita online não
 * existe service worker instalado — quem responde ali é o navegador, com a
 * tela de erro dele. Sem este teste, `/offline` seria tela sem caminho.
 */
test('endereço desconhecido sem rede cai na página de fallback', async ({
  page,
  context,
}) => {
  await autenticar(context);
  await page.goto('/');
  await aguardarServiceWorker(page);

  await context.setOffline(true);
  await page.goto('/endereco-que-nao-existe');

  await expect(page.getByRole('heading', { name: 'Sem conexão' })).toBeVisible();
});

/**
 * O manifesto só habilita a instalação se os ícones que ele promete existirem
 * de verdade. Eles já faltaram uma vez, e nada na build acusa a ausência.
 */
test('o manifesto entrega todos os ícones que promete', async ({ request }) => {
  const resposta = await request.get('/manifest.json');
  expect(resposta.ok()).toBe(true);

  const manifesto = (await resposta.json()) as {
    icons: { src: string; sizes: string }[];
  };
  expect(manifesto.icons.length).toBeGreaterThan(0);

  for (const icone of manifesto.icons) {
    const arquivo = await request.get(icone.src);
    expect(arquivo.status(), icone.src).toBe(200);
    expect(arquivo.headers()['content-type'], icone.src).toContain('image/png');
  }
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

  test('trocar de turma não descarta marcações sem avisar', async ({ page, context }) => {
    await page.goto('/chamada');
    await aguardarServiceWorker(page);
    await semear(page);
    await page.reload();
    await context.setOffline(true);

    await page.getByRole('button', { name: /Ana Silva/ }).click();
    await expect(page.getByRole('button', { name: /Ana Silva/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // A marcação só existe em memória até confirmar: trocar de turma agora
    // apagaria a chamada inteira, e antes disso acontecia sem aviso nenhum.
    await page.getByLabel('Turma').selectOption({ label: 'Reposicao · 07:00' });
    await expect(page.getByText(/descarta essas marcações/)).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText(/descarta essas marcações/)).toBeHidden();
    // Continua na turma original, com a marcação intacta.
    await expect(page.getByRole('button', { name: /Ana Silva/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // E quando o professor confirma que quer mesmo, a troca acontece.
    await page.getByLabel('Turma').selectOption({ label: 'Reposicao · 07:00' });
    await page.getByRole('button', { name: 'Sim, trocar' }).click();
    await expect(page.getByRole('button', { name: /Ana Silva/ })).toHaveAttribute(
      'aria-pressed',
      'false',
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

/**
 * As telas de administração.
 *
 * Inativar e desativar precisam ter volta. Sem isso, o aluno que retorna ao
 * tatame e a turma que volta à grade teriam que ser recriados, e o registro
 * novo não carrega o histórico de frequência do antigo — que é o ativo em
 * cima do qual a graduação é decidida.
 */
test.describe('administração', () => {
  test.beforeEach(async ({ context }) => {
    await autenticar(context);
  });

  async function prepararOffline(page: Page, context: BrowserContext, rota: string) {
    await page.goto('/chamada');
    await aguardarServiceWorker(page);
    await semear(page);
    await page.goto(rota);
    await context.setOffline(true);
  }

  /**
   * EC-02: sem data de nascimento a escala é escolhida à mão, e essa escolha
   * precisa chegar ao caso de uso.
   *
   * Antes, o formulário só mandava a escala quando o campo de DATA estava
   * vazio, e não quando o SELETOR estava visível. Com uma data que não sugere
   * escala, o professor escolhia a graduação e recebia de volta um erro
   * mandando informar a graduação — sem saída a não ser apagar a data.
   */
  test('cadastra aluno sem data escolhendo a graduação', async ({ page, context }) => {
    await prepararOffline(page, context, '/alunos');

    await page.getByRole('button', { name: 'Cadastrar aluno' }).click();

    // Ninguém nasce amanhã: o navegador recusa antes de chegar ao caso de uso.
    const hoje = await page.evaluate(() =>
      new Date().toLocaleDateString('sv-SE'),
    );
    await expect(page.getByLabel(/Data de nascimento/)).toHaveAttribute('max', hoje);

    await page.getByLabel('Nome').fill('Mini Gracie');
    await page.getByLabel('Graduação').selectOption('infantil');
    // A escala infantil tem faixas próprias; 'cinza' não existe na adulta.
    await page.getByLabel(/Faixa atual/).selectOption('cinza');
    await page.getByRole('button', { name: 'Salvar' }).click();

    const linha = page.getByRole('listitem').filter({ hasText: 'Mini Gracie' });
    await expect(linha).toBeVisible();
    await expect(linha.getByText('cinza')).toBeVisible();
  });

  test('aluno inativado pode voltar', async ({ page, context }) => {
    await prepararOffline(page, context, '/alunos');

    const linha = page.getByRole('listitem').filter({ hasText: 'Ana Silva' });
    await linha.getByRole('button', { name: 'Inativar' }).click();

    await expect(linha.getByText('· inativo')).toBeVisible();
    await expect(linha.getByRole('button', { name: 'Reativar' })).toBeVisible();

    await linha.getByRole('button', { name: 'Reativar' }).click();

    await expect(linha.getByText('· inativo')).toBeHidden();
    await expect(linha.getByRole('button', { name: 'Inativar' })).toBeVisible();
  });

  test('turma desativada pode voltar', async ({ page, context }) => {
    await prepararOffline(page, context, '/chamada');

    // EC-04 só vale com histórico: sem chamada registrada, a turma seria
    // simplesmente excluída e não haveria desativação para desfazer.
    await page.getByRole('button', { name: /Ana Silva/ }).click();
    await page.getByRole('button', { name: /Confirmar 1 presente/ }).click();
    await expect(page.getByText(/Chamada registrada/)).toBeVisible();

    await page.goto('/turmas');
    const linha = page.getByRole('listitem').filter({ hasText: 'Adulto Noite' });
    await linha.getByRole('button', { name: 'Excluir' }).click();

    // A alternativa aparece na MESMA tela que recusou.
    await page.getByRole('button', { name: 'Desativar em vez de excluir' }).click();
    await expect(linha.getByText('· desativada')).toBeVisible();

    await linha.getByRole('button', { name: 'Reativar' }).click();
    await expect(linha.getByText('· desativada')).toBeHidden();
  });
});

/**
 * A tela de Pendências (RF-11).
 *
 * Falha permanente nunca é descartada em silêncio: fica visível, explicada em
 * português e acionável. É a última barreira antes de o registro do professor
 * se perder, e descartar exige confirmação explícita.
 */
test.describe('pendências', () => {
  test.beforeEach(async ({ context }) => {
    await autenticar(context);
  });

  async function prepararComFalha(page: Page, context: BrowserContext) {
    await page.goto('/chamada');
    await aguardarServiceWorker(page);
    await semear(page);
    await semearFalhaPermanente(page);
    await context.setOffline(true);
    await page.goto('/pendencias');
  }

  test('o indicador leva até a falha, explicada em português', async ({
    page,
    context,
  }) => {
    await page.goto('/chamada');
    await aguardarServiceWorker(page);
    await semear(page);
    await semearFalhaPermanente(page);
    await context.setOffline(true);
    await page.reload();

    // RF-29: o único estado que pede atenção, porque é o único que exige
    // decisão do professor.
    await page
      .getByRole('link', { name: /precisa da sua atenção/ })
      .click({ timeout: 10_000 });

    await expect(page.getByRole('heading', { name: 'Pendências' })).toBeVisible();
    // Dentro do item da lista: 'Chamada' também é o rótulo da aba de baixo.
    const item = page.getByRole('listitem').filter({ hasText: 'Chamada' });
    await expect(item.getByText('Chamada', { exact: true })).toBeVisible();
    await expect(
      item.getByText('Já existe uma chamada registrada para esta turma neste dia.'),
    ).toBeVisible();
  });

  test('descartar exige confirmação explícita', async ({ page, context }) => {
    await prepararComFalha(page, context);

    await page.getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByText(/Não dá para desfazer/)).toBeVisible();

    // Desistir não apaga nada.
    await page.getByRole('button', { name: 'Cancelar' }).click();
    expect(await itensNaFila(page)).toHaveLength(1);

    await page.getByRole('button', { name: 'Descartar' }).click();
    await page.getByRole('button', { name: 'Sim, descartar' }).click();

    await expect(page.getByText(/Nada pendente/)).toBeVisible();
    expect(await itensNaFila(page)).toHaveLength(0);
  });

  test('tentar de novo devolve o item à fila sem perdê-lo', async ({
    page,
    context,
  }) => {
    await prepararComFalha(page, context);

    await page.getByRole('button', { name: 'Tentar de novo' }).click();

    // Saiu da lista de falhas, mas continua na fila: offline a tentativa não
    // tem como suceder, e descartar por isso seria perder o registro.
    await expect(page.getByText(/Nada pendente/)).toBeVisible();
    const fila = (await itensNaFila(page)) as { estado: string }[];
    expect(fila).toHaveLength(1);
    expect(fila[0]!.estado).toBe('pendente');
  });
});

/**
 * A saída da conta.
 *
 * O cache carrega nome e data de nascimento de aluno, inclusive de menores, e
 * precisa sair do aparelho junto com a sessão. A fila, ao contrário, nunca é
 * apagada — e por isso a saída é recusada enquanto houver algo nela.
 */
test.describe('saída da conta', () => {
  test.beforeEach(async ({ context }) => {
    await autenticar(context);
  });

  test('apaga os dados do aparelho e volta para a entrada', async ({
    page,
    context,
  }) => {
    await page.goto('/chamada');
    await aguardarServiceWorker(page);
    await semear(page);
    await page.goto('/turmas');
    await context.setOffline(true);

    expect(await chavesNoCache(page)).not.toHaveLength(0);

    await page.getByRole('button', { name: 'Sair da conta' }).click();
    await expect(page.getByText(/apaga do aparelho/)).toBeVisible();
    await page.getByRole('button', { name: 'Sim, sair' }).click();

    await expect(page).toHaveURL(/\/entrar$/);
    expect(await chavesNoCache(page)).toHaveLength(0);
  });

  test('é recusada enquanto há registro por enviar', async ({ page, context }) => {
    await page.goto('/chamada');
    await aguardarServiceWorker(page);
    await semear(page);
    await page.reload();
    await context.setOffline(true);

    await page.getByRole('button', { name: /Ana Silva/ }).click();
    await page.getByRole('button', { name: /Confirmar 1 presente/ }).click();
    await expect(page.getByText(/Chamada registrada/)).toBeVisible();

    await page.goto('/turmas');
    await page.getByRole('button', { name: 'Sair da conta' }).click();

    await expect(page.getByText(/por enviar/)).toBeVisible();
    // Não saiu, não perguntou e não apagou nada.
    await expect(page.getByRole('button', { name: 'Sim, sair' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/turmas$/);
    expect(await itensNaFila(page)).not.toHaveLength(0);
  });
});

/**
 * A sessão, não só a tela.
 *
 * Precisa de login de VERDADE: `autenticar` injeta o token por
 * `addInitScript`, que roda de novo a cada carga de documento — e offline a
 * ida para `/entrar` é uma carga de documento, porque o roteador do Next
 * não alcança o payload da rota e cai na navegação cheia. O harness
 * reinstalaria o token recém-apagado e o teste passaria sem provar nada.
 */
test('a sessão não sobrevive à saída', async ({ page, context }) => {
  const ambiente = ambienteSupabase();
  test.skip(ambiente === null, 'Supabase local não está ativo.');
  if (ambiente === null) return;

  const admin = criarCliente({
    url: ambiente.url,
    chaveAnonima: ambiente.chaveDeServico,
  });
  const email = 'saida-' + crypto.randomUUID() + '@example.com';
  const senha = 'Senha-de-teste-123!';
  let usuarioId: string | undefined;

  try {
    const conta = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    expect(conta.error).toBeNull();
    usuarioId = conta.data.user!.id;

    await page.goto('/entrar');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Senha').fill(senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/chamada$/);

    await page.goto('/turmas');
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Sair da conta' }).click();
    await page.getByRole('button', { name: 'Sim, sair' }).click();
    await expect(page).toHaveURL(/\/entrar$/);

    expect(
      await page.evaluate((chave) => localStorage.getItem(chave), chaveDaSessao()),
    ).toBeNull();

    // E quem pegar o aparelho não entra voltando para a tela de chamada.
    await page.goto('/chamada');
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  } finally {
    if (usuarioId) await admin.auth.admin.deleteUser(usuarioId);
  }
});


/**
 * A mensagem de entrada não diz QUAL campo está errado.
 *
 * Distinguir "esse email não existe" de "a senha está errada" entrega a
 * quem tentar a lista de contas válidas. E, para o professor, saber o campo
 * não ajuda: a conta é provisionada à mão, não há cadastro para conferir.
 */
test('email inexistente e senha errada dão a mesma resposta', async ({ page }) => {
  const ambiente = ambienteSupabase();
  test.skip(ambiente === null, 'Supabase local não está ativo.');
  if (ambiente === null) return;

  const admin = criarCliente({
    url: ambiente.url,
    chaveAnonima: ambiente.chaveDeServico,
  });
  const email = 'login-' + crypto.randomUUID() + '@example.com';
  const senha = 'Senha-de-teste-123!';
  let usuarioId: string | undefined;

  try {
    const conta = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    expect(conta.error).toBeNull();
    usuarioId = conta.data.user!.id;

    const tentar = async (
      emailDigitado: string,
      senhaDigitada: string,
    ): Promise<string> => {
      await page.goto('/entrar');
      await page.getByLabel('Email').fill(emailDigitado);
      await page.getByLabel('Senha').fill(senhaDigitada);
      await page.getByRole('button', { name: 'Entrar' }).click();
      const erro = page.locator('.erro-texto');
      await expect(erro).toBeVisible();
      return (await erro.textContent()) ?? '';
    };

    const contaReal = await tentar(email, 'senha-errada');
    const contaInexistente = await tentar('ninguem-' + email, senha);

    expect(contaReal).toBe(contaInexistente);
    // E nenhum código técnico do Supabase chega à tela.
    expect(contaReal).not.toMatch(/invalid|credential|grant|400/i);
    await expect(page).toHaveURL(/\/entrar$/);
  } finally {
    if (usuarioId) await admin.auth.admin.deleteUser(usuarioId);
  }
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
