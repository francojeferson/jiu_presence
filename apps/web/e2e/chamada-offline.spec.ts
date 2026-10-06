import { expect, test, type Page } from '@playwright/test';

/**
 * O cenário crítico da feature 001.
 *
 * Roteiro equivalente ao manual descrito em `onboarding.md` §5.4:
 * instalar, ficar offline, fazer a chamada, recarregar, voltar a rede,
 * confirmar que a presença subiu COM A DATA DA AULA.
 *
 * ⚠️ ESTADO: o fluxo offline de ponta a ponta é verificado contra o
 * IndexedDB local. A etapa final — confirmar a chegada ao Supabase — exige
 * um projeto real com as migrações aplicadas e está marcada como `fixme`.
 * Ela faz parte do critério CV-03 do descomissionamento e precisa ser
 * executada manualmente até haver um ambiente de teste provisionado.
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

test.describe('chamada offline', () => {
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

  test('o indicador mostra as pendências offline', async ({ page, context }) => {
    await page.goto('/chamada');
    await aguardarServiceWorker(page);
    await semear(page);
    await page.reload();
    await context.setOffline(true);

    await page.getByRole('button', { name: /Ana Silva/ }).click();
    await page.getByRole('button', { name: /Confirmar/ }).click();

    // RF-29: visível em qualquer tela, sem interação adicional.
    await expect(page.getByText(/aguardando envio/)).toBeVisible({ timeout: 10_000 });
  });

  test.fixme(
    'a presença chega ao Supabase com a data da aula',
    async () => {
      // CV-03 do descomissionamento. Exige um projeto Supabase real com as
      // migrações aplicadas e uma conta de operador provisionada.
      // Até lá, o roteiro manual de onboarding.md §5.4 é o que vale.
    },
  );
});
