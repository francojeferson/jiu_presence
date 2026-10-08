# Auditoria técnica Ponytail

- **Data:** 8 de outubro de 2026
- **Escopo:** repositório completo
- **Modo:** somente leitura; durante a auditoria original nenhum arquivo de produto foi alterado

## O que este repositório faz

O produto ativo é uma PWA em Next.js para administrar alunos, turmas, matrículas e chamadas de uma academia de jiu-jítsu, inclusive offline, com sincronização posterior para o Supabase. O aplicativo Flutter na raiz é legado; a implementação atual está em `apps/web` e nos pacotes TypeScript.

Carga considerada na análise: uma academia, um operador, aproximadamente 300 alunos e 20 participantes por aula, uso offline frequente e sem dispositivos concorrentes.

## Resultado executivo

O sistema ainda não está pronto para produção. Há falhas de autorização e sincronização offline capazes de expor ou perder dados de chamada, e o comando normal de testes está vermelho.

## Evidências de validação

- Build de produção do Next.js: passou.
- Verificações TypeScript: passaram.
- Testes de domínio: 114 de 114 passaram.
- Testes de aplicação: 42 de 42 passaram.
- Testes de infraestrutura: o comando normal apresentou 33 falhas por ausência da API IndexedDB; com `fake-indexeddb/auto` carregado manualmente, 51 de 51 passaram.
- Regras de arquitetura: zero erros e um aviso sobre o arquivo de setup de infraestrutura órfão.
- Auditoria de dependências de produção: quatro vulnerabilidades transitivas em PostCSS.
- E2E completo: a execução travou e foi encerrada.
- Estado do Git ao fim da auditoria: limpo.

## Correções obrigatórias

### 1. Toda conta autenticada funciona como administradora

- **O que é:** As políticas RLS do banco autorizam qualquer usuário com ID não nulo em [operador](../infra/supabase/migrations/0002_operador.sql#L24), [alunos, turmas e matrículas](../infra/supabase/migrations/0003_alunos_turmas_matriculas.sql#L92) e [chamadas e presenças](../infra/supabase/migrations/0004_chamadas_presencas.sql#L81).
- **Problema:** Qualquer conta autenticada pode ler ou alterar todos os dados da academia e os registros de operador. O Supabase também habilita cadastro de usuários por padrão, salvo configuração manual ([referência oficial](https://supabase.com/docs/guides/local-development/cli/config)).
- **Correção:** Autorizar cada política por meio de um registro `operador` previamente provisionado; permitir ao operador ler apenas o próprio cadastro e impedir que o cliente crie ou eleve operadores. Adicionar testes para usuário anônimo, usuário não autorizado e operador.
- **Se ignorarmos:** Uma conta criada ou indevida poderá expor ou adulterar todos os dados de alunos e chamadas.

### 2. Páginas protegidas não exigem sessão

- **O que é:** Apenas a página raiz verifica autenticação; o [Shell.tsx](../apps/web/src/componentes/Shell.tsx#L30) inicializa os serviços sem proteger `/alunos`, `/turmas` ou `/chamada`.
- **Problema:** Abrir essas URLs diretamente expõe dados pessoais armazenados no IndexedDB quando a sessão não existe ou foi removida. O próprio teste de navegador acessa `/chamada` diretamente.
- **Correção:** Colocar uma única guarda de sessão no shell ou layout compartilhado, excetuando `/entrar`, e permitir uso offline somente quando existir uma sessão persistida.
- **Se ignorarmos:** Os dados locais da academia continuarão visíveis para uma pessoa não autenticada que use o mesmo navegador.

### 3. O service worker pode armazenar respostas autenticadas do Supabase

- **O que é:** O [sw.ts](../apps/web/src/app/sw.ts#L43) instala o cache padrão do Serwist, que inclui uma regra `NetworkFirst` genérica para requisições entre origens.
- **Problema:** Respostas GET do Supabase podem entrar no Cache Storage com chave baseada na URL, permanecer desatualizadas por uma hora e ser reutilizadas depois de uma troca de conta.
- **Correção:** Registrar uma regra `NetworkOnly` para a origem configurada do Supabase antes das regras padrão, ou remover a regra genérica entre origens.
- **Se ignorarmos:** Dados sensíveis ou antigos poderão ser entregues fora da requisição autenticada pretendida.

### 4. O status HTTP real dos erros é descartado

- **O que é:** O [operacoes.ts](../packages/infrastructure/src/supabase/operacoes.ts#L104) recebe o `status` do Supabase, mas chama o conversor de erro sem repassá-lo.
- **Problema:** Respostas como 429 e 503 viram status 400 e são classificadas como falhas permanentes, em vez de falhas que devem ser tentadas novamente.
- **Correção:** Passar o status para todas as chamadas `respostaDeErro(error, status)` e adicionar testes de adaptador para 401, 429 e 503.
- **Se ignorarmos:** Uma indisponibilidade temporária poderá abandonar definitivamente uma chamada válida.

### 5. A fila de saída pode sobrescrever ou apagar trabalho mais novo

- **O que é:** O [outbox.ts](../packages/infrastructure/src/local/outbox.ts#L70) usa o ID da entidade como chave primária e grava com `put`.
- **Problema:** Uma atualização offline pode substituir a criação ainda pendente; uma nova alteração feita durante a sincronização também pode ser apagada quando a requisição anterior termina.
- **Correção:** Dar chaves únicas ou versionadas às operações, preservar criações ao consolidar eventos e concluir um item somente se a `ordem` armazenada ainda for igual à versão enviada.
- **Se ignorarmos:** Alunos, presenças ou alterações poderão desaparecer sem chegar ao servidor.

### 6. O backoff não agenda uma nova tentativa

- **O que é:** Depois de uma falha transitória, o [sincronizador.ts](../packages/infrastructure/src/sync/sincronizador.ts#L130) grava uma data futura e para.
- **Problema:** Nenhum temporizador acorda o sincronizador; é necessário reiniciar o aplicativo, mudar o estado da rede ou disparar uma ação manual.
- **Correção:** Agendar um único temporizador para a próxima tentativa pendente e reagendá-lo quando a fila mudar.
- **Se ignorarmos:** Uma falha breve do servidor poderá deixar a fila parada enquanto o navegador continua online.

### 7. A carga de presenças atinge silenciosamente o limite do Supabase

- **O que é:** O [cache.ts](../packages/infrastructure/src/sync/cache.ts#L54) busca 60 chamadas recentes, mas consulta todas as presenças sem filtro ou paginação.
- **Problema:** O limite padrão da API do Supabase é 1.000 linhas ([referência oficial](https://supabase.com/docs/guides/local-development/cli/config)), e o aplicativo não detecta o truncamento.
- **Correção:** Buscar primeiro os IDs das chamadas recentes, consultar apenas as presenças dessas chamadas e paginar até receber todas as linhas.
- **Se ignorarmos:** Chamadas antigas ou maiores serão reabertas com alunos ausentes.

### 8. A atualização do cache pode apagar o estado offline otimista

- **O que é:** A inicialização sincroniza uma vez e depois baixa dados em [container.ts](../apps/web/src/composicao/container.ts#L119); o [cache.ts](../packages/infrastructure/src/sync/cache.ts#L73) substitui cada coleção local inteira.
- **Problema:** Dados locais atrasados, falhos ou criados durante a consulta podem desaparecer da interface mesmo com o item ainda presente na fila.
- **Correção:** Não substituir o cache enquanto houver gravações pendentes, ou reaplicar essas operações sobre o retrato baixado antes de salvá-lo.
- **Se ignorarmos:** O usuário poderá acreditar que perdeu trabalho e inserir dados conflitantes para compensar.

### 9. O primeiro login pode deixar o aplicativo vazio

- **O que é:** O shell inicializa antes da autenticação, enquanto [entrar/page.tsx](../apps/web/src/app/entrar/page.tsx#L39) apenas redireciona depois do login.
- **Problema:** Consultas anônimas protegidas por RLS podem gravar coleções vazias; o login não executa nem aguarda uma nova carga, e as páginas leem esse cache uma única vez.
- **Correção:** Condicionar a inicialização à existência de sessão e aguardar o mesmo inicializador compartilhado depois do login, antes do redirecionamento.
- **Se ignorarmos:** Um usuário novo verá o sistema sem alunos ou turmas até recarregar a página.

### 10. Exclusão de aluno e turma ocorre somente no cache local

- **O que é:** As exclusões em [repositorios.ts](../packages/infrastructure/src/local/repositorios.ts#L150) alteram o cache sem enfileirar a exclusão remota.
- **Problema:** O registro continua no servidor e retorna na próxima atualização do cache.
- **Correção:** Adicionar os dois tipos de operação de exclusão e seus handlers remotos dentro da transação já usada para cache e outbox.
- **Se ignorarmos:** Alunos e turmas excluídos reaparecerão.

### 11. A validação dos payloads da outbox existe, mas não é usada

- **O que é:** O [schemas.ts](../packages/contracts/src/schemas.ts#L96) define schemas para a fila, mas o [outbox.ts](../packages/infrastructure/src/local/outbox.ts#L101) devolve dados sem validação.
- **Problema:** Um payload antigo ou corrompido pode lançar erro no mapeamento, ser tratado como falha transitória de rede e bloquear todos os itens seguintes.
- **Correção:** Validar o payload conforme o tipo antes do envio e marcar dados inválidos como falha permanente com mensagem útil.
- **Se ignorarmos:** Uma única entrada inválida no IndexedDB poderá parar toda sincronização futura.

### 12. O comando normal de testes está vermelho

- **O que é:** O [vitest.workspace.ts](../vitest.workspace.ts#L57) resolve `./test/setup.ts` a partir do diretório errado.
- **Problema:** `pnpm test` produziu 33 falhas com `IndexedDB API missing`. Com `fake-indexeddb/auto` carregado manualmente, todos os 51 testes de infraestrutura passaram.
- **Correção:** Resolver `packages/infrastructure/test/setup.ts` a partir da raiz e validar usando o comando normal `pnpm test`.
- **Se ignorarmos:** O CI não conseguirá diferenciar regressões reais de uma configuração de testes quebrada.

### 13. O timeout de rede declarado não é aplicado

- **O que é:** O [operacoes.ts](../packages/infrastructure/src/supabase/operacoes.ts#L13) define um limite de 15 segundos, mas não conecta um sinal de cancelamento às requisições.
- **Problema:** Uma requisição travada mantém o sincronizador executando e o item como `enviando` por tempo indefinido.
- **Correção:** Aplicar `AbortController` ou `abortSignal` do Supabase em cada operação e tratar cancelamento como falha de rede transitória.
- **Se ignorarmos:** Uma única requisição presa poderá desativar a sincronização até o aplicativo reiniciar.

## Correções recomendadas

### 14. O manifesto da PWA aponta para ícones inexistentes

- **O que é:** O [manifest.json](../apps/web/public/manifest.json#L14) referencia `/icone-192.png` e `/icone-512.png`, mas os arquivos não existem.
- **Problema:** As requisições retornam 404, e a instalação da PWA pode ser rejeitada ou degradada.
- **Correção:** Adicionar os dois arquivos, reaproveitando a arte legada se adequado, e testar que ambas as URLs retornam 200.
- **Se ignorarmos:** A instalação e apresentação na tela inicial continuarão pouco confiáveis.

### 15. O fluxo real de sincronização está desabilitado nos testes

- **O que é:** O único cenário de navegador destinado a chegar ao Supabase está marcado como `test.fixme` em [chamada-offline.spec.ts](../apps/web/e2e/chamada-offline.spec.ts#L224).
- **Problema:** Os testes atuais param no IndexedDB e não detectam erros no adaptador, nas políticas RLS, no cache ou na classificação de status.
- **Correção:** Executar um cenário com Supabase local cobrindo confirmação offline, envio, recarga e restauração das presenças.
- **Se ignorarmos:** A fronteira de maior risco continuará validada apenas por mocks.

### 16. Alterar a chamada mantém uma mensagem de sucesso falsa

- **O que é:** O [chamada/page.tsx](../apps/web/src/app/chamada/page.tsx#L70) permite alterar presença depois da confirmação sem limpar `confirmada`.
- **Problema:** A página continua dizendo que a chamada foi registrada, embora a nova alteração ainda não tenha sido persistida.
- **Correção:** Definir `confirmada` como falso sempre que a presença de um aluno for alterada.
- **Se ignorarmos:** O professor poderá sair da página acreditando que a última alteração foi salva.

### 17. Dependências de produção têm quatro vulnerabilidades conhecidas

- **O que é:** O [pnpm-lock.yaml](../pnpm-lock.yaml#L2416) resolve a dependência PostCSS do Next para a versão 8.4.31.
- **Problema:** `pnpm audit --prod` encontrou duas vulnerabilidades altas e duas moderadas: [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849), [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) e [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp). A exposição remota é limitada porque o projeto processa CSS controlado pelo repositório.
- **Correção:** Atualizar Next/PostCSS até resolver PostCSS para pelo menos 8.5.23 e adicionar o ecossistema npm ao [dependabot.yml](../.github/dependabot.yml#L3).
- **Se ignorarmos:** A cadeia de build manterá falhas conhecidas de leitura de arquivo, travessia de caminho e XSS.

### 18. O README raiz apresenta o aplicativo legado como atual

- **O que é:** O [README.md](../README.md#L5) orienta o desenvolvimento em Flutter e anuncia recursos incompletos, enquanto [apps/web/README.md](../apps/web/README.md#L9) identifica Flutter como legado.
- **Problema:** Novos contribuidores são enviados para o aplicativo, o schema e os comandos errados.
- **Correção:** Fazer o README raiz apontar para `apps/web` e identificar claramente o Flutter como código legado preservado.
- **Se ignorarmos:** Trabalho de manutenção poderá começar na aplicação errada.

### 19. A proteção do legado no CI compara a revisão errada

- **O que é:** O [web-ci.yml](../.github/workflows/web-ci.yml#L84) compara com `origin/main` ou `origin/<base_ref>` usando checkout raso.
- **Problema:** Em pushes, a comparação pode ocorrer contra o próprio commit; em pull requests, a referência remota pode não existir. Alterações apenas no legado também não disparam o workflow.
- **Correção:** Incluir os caminhos legados no gatilho, buscar explicitamente o SHA base do evento e comparar contra esse SHA.
- **Se ignorarmos:** A garantia declarada de que o legado permanece intocado não funciona.

## Melhoria opcional

### 20. Remover automação e scaffolding sem uso

- **O que é:** O scraper diário do Explosm, o [log.ts](../packages/infrastructure/src/log.ts#L1), a porta especulativa [reconhecimento-facial.ts](../packages/domain/src/portas/reconhecimento-facial.ts#L1) e schemas de entrada sem uso somam aproximadamente 331 linhas.
- **Problema:** Eles aumentam a manutenção e a superfície da cadeia de dependências sem contribuir para o produto atual.
- **Correção:** Remover agora a automação do quadrinho e as instalações de `requests` e `beautifulsoup4`; remover logging e schemas não usados; recriar a porta facial quando a feature começar.
- **Se ignorarmos:** O risco em runtime é baixo, mas o ruído e o custo de manutenção permanecem.

## Potencial de simplificação

- Aproximadamente 330 linhas removíveis.
- Duas dependências usadas somente pela automação de CI removíveis.

## Não validado e riscos residuais

Não foram validados as configurações do Supabase implantado, as políticas reais em produção, a instalação e o cache da PWA em dispositivo físico, as suítes Flutter e do spike, nem o E2E completo do Playwright. A execução E2E travou e foi encerrada; portanto, o comportamento específico do ambiente implantado e de navegadores reais ainda pode divergir desta análise.
