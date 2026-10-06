# Legacy Impact: Fundação e Chamada Manual

> Identificador: `001-fundacao-e-chamada-manual`
> Data: `2026-10-04`
>
> **Feature greenfield, sem legado pré-existente afetado. Âncora: `prd.md` + specs SDD.**
>
> O repositório contém um projeto Flutter anterior, mas ele **não é evoluído nem tocado** por esta feature. Todo arquivo criado está em `apps/`, `packages/` ou `infra/`, diretórios que não existiam. Verificado ao final: `git status` nos caminhos legados retorna vazio.

## Estado da política de edição no momento da execução

| Momento | `allowLegacyEdits` | `allowedPaths` | Consequência |
|---|---|---|---|
| Início do pipeline | `false` | `[]` | Nenhuma escrita fora das pastas do Reversa seria permitida. O coding teria parado antes da primeira linha de código. |
| Durante a execução | `true` | `[]` | **Liberação irrestrita** pelo usuário. Avisado uma vez na sessão, conforme a regra do `CLAUDE.md`. |

🟢 Mesmo com a liberação irrestrita, nenhum arquivo pré-existente foi modificado ou apagado. A deleção do Flutter tem critérios próprios em [`descomissionamento-do-legado.md`](../../_reversa_sdd/sdd/descomissionamento-do-legado.md) e **nenhum dos dez critérios de validação foi atendido** — notadamente CV-02 (5 chamadas em aula real) e CV-08 (4 semanas sem recorrer ao papel).

## Arquivos criados

| Arquivo afetado | Componente (spec SDD) | Tipo | Severidade | Justificativa |
|---|---|---|---|---|
| `pnpm-workspace.yaml`, `package.json`, `turbo.json`, `tsconfig.base.json` | `fundacao-arquitetural` | componente-novo | LOW | Scaffolding do monorepo |
| `.dependency-cruiser.cjs` | `fundacao-arquitetural` | componente-novo | MEDIUM | Verificação automática da regra de dependência (RF-03). É o controle que impede a erosão estrutural diagnosticada nas duas tentativas anteriores |
| `vitest.workspace.ts` | `fundacao-arquitetural` | componente-novo | LOW | Orquestração de testes com limiar de cobertura do domínio |
| `packages/domain/src/valor/{identidade,faixa,data}.ts` | `gestao-de-alunos-e-turmas` | componente-novo | MEDIUM | Objetos de valor. `Faixa` concentra a lista canônica em um lugar (premissa não confirmada) |
| `packages/domain/src/erros.ts` | `fundacao-arquitetural` | componente-novo | LOW | Hierarquia de erros com mensagens já em português |
| `packages/domain/src/aluno/aluno.ts` | `gestao-de-alunos-e-turmas` | componente-novo | HIGH | Raiz de agregado. Contém a invariante de exclusão bloqueada por histórico |
| `packages/domain/src/turma/turma.ts` | `gestao-de-alunos-e-turmas` | componente-novo | HIGH | Conceito **ausente no schema legado**. Sem ele não existe "quem faltou" |
| `packages/domain/src/chamada/chamada.ts` | `chamada-e-presenca` | componente-novo | HIGH | Raiz de agregado com a invariante de aluno único por chamada |
| `packages/domain/src/portas/repositorios.ts` | `fundacao-arquitetural` | componente-novo | HIGH | Inversão de dependência. É o que torna o código testável |
| `packages/domain/src/portas/reconhecimento-facial.ts` | `biometria-facial-on-device` | componente-novo | LOW | Porta **declarada, não implementada**. Ponto de extensão para o spike |
| `packages/application/src/chamada/casos-de-uso.ts` | `chamada-e-presenca` | componente-novo | HIGH | Orquestração da chamada, incluindo a detecção de chamada duplicada |
| `packages/application/src/aluno/casos-de-uso.ts` | `gestao-de-alunos-e-turmas` | componente-novo | HIGH | Cadastro, matrícula, inativação e a recusa de exclusão com histórico |
| `packages/infrastructure/src/local/db.ts` | `sincronizacao-offline-first` | componente-novo | HIGH | Cache e outbox. Contador persistente de ordem |
| `packages/infrastructure/src/local/outbox.ts` | `sincronizacao-offline-first` | componente-novo | CRITICAL | Único caminho de escrita. Perder um item aqui é perder uma presença confirmada pelo professor |
| `packages/infrastructure/src/local/cota.ts` | `sincronizacao-offline-first` | componente-novo | MEDIUM | Bloqueio antes de perder dado por cota esgotada |
| `packages/infrastructure/src/sync/classificacao.ts` | `sincronizacao-offline-first` | componente-novo | CRITICAL | Classificação da resposta do servidor. Errar aqui custa dado ou duplicata |
| `infra/supabase/migrations/0001..0004.sql` | `fundacao-arquitetural`, `gestao-de-alunos-e-turmas`, `chamada-e-presenca` | delta-de-dados | HIGH | Schema novo, com RLS desde a primeira migração e as duas restrições de unicidade que sustentam a idempotência |
| `apps/web/src/composicao/container.ts` | `fundacao-arquitetural` | componente-novo | HIGH | Composition root. Único ponto onde portas viram adaptadores |
| `apps/web/src/app/sw.ts`, `next.config.ts`, `manifest.json` | `fundacao-arquitetural` | componente-novo | HIGH | PWA. Sem o service worker correto o app não abre offline |
| `apps/web/src/app/chamada/page.tsx` | `chamada-e-presenca` | componente-novo | CRITICAL | A tela onde a métrica primária é ganha ou perdida |
| `apps/web/src/app/{alunos,turmas,entrar,pendencias}/page.tsx` | vários | componente-novo | HIGH | Cadastro, matrícula, autenticação e falhas permanentes |
| `apps/web/src/componentes/{Shell,IndicadorDeSincronizacao}.tsx` | `sincronizacao-offline-first` | componente-novo | HIGH | Indicador permanente de pendências (RF-29) |
| `apps/web/src/app/error.tsx`, `src/lib/erros.ts` | `fundacao-arquitetural` | componente-novo | MEDIUM | Fronteira de erro. Nenhum código técnico chega ao professor |
| `packages/contracts/src/schemas.ts` | `fundacao-arquitetural` | componente-novo | HIGH | Validação de fronteira. Fonte única de schema e tipo |
| `packages/infrastructure/src/local/repositorios.ts` | `sincronizacao-offline-first` | componente-novo | CRITICAL | Gravação local e enfileiramento na MESMA transação |
| `packages/infrastructure/src/sync/sincronizador.ts` | `sincronizacao-offline-first` | componente-novo | CRITICAL | Processa a fila em ordem, parando no primeiro transitório |
| `packages/infrastructure/src/supabase/*.ts` | `sincronizacao-offline-first` | delta-de-contrato-externo | HIGH | Implementa `interfaces/sync-outbox.md` |
| `apps/web/e2e/chamada-offline.spec.ts`, `playwright.config.ts` | `chamada-e-presenca` | componente-novo | HIGH | Verifica o cenário crítico em navegador real |
| `.github/workflows/web-ci.yml` | `fundacao-arquitetural` | componente-novo | MEDIUM | **Arquivo NOVO** em diretório existente. `daily-explosm-comic.yml` intocado |
| Testes (`packages/*/test/*.ts`) | todos | componente-novo | MEDIUM | 207 testes unitários e de integração, suíte verde |

## Diff conceitual por componente

### `fundacao-arquitetural`
🟡 Monorepo com quatro pacotes de biblioteca e um app, com a regra de dependência verificada por ferramenta e executada como teste. A verificação foi **comprovada por verificação negativa**: com uma importação de `infrastructure` injetada em `domain`, o teste falhou reportando `[domain-nao-depende-de-ninguem] packages/domain/src/index.ts -> packages/infrastructure/src/index.ts`. A primeira tentativa dessa prova deu falso-positivo, e isso está registrado no `progress.jsonl`.

### `gestao-de-alunos-e-turmas`
🟡 `Aluno` e `Turma` como agregados independentes, ligados por `Matricula` que referencia ambos por identidade. CPF removido do modelo (RN-09): existia para o termo LGPD e para a cobrança, ambos fora de escopo. Escala de faixa derivada da idade, com escolha explícita quando não há data de nascimento.

### `chamada-e-presenca`
🟡 **A mudança estrutural central em relação ao legado.** No `supabase/schema.sql` do Flutter, `presenca` referenciava o aluno diretamente, sem contexto de aula — o que torna impossível responder "quem faltou na turma das 19h hoje". Agora `Presenca` pertence a uma `Chamada`, que pertence a uma turma e a uma data, com unicidade garantida no banco.

### `sincronizacao-offline-first`
🟡 Outbox como único caminho de escrita, com contador de ordem persistente e classificação de erro em três categorias. Dois bugs reais foram encontrados pelos testes e corrigidos nesta rodada, ambos registrados no `progress.jsonl` com `status: corrected`.

### Camada de apresentação
🟡 PWA Next.js com seis rotas. A tela de chamada aplica as três decisões de interface da spec: lista completa da turma, linha inteira como alvo de toque de 64 px, e botão de confirmar fixo. Dois bugs de produto foram encontrados pelo e2e e corrigidos — `clientsClaim: false` impedia o app de abrir offline, e o indicador de pendências não atualizava fora de uma rodada de sincronização. Ambos registrados no `progress.jsonl` com `status: corrected`.

### `biometria-facial-on-device`
🟡 Apenas a porta, sem implementação. Nenhuma coluna `vector(N)` foi criada e a extensão `pgvector` não foi habilitada: a dimensionalidade é saída do spike, e fixá-la antes garantiria migração futura (risco R4 do PRD).

### `graduacao-e-frequencia` e `relatorios-e-exportacao`
🟡 Fora do escopo desta feature. `Aluno.registrarGraduacao` existe como ponto de partida.

## Preservadas

> Cenário greenfield: não há regras 🟢 extraídas de código existente para preservar.

🟢 Registro factual do que permanece intocado no repositório, verificado por `git status`:

```
lib/              7 arquivos Dart       inalterados
test/             6 arquivos de teste   inalterados
supabase/         schema.sql            inalterado
docs/             lgpd_models.md        inalterado
web/  windows/    plataforma Flutter    inalterados
pubspec.yaml  pubspec.lock  analysis_options.yaml  .metadata   inalterados
.github/          automação do cartoon  inalterada
.gitignore        raiz                  inalterado
```

## Modificadas

> Nenhuma. Nenhum arquivo pré-existente foi modificado ou apagado por esta feature.

---
Gerado por `/reversa-coding` em 2026-10-04.
