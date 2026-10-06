# Regression Watch: Fundação e Chamada Manual

> Identificador: `001-fundacao-e-chamada-manual`
> Data: `2026-10-04`

## Watch principal

> **Vazio.** Cenário greenfield: não existem regras 🟢 extraídas de código para vigiar. Nada foi alterado em sistema existente, portanto não há regressão possível contra uma extração anterior.
>
> Os itens da seção "Observações" ganham peso de regressão quando uma futura execução de `/reversa` sobre o código novo os confirmar como 🟢.

| ID | Origem | Regra esperada após mudança | Tipo | Sinal de violação |
|---|---|---|---|---|
| — | — | — | — | — |

## Observações

🟡 Requisitos implementados nesta rodada, **sem peso de regressão** por ora. Cada um tem o teste que o sustenta, e é esse teste que detecta a quebra até a próxima extração.

| ID | Requisito | Spec de origem | Teste que sustenta |
|---|---|---|---|
| O001 | Domínio sem dependência de framework, HTTP, banco ou browser | `fundacao-arquitetural` RF-02 | `domain/test/arquitetura.test.ts` |
| O002 | Build falha quando uma camada importa de camada mais externa | `fundacao-arquitetural` RF-03 | `domain/test/arquitetura.test.ts` — **verificação negativa comprovada** |
| O003 | Migrações em diretório novo; `supabase/schema.sql` intacto | `fundacao-arquitetural` RF-11 | `git status` nos caminhos legados |
| O004 | RLS ativa em todas as tabelas, negando por padrão | `fundacao-arquitetural` RF-10 | ⚠️ **sem teste automatizado** — verificar no painel do Supabase |
| O032 | O shell abre e renderiza offline | `fundacao-arquitetural` RF-06 | `e2e/chamada-offline.spec.ts` |
| O033 | A chamada completa funciona sem rede e enfileira | `chamada-e-presenca` RF-20 | `e2e/chamada-offline.spec.ts` |
| O034 | A fila sobrevive à recarga da aba | `sincronizacao-offline-first` RF-04 | `e2e/chamada-offline.spec.ts` |
| O035 | O indicador mostra pendências offline, sem rodada de sync | `sincronizacao-offline-first` RF-29 | `e2e/chamada-offline.spec.ts` |
| O036 | Service worker: `clientsClaim: true` e `skipWaiting: false` | `fundacao-arquitetural` RF-06, EC-02 | `e2e/chamada-offline.spec.ts` — inverter clientsClaim quebra o teste |
| O037 | Gravação local e enfileiramento na mesma transação | `sincronizacao-offline-first` RNF-01 | ⚠️ **sem teste de falha parcial** — a transação Dexie é a garantia |
| O038 | Nenhum dado pessoal no log | `fundacao-arquitetural` §12 | ⚠️ **sem teste** — higienização por lista de campos em `log.ts` |
| O039 | O legado Flutter permanece intocado | `descomissionamento-do-legado` | `.github/workflows/web-ci.yml`, passo dedicado |
| O005 | Faixa coerente com a escala; escalas não se misturam | `gestao-de-alunos-e-turmas` RF-09 | `domain/test/faixa.test.ts` |
| O006 | Escala derivada da idade; escolha explícita sem data de nascimento | `gestao-de-alunos-e-turmas` RF-11 | `domain/test/faixa.test.ts`, `domain/test/aluno.test.ts` |
| O007 | Aluno com histórico não é excluído, apenas inativado | `gestao-de-alunos-e-turmas` RF-15 | `domain/test/aluno.test.ts` + `on delete restrict` em `presenca` |
| O008 | Inativação preserva o histórico | `gestao-de-alunos-e-turmas` RF-14 | `domain/test/aluno.test.ts` |
| O009 | Mudança de escala por idade sinaliza, nunca converte sozinha | `gestao-de-alunos-e-turmas` EC-01 | `domain/test/aluno.test.ts` |
| O010 | Presenças anteriores à desmatrícula permanecem válidas | `gestao-de-alunos-e-turmas` EC-10 | `domain/test/turma.test.ts` |
| O011 | Um aluno aparece no máximo uma vez por chamada | `chamada-e-presenca` RF-09 | `domain/test/chamada.test.ts` + `unique(chamada_id, aluno_id)` |
| O012 | Uma chamada confirmada por turma e data | `chamada-e-presenca` RF-13 | `application/test/chamada.test.ts` + `unique(turma_id, data)` |
| O013 | A lista exibe todos os matriculados, presentes e ausentes | `chamada-e-presenca` RF-06 | `application/test/chamada.test.ts` |
| O014 | Um toque alterna o estado de presença | `chamada-e-presenca` RF-08 | `domain/test/chamada.test.ts`, `application/test/chamada.test.ts` |
| O015 | A presença conta pela data da AULA, nunca pela do envio | `chamada-e-presenca` EC-09 | `domain/test/chamada.test.ts`, `application/test/chamada.test.ts`, `infrastructure/test/outbox.test.ts` |
| O016 | Chamada de turma sem alunos é recusada com orientação | `chamada-e-presenca` EC-06 | `application/test/chamada.test.ts` |
| O017 | Aula fora da grade é sinalizada, não bloqueada | `chamada-e-presenca` EC-12 | `application/test/chamada.test.ts` |
| O018 | Presença manual não carrega confiança; automática exige | `chamada-e-presenca` RF-11 | `domain/test/chamada.test.ts` + constraint no banco |
| O019 | A fila entrega na ordem de criação | `sincronizacao-offline-first` RF-06 | `infrastructure/test/outbox.test.ts` |
| O020 | A ordem não depende do relógio do dispositivo | `sincronizacao-offline-first` EC-06 | `infrastructure/test/outbox.test.ts` |
| O021 | A fila sobrevive ao fechamento do app e reinício | `sincronizacao-offline-first` RF-04 | `infrastructure/test/outbox.test.ts` |
| O022 | Falha transitória nunca descarta o item, sem limite de tentativas | `sincronizacao-offline-first` RF-08 | `infrastructure/test/outbox.test.ts` |
| O023 | Falha permanente é visível, explicada e reativável | `sincronizacao-offline-first` RF-11 | `infrastructure/test/outbox.test.ts` |
| O024 | 409 em chave primária é sucesso idempotente | `interfaces/sync-outbox.md` §3 | `infrastructure/test/classificacao.test.ts` |
| O025 | 409 em `chamada_unica_por_turma_e_data` é conflito real | `interfaces/sync-outbox.md` §3.1 | `infrastructure/test/classificacao.test.ts` |
| O026 | 409 em `presenca_unica_por_chamada_e_aluno` é sucesso | `interfaces/sync-outbox.md` §3.2 | `infrastructure/test/classificacao.test.ts` |
| O027 | Sessão expirada é transitória; a fila nunca é descartada | `sincronizacao-offline-first` EC-12 | `infrastructure/test/classificacao.test.ts` |
| O028 | Status desconhecido é transitório por desenho | `interfaces/sync-outbox.md` §4 | `infrastructure/test/classificacao.test.ts` |
| O029 | Nenhum código técnico chega à mensagem do professor | `fundacao-arquitetural` §8 | `infrastructure/test/classificacao.test.ts` |
| O030 | Cota esgotada bloqueia escrita sem descartar item da fila | `sincronizacao-offline-first` RF-16 | ⚠️ **sem teste automatizado** — depende de API do navegador |
| O031 | Cobertura do domínio ≥ 90% | `fundacao-arquitetural` RNF-04 | limiar em `vitest.workspace.ts`; medido em 98,94% |

### Pontos sem cobertura automatizada

⚠️ Cinco garantias desta feature **não têm teste automatizado** e dependem de verificação manual, registradas aqui para não serem esquecidas:

1. **O004, RLS negando por padrão.** Exige um projeto Supabase real. Roteiro em `onboarding.md` §2, passo 4.
2. **O030, cota de armazenamento.** Depende de `navigator.storage.estimate`, indisponível em Node.
3. **Chegada ao Supabase com a data da aula.** O Playwright cobre tudo até a fila local; o último elo está como `fixme` porque exige um projeto Supabase provisionado. É o critério CV-03 do descomissionamento e, por ora, só o roteiro manual de `onboarding.md` §5.4 o verifica.
4. **O037, atomicidade da gravação com enfileiramento.** A transação do Dexie é a garantia; não há teste que force falha no meio dela.
5. **O038, ausência de dado pessoal no log.** A higienização é por lista de campos conhecidos. Um campo novo com dado pessoal passaria despercebido.

## Histórico de re-extrações

> Vazio. Será preenchido quando `/reversa` rodar sobre o código novo.

| Data | Resultado | Itens promovidos a 🟢 |
|---|---|---|
| — | — | — |

## Arquivadas

> Vazio.

---
Gerado por `/reversa-coding` em 2026-10-04.
