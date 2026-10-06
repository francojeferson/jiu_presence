# Actions: Fundação Arquitetural e Chamada Manual

> Identificador: `001-fundacao-e-chamada-manual`
> Data: `2026-10-04`
> Roadmap: `_reversa_forward/001-fundacao-e-chamada-manual/roadmap.md`

## Resumo

| Métrica | Valor |
|---|---|
| Total de ações | 64 |
| Paralelizáveis (`[//]`) | 34 |
| Maior cadeia de dependência | 9 (T001 → T002 → T004 → T005 → T035 → T038 → T052 → T055 → T056) |

⚠️ **Restrição vigente em todas as ações:** nenhum arquivo pré-existente do projeto Flutter foi criado, modificado ou apagado. Todo arquivo alvo está em `apps/`, `packages/`, `infra/` ou na raiz em caminhos novos.

> **Nota de execução:** a política foi liberada pelo usuário no meio da sessão (`allowLegacyEdits: true`, `allowedPaths: []` — liberação irrestrita). Mesmo assim nada do legado foi tocado: a remoção tem critérios próprios em `descomissionamento-do-legado.md` e nenhum foi atendido. Verificado ao final por `git status`.

---

## Fase 1, Preparação

| ID | Descrição | Dependências | Paralelismo | Arquivo alvo | Confidência | Status |
|---|---|---|---|---|---|---|
| T001 | Criar o workspace pnpm na raiz, declarando `apps/*` e `packages/*` | - | - | `pnpm-workspace.yaml` | 🟡 | `[X]` |
| T002 | Criar o `package.json` raiz com scripts de orquestração e versão de Node fixada | T001 | - | `package.json` | 🟡 | `[X]` |
| T003 | Configurar o Turborepo com o grafo de tarefas de build, test e lint | T002 | - | `turbo.json` | 🟡 | `[X]` |
| T004 | Criar o `tsconfig` base compartilhado, em modo estrito | T002 | `[//]` | `tsconfig.base.json` | 🟡 | `[X]` |
| T005 | Criar o scaffold do pacote `domain`, sem nenhuma dependência de runtime | T004 | `[//]` | `packages/domain/package.json` | 🟡 | `[X]` |
| T006 | Criar o scaffold do pacote `contracts`, dependendo apenas de Zod | T004 | `[//]` | `packages/contracts/package.json` | 🟡 | `[X]` |
| T007 | Criar o scaffold do pacote `application`, dependendo apenas de `domain` e `contracts` | T005, T006 | - | `packages/application/package.json` | 🟡 | `[X]` |
| T008 | Criar o scaffold do pacote `infrastructure`, com Supabase SDK e Dexie | T007 | - | `packages/infrastructure/package.json` | 🟡 | `[X]` |
| T009 | Criar o app Next.js em `apps/web` com App Router e TypeScript | T004 | - | `apps/web/package.json` | 🟡 | `[X]` |
| T010 | Configurar `dependency-cruiser` com as regras de camada da Arquitetura Limpa | T008, T009 | - | `.dependency-cruiser.cjs` | 🟡 | `[X]` |
| T011 | Configurar Vitest com os projetos de workspace e limiar de cobertura do domínio | T008 | `[//]` | `vitest.workspace.ts` | 🟡 | `[X]` |
| T012 | Escrever a migração de extensões e tipos enumerados | T001 | `[//]` | `infra/supabase/migrations/0001_extensions_and_types.sql` | 🟡 | `[X]` |
| T013 | Escrever a migração da tabela `operador`, com RLS e política | T012 | - | `infra/supabase/migrations/0002_operador.sql` | 🟡 | `[X]` |
| T014 | Escrever a migração de `aluno`, `turma` e `matricula`, com constraints, índices e RLS | T012 | - | `infra/supabase/migrations/0003_aluno_turma_matricula.sql` | 🟡 | `[X]` |
| T015 | Escrever a migração de `chamada` e `presenca`, com as duas restrições de unicidade, índices e RLS | T014 | - | `infra/supabase/migrations/0004_chamada_presenca.sql` | 🟡 | `[X]` |
| T016 | Criar o arquivo de exemplo de variáveis de ambiente, documentando cada chave | T009 | `[//]` | `apps/web/.env.example` | 🟡 | `[X]` |
| T017 | Criar `.gitignore` próprio em `apps/web/`, sem tocar no `.gitignore` da raiz | T009 | `[//]` | `apps/web/.gitignore` | 🟢 | `[X]` |

⚠️ **T017 originalmente previa acrescentar linhas ao `.gitignore` da raiz.** Foi reescrita para um arquivo próprio em `apps/web/`, porque o `.gitignore` da raiz é pré-existente e a política vigente proíbe tocá-lo. Git respeita `.gitignore` aninhado, então o resultado funcional é equivalente.

---

## Fase 2, Testes

| ID | Descrição | Dependências | Paralelismo | Arquivo alvo | Confidência | Status |
|---|---|---|---|---|---|---|
| T018 | Escrever o teste de regra de dependência que falha quando uma camada importa de camada mais externa | T010 | - | `packages/domain/test/arquitetura.test.ts` | 🟡 | `[X]` |
| T019 | Escrever os testes do objeto de valor `Faixa`: escalas distintas, próxima faixa, faixa máxima | T005 | `[//]` | `packages/domain/test/faixa.test.ts` | 🟡 | `[X]` |
| T020 | Escrever os testes do agregado `Aluno`: nome e faixa obrigatórios, escala conforme idade, inativação | T005 | `[//]` | `packages/domain/test/aluno.test.ts` | 🟡 | `[X]` |
| T021 | Escrever os testes do agregado `Chamada`: aluno único por chamada, confirmação, alternância de presença | T005 | `[//]` | `packages/domain/test/chamada.test.ts` | 🟡 | `[X]` |
| T022 | Escrever os testes do agregado `Turma` e da entidade `Matricula`: vigência, rematrícula | T005 | `[//]` | `packages/domain/test/turma.test.ts` | 🟡 | `[X]` |
| T023 | Escrever os testes do gerador de identidade UUID v7: unicidade e ordenação temporal | T005 | `[//]` | `packages/domain/test/identidade.test.ts` | 🟡 | `[X]` |
| T024 | Escrever os testes do outbox: ordenação monotônica, idempotência, classificação de erro | T008 | `[//]` | `packages/infrastructure/test/outbox.test.ts` | 🟡 | `[X]` |
| T025 | Escrever os testes do sincronizador: interrupção na primeira falha transitória, espera exponencial | T008 | `[//]` | `packages/infrastructure/test/sincronizador.test.ts` | 🟡 | `[X]` |
| T026 | Escrever os testes dos casos de uso de chamada, com repositórios fake | T007 | `[//]` | `packages/application/test/chamada.test.ts` | 🟡 | `[X]` |
| T027 | Escrever os testes dos casos de uso de aluno e matrícula, com repositórios fake | T007 | `[//]` | `packages/application/test/aluno.test.ts` | 🟡 | `[X]` |
| T028 | Configurar o Playwright com perfil móvel e controle de estado de rede | T009 | `[//]` | `apps/web/playwright.config.ts` | 🟡 | `[X]` |
| T029 | Escrever o teste de ponta a ponta do fluxo offline: chamada em modo avião, recarga, sincronização, data preservada | T028 | - | `apps/web/e2e/chamada-offline.spec.ts` | 🟡 | `[X]` |

---

## Fase 3, Núcleo

| ID | Descrição | Dependências | Paralelismo | Arquivo alvo | Confidência | Status |
|---|---|---|---|---|---|---|
| T030 | Implementar o objeto de valor `Faixa` com as duas escalas canônicas e a transição entre faixas | T019 | - | `packages/domain/src/valor/faixa.ts` | 🟡 | `[X]` |
| T031 | Implementar o gerador de identidade UUID v7 | T023 | `[//]` | `packages/domain/src/valor/identidade.ts` | 🟡 | `[X]` |
| T032 | Implementar o agregado `Aluno` com suas invariantes | T030, T031 | - | `packages/domain/src/aluno/aluno.ts` | 🟡 | `[X]` |
| T033 | Implementar o agregado `Turma` e a entidade `Matricula` | T031 | `[//]` | `packages/domain/src/turma/turma.ts` | 🟡 | `[X]` |
| T034 | Implementar o agregado `Chamada` com `Presenca` e a invariante de aluno único | T031 | `[//]` | `packages/domain/src/chamada/chamada.ts` | 🟡 | `[X]` |
| T035 | Declarar as portas de repositório para aluno, turma e chamada | T032, T033, T034 | - | `packages/domain/src/portas/repositorios.ts` | 🟡 | `[X]` |
| T036 | Declarar a porta `FaceRecognitionService`, sem implementação, como ponto de extensão | T035 | `[//]` | `packages/domain/src/portas/reconhecimento-facial.ts` | 🟡 | `[X]` |
| T037 | Definir os schemas Zod de todas as entidades e derivar os tipos | T006 | `[//]` | `packages/contracts/src/schemas.ts` | 🟡 | `[X]` |
| T038 | Implementar os casos de uso de cadastro e edição de aluno | T035, T037 | - | `packages/application/src/aluno/casos-de-uso.ts` | 🟡 | `[X]` |
| T039 | Implementar os casos de uso de turma e matrícula | T035, T037 | `[//]` | `packages/application/src/turma/casos-de-uso.ts` | 🟡 | `[X]` |
| T040 | Implementar o caso de uso de abrir chamada, com detecção de chamada existente para turma e data | T035, T037 | - | `packages/application/src/chamada/abrir-chamada.ts` | 🟡 | `[X]` |
| T041 | Implementar os casos de uso de alternar presença e confirmar chamada | T040 | - | `packages/application/src/chamada/registrar-presenca.ts` | 🟡 | `[X]` |
| T042 | Implementar o schema Dexie para as tabelas locais `outbox` e `cache` | T008 | `[//]` | `packages/infrastructure/src/local/db.ts` | 🟡 | `[X]` |
| T043 | Implementar o outbox: enfileirar, listar pendentes, marcar estado, ordenação monotônica | T042, T024 | - | `packages/infrastructure/src/local/outbox.ts` | 🟡 | `[X]` |
| T044 | Implementar os repositórios locais sobre Dexie, gravando e enfileirando na mesma transação | T043, T035 | - | `packages/infrastructure/src/local/repositorios.ts` | 🟡 | `[X]` |
| T045 | Implementar a verificação de cota de armazenamento antes de cada escrita | T042 | `[//]` | `packages/infrastructure/src/local/cota.ts` | 🟡 | `[X]` |

---

## Fase 4, Integração

| ID | Descrição | Dependências | Paralelismo | Arquivo alvo | Confidência | Status |
|---|---|---|---|---|---|---|
| T046 | Implementar o cliente Supabase com leitura de variáveis de ambiente e persistência de sessão | T008 | `[//]` | `packages/infrastructure/src/supabase/cliente.ts` | 🟡 | `[X]` |
| T047 | Implementar o adaptador remoto de cada operação do outbox, conforme `interfaces/sync-outbox.md` | T046, T043 | - | `packages/infrastructure/src/supabase/operacoes.ts` | 🟡 | `[X]` |
| T048 | Implementar a classificação de resposta em sucesso, idempotente, transitório e permanente | T047 | - | `packages/infrastructure/src/sync/classificacao.ts` | 🟡 | `[X]` |
| T049 | Implementar o sincronizador com espera exponencial e interrupção na primeira falha transitória | T048, T025 | - | `packages/infrastructure/src/sync/sincronizador.ts` | 🟡 | `[X]` |
| T050 | Implementar a detecção de conectividade por requisição real, não por status da interface | T049 | - | `packages/infrastructure/src/sync/conectividade.ts` | 🟡 | `[X]` |
| T051 | Implementar a sincronização do cache de leitura: turmas, alunos ativos e matrículas | T046, T042 | - | `packages/infrastructure/src/sync/cache.ts` | 🟡 | `[X]` |
| T052 | Implementar a composition root, resolvendo todas as portas em adaptadores concretos | T044, T049, T051 | - | `apps/web/src/composicao/container.ts` | 🟡 | `[X]` |
| T053 | Configurar o PWA: manifesto, service worker e pré-cache do shell | T009 | `[//]` | `apps/web/next.config.ts` | 🟡 | `[X]` |
| T054 | Implementar a tela de autenticação, com mensagens de erro em português | T052 | - | `apps/web/src/app/(auth)/entrar/page.tsx` | 🟡 | `[X]` |
| T055 | Implementar o shell da aplicação com navegação e o indicador de conectividade e pendências | T052, T053 | - | `apps/web/src/app/layout.tsx` | 🟡 | `[X]` |
| T056 | Implementar as telas de listagem, cadastro e edição de aluno, com escala de faixa por idade | T055, T038 | - | `apps/web/src/app/alunos/page.tsx` | 🟡 | `[X]` |
| T057 | Implementar as telas de turma e de matrícula de alunos | T055, T039 | `[//]` | `apps/web/src/app/turmas/page.tsx` | 🟡 | `[X]` |
| T058 | Implementar a tela de chamada manual: lista completa da turma, marcação por toque, contagem, confirmação | T055, T041 | - | `apps/web/src/app/chamada/page.tsx` | 🟡 | `[X]` |

---

## Fase 5, Polimento

| ID | Descrição | Dependências | Paralelismo | Arquivo alvo | Confidência | Status |
|---|---|---|---|---|---|---|
| T059 | Implementar a fronteira de erro global, com mensagem em português e ação de recuperação | T055 | `[//]` | `apps/web/src/app/error.tsx` | 🟡 | `[X]` |
| T060 | Implementar a tela de itens com falha permanente, com motivo legível e ação possível | T055, T049 | `[//]` | `apps/web/src/app/pendencias/page.tsx` | 🟡 | `[X]` |
| T061 | Implementar a busca de aluno por nome, insensível a acento e caixa | T056 | `[//]` | `apps/web/src/app/alunos/busca.ts` | 🟡 | `[X]` |
| T062 | Implementar o log estruturado de eventos de sincronização, sem dado pessoal | T049 | `[//]` | `packages/infrastructure/src/log.ts` | 🟡 | `[X]` |
| T063 | Escrever o README do app novo, deixando explícito que o Flutter da raiz é legado intocável | T058 | `[//]` | `apps/web/README.md` | 🟢 | `[X]` |
| T064 | Configurar o workflow de CI executando build, teste e a verificação de dependência | T010, T011 | `[//]` | `.github/workflows/web-ci.yml` | 🟡 | `[X]` |

⚠️ **T064 cria um arquivo novo dentro de `.github/`, que já existe.** É criação, não modificação. Nenhum workflow existente é tocado — em especial o da automação do cartoon, que precisa continuar funcionando.

---

## Notas de execução

<!-- Reservado para /reversa-coding -->

---

## Histórico de alterações

| Data | Alteração | Autor |
|---|---|---|
| 2026-10-04 | Versão inicial gerada por `/reversa-to-do` no modo expresso do `/reversa-new` | reversa |
