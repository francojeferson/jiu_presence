# Roadmap: Fundação Arquitetural e Chamada Manual

> Identificador: `001-fundacao-e-chamada-manual`
> Data: `2026-10-04`
> Requirements: `_reversa_forward/001-fundacao-e-chamada-manual/requirements.md`
> Confidência: 🟢 CONFIRMADO, 🟡 INFERIDO, 🔴 LACUNA
>
> **Nota greenfield:** não há delta sobre legado em sentido estrito. O projeto Flutter existente não é evoluído, é substituído, e permanece intocado por restrição de política. O "delta" aqui é contra as specs de `_reversa_sdd/sdd/`, não contra código em produção.

## 1. Resumo da abordagem

Monorepo pnpm com Turborepo, quatro pacotes de biblioteca e um app. O domínio em TypeScript puro concentra entidades, objetos de valor e invariantes; a camada de aplicação expõe casos de uso que dependem apenas de portas; a infraestrutura implementa essas portas contra Supabase, IndexedDB e Cloudflare R2; o app Next.js é simultaneamente a camada de apresentação e a composition root.

A regra de dependência não é convenção: é verificada por `dependency-cruiser` em CI, e uma importação indevida quebra o build. Essa escolha responde diretamente ao diagnóstico das duas tentativas anteriores, em que a ausência de inversão de dependência tornou o código não-testável e travou a entrega do núcleo.

A persistência tem um único caminho de escrita, sempre através de um outbox em IndexedDB, independentemente de haver rede. Leitura passa por um cache local alimentado por sincronização. Isso torna o comportamento offline o caminho padrão em vez de um ramo especial, que é a única forma de garantir que ele funcione no tatame.

A chamada entregue nesta feature é manual. O pipeline facial tem ponto de extensão desenhado — a porta `FaceRecognitionService` existe no domínio e não tem implementação — mas nenhuma dependência de ML entra no bundle. É o que permite entregar e validar em aula real antes de assumir o maior risco do projeto.

## 2. Princípios aplicados

🟡 `.reversa/principles.md` não existe neste projeto. Na ausência dele, adotam-se os princípios declarados nas restrições do `prd.md#6` e nas specs, tratados aqui como princípios de fato.

| Princípio | Como a feature se relaciona | Status |
|---|---|---|
| I. Arquitetura Limpa, dependências apontam para dentro | D-02 e D-03 estabelecem as camadas; `dependency-cruiser` em CI verifica automaticamente | respeita |
| II. DDD, domínio puro e expressivo | Agregados `Aluno`, `Turma` e `Chamada` com invariantes no domínio, sem dependência de framework | respeita |
| III. Local-first, offline é operação normal | D-05 e D-06: caminho único de escrita via outbox, cache de leitura | respeita |
| IV. Nenhuma escrita fora das pastas do Reversa sem liberação | D-01 confina o código a `apps/`, `packages/` e `infra/`, todos inexistentes hoje | respeita |
| V. Privacidade por arquitetura, inferência no dispositivo | Não exercido nesta feature (sem ML), mas a porta é desenhada para não permitir inferência remota | respeita |
| VI. Superfície operacional mínima | Cloudflare restrito a R2 + Images + CDN; sem Workers. Risco R5 do PRD | respeita |

## 3. Decisões técnicas

| ID | Decisão | Justificativa | Alternativas descartadas | Confidência |
|---|---|---|---|---|
| D-01 | Monorepo em `apps/web` e `packages/*`, com migrações em `infra/supabase/migrations` | Nenhum desses caminhos existe hoje, portanto não há colisão com `lib/`, `test/`, `supabase/`, `web/` ou `windows/` do Flutter. Atende RF-37 sem exceção | Raiz única; diretório `jiupresence-web/`; substituir `lib/` | 🟡 |
| D-02 | pnpm workspaces mais Turborepo | Fronteira de pacote é o que torna a regra de dependência verificável; cache de build acelera CI | npm workspaces sem orquestrador; Nx; pasta única com aliases de path | 🟡 |
| D-03 | Quatro pacotes: `domain`, `application`, `infrastructure`, `contracts` | Mapeia um-para-um nas camadas da Arquitetura Limpa. `contracts` isola schemas Zod compartilhados entre app e infraestrutura sem puxar nenhum dos dois | Três pacotes com contratos dentro do domínio; dois pacotes (core e app) | 🟡 |
| D-04 | `dependency-cruiser` com regras de camada executando em CI e como teste | Convenção documentada não impede importação indevida; verificação automática impede. É a resposta direta ao diagnóstico das tentativas anteriores | ESLint `no-restricted-imports`; revisão manual de código | 🟡 |
| D-05 | Caminho único de escrita via outbox em IndexedDB, mesmo online | Dois caminhos significam duas semânticas, e a offline só seria exercida no cenário crítico, portanto a menos testada. RN-08 | Caminho rápido direto quando online; escrita otimista com rollback | 🟡 |
| D-06 | Dexie sobre IndexedDB para cache e outbox | API tipada e madura, com transações e índices. SQLite-wasm foi descartado por peso no bundle e por não ser necessário sem banco local autoritativo | SQLite-wasm com OPFS; `localStorage`; IndexedDB puro | 🟡 |
| D-07 | UUID v7 gerado no cliente como identidade de toda entidade | Ordenável por tempo, o que serve à ordenação da fila, e permite referenciar entidade criada offline antes de qualquer contato com o servidor. RF-30 | UUID v4 com sequencial separado; identidade atribuída pelo servidor; ULID | 🟡 |
| D-08 | Idempotência por `id` da operação mais restrições de unicidade no banco | Chave de idempotência protege contra reenvio do mesmo item; a restrição protege contra itens distintos representando o mesmo fato. Problemas diferentes, defesas diferentes | Deduplicação heurística no servidor; apenas unicidade no banco | 🟡 |
| D-09 | Supabase Auth com persistência de sessão e renovação automática | Único mecanismo de auth necessário para operador único. Offline, a sessão local é aceita sem revalidação | NextAuth; auth própria; sessão apenas em memória | 🟡 |
| D-10 | RLS com negação por padrão desde a primeira migração | Habilitar RLS em banco já populado é fonte conhecida de vazamento, e o custo de fazer agora é próximo de zero | Habilitar depois; confiar na camada de aplicação | 🟡 |
| D-11 | `next-pwa` ou Serwist para service worker, com pré-cache do shell | Precisa haver shell cacheado para o cold start offline de 2 segundos. Service worker escrito à mão é fonte de bug sutil de invalidação | Service worker manual; sem PWA, apenas responsivo | 🟡 |
| D-12 | Server Components apenas para telas com rede garantida; chamada e cadastro são Client Components | A chamada precisa funcionar offline, o que é incompatível com renderização no servidor no momento do uso | Tudo RSC; tudo cliente | 🟡 |
| D-13 | Porta `FaceRecognitionService` declarada no domínio, sem implementação nesta feature | Define o ponto de extensão sem trazer peso de ML nem acoplar o produto a um resultado de spike que ainda não existe | Implementar junto; não declarar a porta agora | 🟡 |
| D-14 | Nenhuma coluna `vector` criada nesta feature | A dimensionalidade do embedding é saída do spike de biometria. Criar `vector(128)` agora, herdando do `schema.sql` do Flutter, garante migração futura. Risco R4 do PRD | `vector(128)` como no legado; coluna genérica `jsonb` | 🟢 |
| D-15 | Cloudflare R2 adiado para a feature de biometria | Esta feature não manipula foto. Provisionar R2 agora adiciona superfície operacional sem uso. Risco R5 | Provisionar junto com a fundação | 🟡 |
| D-16 | Vitest para unidade e integração, Playwright para o fluxo offline de ponta a ponta | O cenário crítico (chamada offline, reinício, sincronização) só é verificável em navegador real com controle de rede | Apenas Vitest com jsdom; Cypress | 🟡 |
| D-17 | Zod como fonte única de schema, em `contracts`, derivando tipos TypeScript | Validação de fronteira e tipo saem do mesmo lugar, eliminando divergência entre o que é validado e o que é tipado | Tipos manuais mais validação separada; io-ts; Valibot | 🟡 |

## 4. Premissas

| Premissa | Origem (`requirements.md` seção) | Risco se errada |
|---|---|---|
| 🟡 O app novo vive em `apps/web` e `packages/*` na raiz, sem colidir com o Flutter | §10, lacuna 1 | Baixo. Renomear diretório é mecânico e barato enquanto o projeto é novo |
| 🟡 Corte entre escala infantil e adulta aos 16 anos; infantil com cinza, amarela, laranja e verde; adulta com branca, azul, roxa, marrom e preta; sem graus nesta feature | §10, lacuna 2 | Médio. Afeta o enum de faixa e, por consequência, a tabela de critérios da feature de graduação. Migração de enum com dado existente é trabalhosa |
| 🟡 Camadas gratuitas de Vercel, Supabase e Cloudflare são suficientes para um operador único | §10, lacuna 3 | Baixo no curto prazo. Custo aparece como surpresa, não como falha técnica |
| 🟡 O professor usa um navegador moderno com suporte a IndexedDB e service worker | implícita em RF-05, RF-22 | Alto se falsa, mas improvável. Sem esses recursos não há produto offline possível em PWA |
| 🟡 Uma turma tem no máximo uma aula por dia | RN-02 | Médio. Duas aulas da mesma turma no mesmo dia violariam a unicidade `(turma_id, data)`. Ver OQ-01 de `chamada-e-presenca` |

## 5. Delta arquitetural

| Componente | Arquivo de origem | Tipo de mudança | Resumo |
|---|---|---|---|
| `packages/domain` | `_reversa_sdd/sdd/fundacao-arquitetural.md#RF-02` | componente-novo | Entidades `Aluno`, `Turma`, `Chamada`, `Presenca`, `Matricula`; VOs `Faixa`, `PeriodoLetivo`; portas de repositório; serviços de domínio |
| `packages/application` | `_reversa_sdd/sdd/fundacao-arquitetural.md#RF-04` | componente-novo | Casos de uso de cadastro, matrícula e chamada, dependentes apenas de portas |
| `packages/infrastructure` | `_reversa_sdd/sdd/sincronizacao-offline-first.md#9` | componente-novo | Adaptadores Supabase e Dexie; outbox; sincronizador; cache |
| `packages/contracts` | `_reversa_sdd/sdd/fundacao-arquitetural.md#RF-01` | componente-novo | Schemas Zod e tipos derivados, compartilhados sem acoplar camadas |
| `apps/web` | `_reversa_sdd/sdd/fundacao-arquitetural.md#RF-05` | componente-novo | Next.js App Router, PWA, composition root, telas de auth, alunos, turmas e chamada |
| `infra/supabase/migrations` | `_reversa_sdd/sdd/fundacao-arquitetural.md#RF-11` | componente-novo | Migrações versionadas, fora de `supabase/` do Flutter |
| `supabase/schema.sql` (Flutter) | `supabase/schema.sql` | **inalterado** | Permanece byte-a-byte intacto. Conceitualmente substituído, fisicamente preservado 🟢 |
| `lib/` (Flutter) | projeto legado | **inalterado** | Nenhum arquivo tocado. Remoção é feature futura, bloqueada por política 🟢 |

## 6. Delta no modelo de dados

- Resumo das mudanças: cinco tabelas novas (`operador`, `aluno`, `turma`, `matricula`, `chamada`, `presenca`), nenhuma coluna vetorial, RLS em todas, duas restrições de unicidade que sustentam a idempotência da fila. O schema diverge do `supabase/schema.sql` do Flutter em três pontos estruturais: a entidade `turma` passa a existir, `presenca` passa a pertencer a uma `chamada` em vez de referenciar o aluno diretamente, e `academia` desaparece junto com o multi-tenant.
- Detalhe completo em: `_reversa_forward/001-fundacao-e-chamada-manual/data-delta.md`

## 7. Delta de contratos externos

| Contrato | Tipo | Arquivo de detalhe |
|---|---|---|
| Sincronização do outbox com Supabase | HTTP / PostgREST | `_reversa_forward/001-fundacao-e-chamada-manual/interfaces/sync-outbox.md` |

🟡 Não há API pública própria. O app conversa com o Supabase via SDK, e o único contrato que merece especificação é o protocolo de envio da fila, por conta das garantias de idempotência e ordenação.

## 8. Plano de migração

🟡 Não há migração de dados: o projeto Flutter nunca teve backend configurado (credenciais `your-project-id.supabase.co`), portanto não existe dado de produção. O plano abaixo é de implantação inicial.

1. Provisionar projeto Supabase em região brasileira e registrar as variáveis de ambiente.
2. Aplicar as migrações iniciais, com RLS ativa desde a primeira.
3. Provisionar a conta do operador manualmente, já que não há cadastro aberto.
4. Configurar o projeto no Vercel com as variáveis e o deploy automático do branch principal.
5. Publicar e instalar o PWA no dispositivo do professor.
6. Cadastrar turmas e alunos reais.
7. Validar a chamada em aula real, inclusive em modo avião, antes de considerar a feature entregue.

## 9. Riscos e mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| 🟡 Escrita confirmada perdida por falha no outbox | alto | média | Transação única em IndexedDB envolvendo a gravação local e o enfileiramento. Testes de ponta a ponta cobrindo reinício do dispositivo com fila não vazia. Fila nunca é descartada em recuperação de cache corrompido |
| 🟡 Chamada manual acima de 90 segundos por fricção de interface | alto | média | Alvo de toque de 48 px, lista de toque único, zero navegação entre telas durante a marcação. Medir com 20 alunos reais, não em bancada |
| 🟡 Regra de dependência erodir apesar da verificação | médio | baixa | `dependency-cruiser` roda como teste, não apenas em CI, para falhar localmente antes do push |
| 🟡 Cota de IndexedDB estourar em dispositivo com pouco espaço | médio | baixa | Verificação de cota antes de cada escrita; alerta bloqueante; nunca descartar item de fila para abrir espaço |
| 🟡 Service worker servir versão obsoleta durante uma chamada | médio | média | Nova versão baixa em segundo plano e ativa só na próxima abertura, nunca durante uso |
| 🟡 Enum de faixa errado forçar migração com dado existente | médio | média | Premissa 2. Modelar `Faixa` como VO no domínio com a lista em um único lugar, de modo que a correção toque um arquivo e uma migração |
| 🟢 Escrita acidental em arquivo do Flutter | alto | baixa | Todos os caminhos de saída confinados a diretórios inexistentes hoje. Verificação explícita ao final: `git status` não pode mostrar modificação nos caminhos legados |
| 🟡 Duas aulas da mesma turma no mesmo dia violarem a unicidade | baixo | baixa | Premissa 5. Se ocorrer, a restrição passa a incluir o horário, com migração aditiva |

## 10. Critério de pronto

- [ ] Todas as ações do `actions.md` marcadas `[X]`
- [ ] `pnpm test` verde, incluindo o teste de regra de dependência
- [ ] Cobertura de `packages/domain` igual ou superior a 90% de linhas
- [ ] Teste de ponta a ponta do fluxo offline passando: chamada em modo avião, reinício, sincronização, data da aula preservada
- [ ] `git status` sem modificação ou deleção em `lib/`, `test/`, `supabase/`, `docs/`, `web/`, `windows/`, `pubspec.yaml`, `analysis_options.yaml`
- [ ] Nenhum segredo no repositório; arquivo de exemplo de variáveis presente
- [ ] `legacy-impact.md` e `regression-watch.md` gerados pelo `/reversa-coding`
- [ ] Deploy em produção acessível e PWA instalável em dispositivo real

## 11. Histórico de alterações

| Data | Alteração | Autor |
|---|---|---|
| 2026-10-04 | Versão inicial gerada por `/reversa-plan` no modo expresso do `/reversa-new` | reversa |
