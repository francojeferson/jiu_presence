# JiuPresence

Controle de presença para academia de jiu-jítsu. PWA offline-first: o professor
abre a chamada da turma no celular, marca quem veio com um toque e confirma. Tudo
é gravado no aparelho e sobe para o Supabase quando houver rede.

O alvo é a chamada de uma turma de 20 alunos em menos de 90 segundos, **sem
depender de internet no tatame**.

## Por quê

Chamada em papel é lenta e se perde. O professor gasta de 5 a 10 minutos por aula
chamando nome por nome, e a folha não responde a pergunta que importa na hora de
graduar alguém: quem faltou, e com que frequência.

A academia também costuma não ter sinal no tatame. Qualquer solução que exija
rede para registrar presença volta para o papel no primeiro dia ruim de conexão.
Por isso o offline aqui não é um modo degradado: é o caminho normal.

## O que já funciona

- **Chamada offline de ponta a ponta.** A lista mostra todos os matriculados,
  presentes e ausentes. Um toque alterna. Confirmar grava no aparelho.
- **Fila de sincronização que não perde nada.** Toda escrita passa por um outbox
  no IndexedDB, mesmo havendo rede. Ele sobrevive a recarga, a fechamento do app
  e a dias sem conexão, e nada é descartado em silêncio.
- **Cadastro de alunos e turmas**, com matrícula, inativação reversível e busca
  insensível a acento.
- **Pendências visíveis.** O que o servidor recusou em definitivo aparece
  explicado em português, com as opções de tentar de novo ou descartar.
- **PWA instalável**, que abre sem rede depois da primeira visita online.

## O que ainda não existe

- **Reconhecimento facial.** A porta está declarada no domínio
  (`packages/domain/src/portas/reconhecimento-facial.ts`) e nenhuma
  implementação foi escrita. A Fase 0 mediu a detecção; o reconhecimento
  depende de fotos sem recompressão e de um modelo com licença permissiva.
  Ver `_reversa_sdd/sdd/biometria-facial-on-device.md`.
- Relatórios em PDF, notificações e graduação.

## Arquitetura

Monorepo pnpm com Arquitetura Limpa. A regra de dependência é verificada no CI
pelo `dependency-cruiser` e por um teste do domínio: nenhuma camada importa de
camada mais externa.

```
apps/web            PWA Next.js — telas e composition root
packages/domain     Entidades e regras. Zero dependência de runtime.
packages/application Casos de uso. Depende só de portas.
packages/contracts  Schemas de fronteira (Zod). Pacote folha.
packages/infrastructure IndexedDB (Dexie), Supabase, outbox, sincronização
infra/supabase      Migrações SQL com RLS desde a primeira
```

| Camada | Tecnologia |
|---|---|
| Interface | Next.js 15, React 19, PWA via Serwist |
| Armazenamento local | IndexedDB com Dexie |
| Backend | Supabase (PostgreSQL + Auth), RLS em todas as tabelas |
| Validação | Zod, só no pacote `contracts` |
| Testes | Vitest (unidade) e Playwright (ponta a ponta, com rede controlada) |

## Começando

Requisitos: Node >= 20.11 e pnpm 9.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # preencha URL e chave anônima
pnpm dev
```

Verificação completa, a mesma do CI:

```bash
pnpm typecheck     # tipos em todos os pacotes
pnpm arch          # regra de dependência da Arquitetura Limpa
pnpm test          # unidade, com limiar de cobertura no domínio
pnpm build
pnpm e2e           # Playwright; sobe o app em modo produção
```

O cenário de ponta a ponta contra o Supabase de verdade exige o serviço local:

```bash
pnpm exec supabase start --workdir infra
```

Sem ele, os testes que dependem de RLS e login real são **ignorados**, não
reprovados.

## O projeto Flutter é legado, não o produto

`lib/`, `test/`, `web/`, `windows/`, `supabase/schema.sql` e `pubspec.yaml` são
de duas tentativas anteriores em Flutter com reconhecimento facial. Estão
**preservados e congelados**: um passo do CI reprova qualquer alteração neles.

A remoção tem critérios próprios em
`_reversa_sdd/sdd/descomissionamento-do-legado.md`, e nenhum deles é "o CI
passou". Não use `lib/services/supabase_service.dart` como referência: ele traz
credenciais de exemplo no código, exatamente o que a aplicação atual não faz.

## Documentação

- **`_reversa_refactor/pendencias-abertas.md` — o que está em aberto.** Registro
  vivo; comece por aqui.
- `_reversa_forward/001-fundacao-e-chamada-manual/HANDOFF.md` — estado atual e
  como retomar
- `_reversa_sdd/` — PRD e especificações
- `_reversa_refactor/auditoria-ponytail-*.md` — auditorias, fotografias datadas

## Licença

Ainda não definida.
