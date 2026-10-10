# Auditoria do repositório e handoff de sessão

Data da auditoria: 2026-10-09
Branch: `main`
Commit auditado: `2627219`
Modo: Ponytail ultra, somente leitura no código do produto

## Atualização de estabilização — 2026-10-09

Esta seção registra o trabalho posterior à auditoria; o diagnóstico abaixo
permanece como fotografia do commit originalmente auditado.

| Itens | Commit | Estado |
| --- | --- | --- |
| 1, 2, 4, 5, 6 e 7 | `e2f5656` | corrigidos com testes |
| 12 | `e2f5656` | E2E real habilitado no CI com Supabase local |
| 3 | `5fc236b` | respostas do Supabase fora do Cache Storage |
| 8 | `68f7615` | presenças recentes filtradas e paginadas |
| 9 | `1d5a076` | refresh não sobrescreve mudanças locais |
| 10 | `85b5cf2` | exclusões de aluno e turma sincronizadas |
| 11 | `81490e5` | payloads inválidos bloqueados antes do Supabase |
| 13 | `30db8f7` | editar invalida a confirmação; `BUG-20261009-NLLT` fechado |
| 14 | `cd03e30` | ícones de 192 e 512 criados; E2E cobra o que o manifesto promete |

Última validação local, nesta sessão:

- `pnpm typecheck`: 9 tarefas passaram;
- `pnpm e2e`: 8 passaram e 1 continua ignorado por depender do Supabase local;
- os dois testes novos foram verificados nos dois sentidos: cada um falha quando a respectiva correção é desfeita;
- `pnpm test` não foi reexecutado: as mudanças são de tela e de asset, e os pacotes não têm teste de UI;
- o Supabase real continua sem ser iniciado localmente.

Com 13 e 14 fechados, **nenhum achado restante é bloqueador de produção**. Os
pendentes são 15, 16 e 17: PostCSS vulnerável, README raiz enganoso e limpeza
da automação de quadrinhos.

## Retomada da próxima sessão

Use a frase abaixo para retomar exatamente deste ponto:

`RETOMAR-POSTCSS`

Ao retomar:

1. Leia este arquivo antes de alterar o projeto.
2. Comece pelo item 15 descrito em **Próximo passo recomendado**.
3. Decida conscientemente entre terminar 15, 16 e 17 ou retomar a biometria: a estabilização da fronteira IndexedDB–Supabase terminou e nada do que sobrou bloqueia produção.
4. Preserve a regra do Reversa: antes de escrever fora das pastas próprias, leia `.reversa/reversa-config.json` e respeite `allowLegacyEdits` e `allowedPaths`.

Prompt curto sugerido para a próxima sessão:

> RETOMAR-POSTCSS. Leia `_reversa_refactor/auditoria-ponytail-2026-10-09.md`, confirme o estado atual do Git e resolva o item 15: fixar PostCSS 8.5.23 ou superior por resolução do pnpm e confirmar com `pnpm audit --prod`.

## O que este repositório contém

O produto ativo é uma PWA Next.js offline-first para cadastro de alunos, turmas e chamadas de jiu-jítsu. O Flutter na raiz é legado preservado.

Premissas usadas nesta auditoria:

- um operador principal;
- aproximadamente 300 alunos;
- turmas de aproximadamente 20 pessoas;
- uso offline frequente;
- sincronização com Supabase quando a conexão retorna.

## Estado validado

- TypeScript: passou.
- Build de produção: passou.
- Arquitetura: passou com um aviso de arquivo órfão.
- Testes unitários e de integração: 207 passaram.
- Playwright: 4 cenários offline passaram; 1 integração real com Supabase está desativada.
- Auditoria de dependências de produção: 4 vulnerabilidades.
- O Git estava limpo ao final da auditoria, antes da criação deste documento.

Comandos e resultados:

| Comando | Resultado |
| --- | --- |
| `pnpm typecheck` | sucesso, 9 tarefas |
| `pnpm test` | 207 testes passaram: 114 domain, 42 application e 51 infrastructure |
| `pnpm build` | sucesso, Next.js 15.5.27, 8 rotas |
| `pnpm arch` | 0 erros e 1 aviso: `packages/infrastructure/test/setup.ts` órfão |
| `pnpm e2e` | 4 passaram e 1 ficou ignorado com `fixme` |
| `pnpm audit --prod` | 4 vulnerabilidades via PostCSS 8.4.31: 2 altas e 2 moderadas |

Observações da execução:

- O Chromium do Playwright foi instalado no cache do usuário para permitir a execução dos E2E; isso não alterou o repositório.
- O relatório anterior, `_reversa_refactor/auditoria-ponytail-2026-10-08.md`, ficou desatualizado nos pontos sobre testes e CI. O commit `ca9fbc3` corrigiu aqueles problemas; este documento substitui o diagnóstico anterior como referência de continuidade.

## Achados — corrigir antes de produção

### 1. Qualquer conta autenticada controla todos os dados

Evidência: `infra/supabase/migrations/0003_aluno_turma_matricula.sql:95`.

As políticas RLS verificam apenas se `auth.uid()` não é nulo. Qualquer conta criada por teste, convite indevido ou configuração incorreta pode ler, criar, alterar e excluir todos os registros.

Correção mínima:

- manter um operador previamente provisionado;
- exigir uma linha de operador ligada ao próprio usuário nas políticas;
- testar três perfis: anônimo, autenticado não provisionado e operador provisionado.

Risco atual: administração completa dos dados por qualquer usuário autenticado.

### 2. A aplicação inicializa cache e sincronização antes de validar a sessão

Evidência: `apps/web/src/componentes/Shell.tsx:31`.

O `Shell` chama `iniciar()` inclusive em `/entrar`; apenas a raiz consulta `getSession`. Sem uma sessão válida, o pull pode substituir o cache por um retrato vazio, a outbox pode tentar enviar itens sem autenticação e uma URL direta como `/chamada` pode mostrar dados antigos do IndexedDB.

Correção mínima:

- aplicar um guard de sessão compartilhado às rotas privadas;
- inicializar cache e sincronização somente após confirmar a sessão local;
- após o login, aguardar essa inicialização antes de liberar a navegação.

Risco atual: primeira entrada aparentemente vazia e exposição local de dados de uma sessão anterior.

### 3. O service worker pode armazenar respostas privadas do Supabase

Evidência: `apps/web/src/app/sw.ts:43`.

O Serwist 9.5.13 recebe `defaultCache`, que inclui GETs cross-origin. Sem uma regra anterior e específica, respostas privadas do Supabase podem ser atendidas do cache em outra sessão ou quando deveriam ser buscadas novamente.

Correção mínima: registrar `NetworkOnly` para a origem exata do Supabase antes das regras padrão.

Risco atual: dados obsoletos ou pertencentes a outra sessão serem reutilizados pelo service worker.

### 4. A sincronização dita automática não reage a novas operações online

Evidência: `packages/infrastructure/src/sync/sincronizador.ts:54`.

A sincronização roda na inicialização e em mudanças de conectividade. Uma operação criada enquanto o navegador já está online não dispara o envio, e uma tentativa reagendada não possui timer para a próxima data elegível.

Correção mínima: um único agendador deve observar novos itens e programar a próxima operação devida.

Risco atual: alterações ficam pendentes até recarregar a página ou alternar a rede.

### 5. Uma operação pode sobrescrever outra ou apagar uma alteração mais nova

Evidência: `packages/infrastructure/src/local/outbox.ts:71`.

A chave da outbox é o ID da entidade e a gravação usa `put`. Assim, um update pode sobrescrever o create da mesma entidade. Se uma operação antiga estiver em voo, sua conclusão também pode excluir uma alteração mais nova gravada sob a mesma chave.

Correção mínima:

- dar uma chave única a cada operação;
- concluir ou excluir exatamente a operação que foi enviada;
- cobrir create seguido de update e atualização concorrente durante envio.

Risco atual: registros ou alterações desaparecem silenciosamente.

### 6. Erros temporários viram permanentes e requisições podem ficar presas

Evidências: `packages/infrastructure/src/supabase/operacoes.ts:105` e timeout definido próximo à linha 13.

O status devolvido pelo Supabase é descartado, portanto 401, 429 e 503 podem virar 400. Além disso, o timeout configurado não é ligado ao `fetch` por `AbortSignal`.

Correção mínima:

- preservar o status HTTP real;
- conectar um `AbortSignal` de 15 segundos à requisição;
- classificar falhas transitórias sem marcar a operação como permanentemente inválida.

Risco atual: indisponibilidade ou expiração de autenticação pode abandonar uma chamada para sempre.

### 7. A fila não preserva uma ordem causal segura

Evidência: `packages/infrastructure/src/local/outbox.ts:101`.

Itens ainda fora da data de tentativa são filtrados antes da ordenação, e uma falha permanente não bloqueia dependentes. Uma presença pode ser enviada antes da chamada correspondente; se a chamada falhar de modo permanente, a presença entra em repetição por chave estrangeira.

Correção mínima: o item não resolvido mais antigo deve bloquear dependentes; falhas permanentes precisam classificar ou encerrar suas operações dependentes.

Risco atual: fila envenenada, retries inúteis e dados parciais no servidor.

### 8. O cache pode perder presenças após aproximadamente 50 chamadas

Evidência: `packages/infrastructure/src/sync/cache.ts:61`.

O código guarda 60 chamadas, mas busca presenças sem filtro nem paginação. Com 60 chamadas de 20 alunos, seriam 1.200 linhas, acima do limite usual de 1.000 linhas de uma consulta do Supabase.

Correção mínima: buscar pelos IDs das chamadas recentes e paginar as presenças relacionadas.

Risco atual: chamadas antigas aparecem sem parte dos participantes, sem erro visível.

### 9. Atualizar o cache pode esconder trabalho ainda pendente

Evidência: `packages/infrastructure/src/sync/cache.ts:75`.

O retrato do servidor substitui coleções locais em massa. Mudanças locais pendentes ou criadas durante o refresh podem desaparecer da interface antes de serem sincronizadas.

Correção mínima: não substituir o cache enquanto houver operações relacionadas pendentes, ou reaplicar essas operações sobre o retrato recebido.

Risco atual: aparente perda de dados e edição conflitante pelo operador.

### 10. Excluir aluno ou turma afeta somente o banco local

Evidência: `packages/infrastructure/src/local/repositorios.ts:150`.

As exclusões não entram na outbox. No próximo pull, as linhas do servidor retornam.

Correção mínima: enfileirar a exclusão na mesma transação local; se exclusão remota ainda não for suportada, retirar temporariamente essa ação da interface.

Risco atual: dados excluídos reaparecem.

## Achados — corrigir em seguida

### 11. A validação da outbox existe, mas não é usada

Evidência: `packages/contracts/src/schemas.ts:101`.

Os schemas estão definidos, porém o adaptador apenas faz cast. Um item corrompido, por exemplo uma remoção sem ID, pode falhar indefinidamente.

Correção mínima: validar cada payload pelo tipo antes do envio e transformar payload inválido em falha permanente diagnosticável.

Risco atual: um único item ruim pode bloquear o fluxo.

### 12. A fronteira real com Supabase não está coberta

Evidência: `apps/web/e2e/chamada-offline.spec.ts:224`.

Os quatro E2E ativos populam o IndexedDB diretamente; o quinto cenário, que deveria usar Supabase real, está marcado como `fixme`.

Correção mínima: executar Supabase local no CI e cobrir login, operação offline, reconexão, sincronização e recarga.

Risco atual: a suíte fica verde justamente sem exercitar os pontos de maior risco.

### 13. Editar uma chamada mantém uma confirmação que deixou de ser verdadeira

Evidência: `apps/web/src/app/chamada/page.tsx:73`.

Depois de confirmar a chamada, alternar uma presença não limpa o estado de confirmação.

Correção mínima: executar `setConfirmada(false)` quando uma presença for alterada.

Risco atual: o professor pode sair da tela acreditando que a edição foi salva.

### 14. O manifesto aponta para ícones inexistentes

Evidência: `apps/web/public/manifest.json:14`.

O manifesto referencia ícones de 192 e 512 pixels que não estão no repositório.

Correção mínima: adicionar os dois arquivos reaproveitando a identidade visual existente.

Risco atual: instalação PWA degradada ou recusada em alguns navegadores.

### 15. Há quatro vulnerabilidades em dependências de produção

Evidência: `pnpm-lock.yaml:1253`.

O Next resolve PostCSS 8.4.31, com duas vulnerabilidades altas e duas moderadas. A exposição observada é principalmente de build, pois o repositório controla o CSS processado.

Correção mínima: atualizar a resolução para PostCSS 8.5.23 ou superior e adicionar Dependabot para npm.

Risco atual: ferramentas de build permanecem em uma versão com vulnerabilidades conhecidas.

### 16. O README raiz descreve o produto errado como atual

Evidência: `README.md:5`.

O arquivo apresenta Flutter e reconhecimento facial como produto atual, enquanto o README web trata esse conteúdo como legado.

Correção mínima: tornar a aplicação web o ponto de entrada e mover Flutter para uma seção explícita de legado.

Risco atual: novos contribuidores começam pela aplicação errada.

## Limpeza de baixo risco

### 17. A automação diária de quadrinhos não pertence ao produto

Evidência: `.github/workflows/daily-explosm-comic.yml:1`.

Ela cria commits diários e mantém scripts, imagem e dependências sem relação com a aplicação. Também há logging e schemas aparentemente não usados.

Correção mínima: remover o workflow, o scraper, a imagem e o código morto depois de confirmar que ninguém depende deles.

Estimativa enxuta: aproximadamente 300 linhas e 2 dependências de CI podem ser removidas.

Risco atual: ruído operacional e superfície de manutenção; impacto funcional baixo.

## Próximo passo recomendado

Os itens 13 e 14 estão **feitos**. No 13, `alternar` zera a confirmação depois
de uma troca bem-sucedida, e o E2E cobre confirmado → editado → reconfirmado,
com recarga provando que a lista editada foi persistida. No 14, os dois ícones
passaram a existir e um E2E novo cobra do manifesto tudo que ele promete, que é
exatamente a falha que ninguém detectava na build.

Os ícones foram gerados com o `sharp` que o Next já traz, a partir deste SVG,
guardado aqui porque o script foi descartado:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#101014"/>
  <rect x="76" y="212" width="360" height="72" rx="12" fill="#4c8dff"/>
  <rect x="206" y="268" width="38" height="144" rx="12" fill="#2f6fe0"/>
  <rect x="268" y="268" width="38" height="112" rx="12" fill="#2f6fe0"/>
  <rect x="196" y="200" width="120" height="96" rx="16" fill="#7fb0ff"/>
</svg>
```

Uma faixa com o nó ao centro, em geometria pura: nenhuma fonte envolvida, e
todo o desenho dentro do círculo de 40% exigido pelo `purpose: maskable`. Os
ícones legados em `web/icons/` são o logotipo do Flutter e não servem.

O próximo é o **item 15: PostCSS vulnerável**, resolvido por uma resolução do
pnpm e confirmado com `pnpm audit --prod`.

A estabilização da fronteira IndexedDB–Supabase terminou, então retomar a
biometria já é uma escolha legítima. O passo pendente dela continua sendo obter
fotos sem recompressão e escolher um modelo de embedding com licença permissiva.

## Veredito

A arquitetura de domínio é boa, mas a aplicação ainda não é segura nem durável o bastante para produção. A fronteira IndexedDB–Supabase deve ser estabilizada antes de novas funcionalidades.

## Fora do escopo e risco residual

Não foram verificados:

- ambientes Supabase e Vercel já implantados;
- comportamento em celular físico;
- desempenho com volume real;
- testes do Flutter legado.

Com o item 13 fechado, o maior risco residual passa a ser o que nunca foi
exercitado: os ambientes Supabase e Vercel implantados, o celular físico e o
volume real. O cenário E2E contra o Supabase local continua ignorado quando o
serviço não está de pé.
