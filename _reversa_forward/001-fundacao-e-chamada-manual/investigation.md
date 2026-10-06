# Investigation: Fundação e Chamada Manual

> Identificador: `001-fundacao-e-chamada-manual`
> Data: `2026-10-04`

## 1. Pergunta de fundo

Como estruturar um PWA offline-first com Arquitetura Limpa e DDD, em TypeScript, de modo que a camada de domínio permaneça pura e que o comportamento offline seja o caminho padrão em vez de um ramo especial — e, ao mesmo tempo, não se repita a falha estrutural das duas tentativas anteriores em Flutter.

## 2. O que deu errado antes, e por quê

🟢 Fatos verificados no repositório Flutter:

| Sintoma | Evidência | Causa raiz |
|---|---|---|
| Teste não consegue injetar mock | `registration_screen.dart` instancia `SupabaseService()` diretamente; existe um método público `setTestState` criado só para contornar isso | Ausência de inversão de dependência |
| Regra de negócio dentro de widget | Validações e orquestração vivem em `StatefulWidget` | Ausência de camada de domínio |
| Núcleo nunca construído | `face_net_service.dart` retorna `Random().nextDouble()`; o pipeline de matching nunca foi ligado à `HomeScreen` | Custo marginal de cada nova feature crescia; a casca ficou pronta e o núcleo não |
| Offline incompleto | `.memory-bank/product.md` declara offline-first como requisito, mas a persistência chama a rede direto da tela | Offline tratado como camada a adicionar depois |

🟡 A conclusão que importa: nenhum desses problemas é sobre Flutter. Todos seriam reproduzidos em Next.js se a fronteira entre camadas fosse apenas convenção documentada. Daí a decisão D-04 de verificar a regra de dependência automaticamente, e não confiar em disciplina.

## 3. Alternativas avaliadas

### 3.1 Estrutura do repositório

| Alternativa | Prós | Contras | Veredito |
|---|---|---|---|
| **Monorepo com pacotes por camada** | A fronteira é real, verificável por ferramenta; cada pacote declara suas dependências explicitamente | Configuração inicial maior; mais arquivos de manifesto | ✅ Escolhida (D-02, D-03) |
| Pasta única com subdiretórios e aliases de path | Simples de começar | Aliases não impedem importação indevida. É exatamente o modelo que falhou no Flutter, com outro nome | ❌ |
| Repositórios separados | Fronteira máxima | Overhead de versionamento e publicação absurdo para um desenvolvedor solo | ❌ |

### 3.2 Persistência local

| Alternativa | Prós | Contras | Veredito |
|---|---|---|---|
| **Dexie sobre IndexedDB** | API tipada, transações, índices, maduro; peso baixo | Abstração sobre uma API já peculiar | ✅ Escolhida (D-06) |
| SQLite-wasm com OPFS | SQL real no cliente, consultas ricas | Alguns megabytes no bundle; só se justifica com banco local autoritativo, que foi descartado | ❌ |
| IndexedDB puro | Zero dependência | API verbosa e propensa a erro em transações, justamente onde a durabilidade importa | ❌ |
| `localStorage` | Trivial | Síncrono, limite de poucos megabytes, apenas string. Inviável para embeddings futuros | ❌ |

### 3.3 Estratégia offline

Três modelos foram considerados, e a escolha já havia sido feita pelo usuário na entrevista:

| Modelo | Como funciona | Custo | Veredito |
|---|---|---|---|
| Online com cache | Servidor é a verdade, cliente cacheia leitura | Quebra no tatame sem rede | ❌ |
| **Offline de leitura com fila de escrita** | Cache alimenta a leitura; escritas vão para outbox e sobem depois | Precisa de idempotência e ordenação | ✅ Escolhida |
| Offline total autoritativo | Banco local é a verdade; servidor é réplica | Exige CRDTs e resolução de conflito | ❌ Descartado explicitamente: não se justifica com um operador |

🟡 Padrão de referência: **Outbox Pattern**, originado em sistemas distribuídos para garantir entrega ao menos uma vez com idempotência no consumidor. A adaptação aqui é que o "consumidor" é o PostgREST do Supabase, e a idempotência vem de duas fontes complementares — a chave gerada no cliente e as restrições de unicidade no banco (D-08).

### 3.4 Identidade das entidades

| Alternativa | Veredito |
|---|---|
| **UUID v7 no cliente** | ✅ Ordenável por tempo, o que serve à ordenação da fila; permite referenciar entidade criada offline imediatamente |
| UUID v4 no cliente | Funciona, mas exige campo sequencial separado para ordenar |
| ULID | Equivalente ao v7 em propriedades; v7 é padrão formal e tem suporte nativo crescente |
| Identidade atribuída pelo servidor | ❌ Inviabiliza criar aluno e registrar presença dele na mesma sessão offline |

### 3.5 Verificação da regra de dependência

| Alternativa | Veredito |
|---|---|
| **`dependency-cruiser` com regras de camada** | ✅ Expressa a regra declarativamente, roda como teste e em CI, mensagem de erro clara |
| ESLint `no-restricted-imports` | Funciona para casos simples, mas expressar "domínio não importa de infraestrutura, transitivamente" fica frágil |
| Revisão manual | ❌ É o que não funcionou nas duas tentativas anteriores |

## 4. Padrões aplicáveis

| Padrão | Onde | Por quê |
|---|---|---|
| **Arquitetura Limpa** | Estrutura de pacotes | Restrição do PRD. Dependências apontam para dentro |
| **Ports and Adapters** | `domain`/`application` declaram portas; `infrastructure` implementa | É o mecanismo concreto que mantém o domínio puro e testável |
| **Aggregate Root (DDD)** | `Aluno`, `Turma`, `Chamada` | Invariantes aplicadas no domínio: um aluno por chamada, unicidade de chamada por turma e data |
| **Value Object (DDD)** | `Faixa`, `Embedding` (futuro) | `Faixa` concentra a lista canônica em um lugar, de modo que corrigir a premissa 2 toque um arquivo |
| **Outbox Pattern** | `infrastructure/sync` | Entrega ao menos uma vez com idempotência no destino |
| **Repository** | Portas de persistência | Permite trocar Supabase por fake em teste sem alterar caso de uso |
| **Ubiquitous Language** | Nomenclatura em português | O único falante do domínio é brasileiro; traduzir criaria glossário paralelo sem benefício |

## 5. Decisões que foram deliberadamente adiadas

| Item | Por que adiar | Quando decide |
|---|---|---|
| Modelo de embedding e sua dimensão | Decidir antes do spike garante migração futura (risco R4) | Fase 0 da feature de biometria |
| Habilitar `pgvector` | Sem coluna vetorial, a extensão não tem uso | Feature de biometria |
| Provisionar Cloudflare R2 | Esta feature não manipula foto. Provisionar agora adiciona superfície sem uso (risco R5) | Feature de biometria |
| Biblioteca de geração de PDF | A restrição real é peso no bundle, e só se mede com o app pronto | Feature de relatórios |
| Estado de gerenciamento global | O escopo atual não demanda. Introduzir biblioteca antes da necessidade é dívida antecipada | Quando houver necessidade demonstrada |
| Sincronização em segundo plano via service worker | O professor abre o app diariamente; o ganho é marginal | Após o MVP |

## 6. Riscos de investigação em aberto

- 🟡 **Desempenho do IndexedDB em celular de gama média** não foi medido. O alvo de 300 ms para carregar a turma do cache é plausível para ~300 alunos sem embeddings, mas a feature de biometria vai adicionar vetores ao cache e isso precisa ser remedido lá.
- 🟡 **Comportamento do service worker em iOS** é historicamente mais restritivo que em Android, especialmente quanto a persistência de armazenamento e ciclo de vida. Precisa de verificação no dispositivo real do professor antes de considerar a feature entregue.
- 🟡 **Cota de armazenamento** varia por navegador e por espaço livre no dispositivo. A verificação antes de cada escrita (RF-32) é defesa, mas o comportamento sob pressão real não foi observado.

## 7. Fontes

- `_reversa_sdd/sdd/fundacao-arquitetural.md` — decisões de arquitetura e seu decision log
- `_reversa_sdd/sdd/sincronizacao-offline-first.md` — modelo de outbox, idempotência, ordenação
- `_reversa_sdd/sdd/chamada-e-presenca.md` — decisão de rollout do caminho manual primeiro
- `_reversa_sdd/ideation.md` — herança analisada das duas tentativas anteriores
- Repositório Flutter: `lib/services/supabase_service.dart`, `lib/screens/registration_screen.dart`, `lib/ml/face_net_service.dart`, `supabase/schema.sql` 🟢
- `.memory-bank/context.md` e `.memory-bank/architecture.md` do repositório anterior 🟢

---
Gerado por `/reversa-plan` em 2026-10-04.
