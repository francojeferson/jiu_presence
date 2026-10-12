/**
 * Regra de dependência da Arquitetura Limpa (RF-03, D-04).
 *
 * As dependências apontam SEMPRE para dentro:
 *
 *   apps/web  ->  application  ->  domain
 *        |             |             ^
 *        |             +-> contracts |
 *        +-> infrastructure ---------+
 *
 * Esta verificação existe porque convenção documentada não impede importação
 * indevida. Nas duas tentativas anteriores em Flutter, a ausência de inversão
 * de dependência tornou o código não-testável (SupabaseService instanciado
 * direto dentro das telas) e travou a entrega do núcleo. Aqui, violar a
 * fronteira quebra o build.
 *
 * Verificação negativa obrigatória (onboarding.md §4): adicione uma importação
 * de infrastructure dentro de domain e confirme que `pnpm test` FALHA.
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-nao-depende-de-ninguem',
      severity: 'error',
      comment:
        'packages/domain é o núcleo: TypeScript puro, sem framework, sem HTTP, ' +
        'sem banco, sem browser. Deve compilar e ser testável em Node puro.',
      from: { path: '^packages/domain/src' },
      to: {
        path: '^(packages/(application|infrastructure|contracts)|apps)',
      },
    },
    {
      name: 'application-nao-depende-de-infra-nem-ui',
      severity: 'error',
      comment:
        'packages/application orquestra casos de uso sobre PORTAS. Se precisa ' +
        'de Supabase, Dexie ou React, a dependência está invertida: declare uma ' +
        'porta no domínio e implemente o adaptador na infraestrutura.',
      from: { path: '^packages/application/src' },
      to: { path: '^(packages/infrastructure|apps)' },
    },
    {
      name: 'contracts-e-folha',
      severity: 'error',
      comment:
        'packages/contracts carrega apenas schemas Zod e os tipos derivados. ' +
        'Não deve puxar nenhuma outra camada, senão deixa de ser compartilhável.',
      from: { path: '^packages/contracts/src' },
      to: {
        path: '^(packages/(domain|application|infrastructure)|apps)',
      },
    },
    {
      name: 'infra-nao-depende-de-ui',
      severity: 'error',
      comment:
        'packages/infrastructure implementa portas. Não conhece as telas.',
      from: { path: '^packages/infrastructure/src' },
      to: { path: '^apps' },
    },
    {
      name: 'sem-import-que-nao-resolve',
      severity: 'error',
      comment:
        'Import que o resolvedor não encontra não tem caminho para comparar, ' +
        'então TODAS as regras de camada acima passam por cima dele em ' +
        'silêncio. Era o buraco real desta configuração: um `import ' +
        '"@jiupresence/infrastructure"` dentro de domain, sem a dependência ' +
        'declarada no package.json, não resolvia e a regra não acusava — o ' +
        'build só quebrava no tsc, por outro motivo. Aqui a ausência de ' +
        'resolução vira erro próprio, em vez de virar permissão.',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'sem-dependencia-circular',
      severity: 'error',
      comment: 'Ciclo entre módulos indica fronteira mal desenhada.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'sem-orfaos',
      severity: 'warn',
      comment: 'Módulo que ninguém importa provavelmente é código morto.',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(babel|webpack)\\.config\\.(js|cjs|mjs|ts)$',
          // Rotas do App Router: o Next as carrega por convenção de
          // caminho, não por importação.
          '^apps/web/src/app/',
          // Ponto de entrada de cada pacote.
          '^packages/[^/]+/src/index\\.ts$',
          // Arquivos de configuração: carregados por ferramenta, não
          // importados por código.
          '\\.config\\.(ts|js|cjs|mjs)$',
          '(^|/)vitest\\.workspace\\.ts$',
          // Service worker: ponto de entrada próprio, empacotado à parte.
          '^apps/web/src/app/sw\\.ts$',
          // Apoio de teste (ex.: test/setup.ts). Os `.test.ts` ficam de fora
          // do cruise por `exclude`, então quem importa estes arquivos é
          // invisível aqui e eles apareceriam como órfãos sempre. Não dá para
          // julgar orfandade de um módulo cujos importadores não são lidos.
          '^packages/[^/]+/test/',
        ],
      },
      to: {},
    },
    {
      name: 'nao-tocar-no-legado-flutter',
      severity: 'error',
      comment:
        'O projeto Flutter em lib/, test/, supabase/, web/ e windows/ é legado ' +
        'intocável. Sua remoção é uma feature própria, com critérios de validação ' +
        'em _reversa_sdd/sdd/descomissionamento-do-legado.md. Nenhum módulo do ' +
        'app novo pode depender dele.',
      from: { path: '^(packages|apps)' },
      to: { path: '^(lib|supabase|windows)/' },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        'node_modules',
        '\\.next/',
        '(^|/)dist/',
        '(^|/)coverage/',
        '(^|/)e2e/',
        '\\.test\\.ts$',
        '\\.spec\\.ts$',
        // Service worker gerado pelo build, não é código-fonte.
        '^apps/web/public/sw\\.js',
        // Gerado pelo Next a cada build. Referencia tipos internos do
        // framework (`next/image-types/global`) que não existem como arquivo.
        '^apps/web/next-env\\.d\\.ts$',
      ],
    },
    tsPreCompilationDeps: true,
    // Não é o tsconfig.base.json: este acrescenta o alias `@/`, sem o qual
    // os imports de apps/web não resolvem e escapam das regras acima.
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
