# JiuPresence — app web

PWA offline-first para controle de presença e graduação em academia de
jiu-jitsu. Arquitetura Limpa + DDD, Next.js no Vercel, Supabase como fonte
de verdade.

---

## ⚠️ Antes de qualquer coisa: o Flutter na raiz é legado

Este repositório contém **duas** implementações do mesmo produto.

| Caminho | O que é | Pode mexer? |
|---|---|---|
| `lib/`, `test/`, `supabase/`, `docs/`, `web/`, `windows/`, `pubspec.yaml` | Projeto Flutter anterior | ❌ **Não.** Legado intocável |
| `apps/web/`, `packages/*`, `infra/` | O app atual | ✅ Sim |
| `_reversa_sdd/`, `_reversa_forward/` | Specs e plano | ✅ Documentação |

Não rode `flutter` nada. Não edite `pubspec.yaml`. Não apague `lib/`.

A remoção do Flutter é uma feature própria, com dez critérios de validação
em [`_reversa_sdd/sdd/descomissionamento-do-legado.md`](../../_reversa_sdd/sdd/descomissionamento-do-legado.md).
Dois deles não têm atalho: **5 chamadas em aula real** e **4 semanas sem o
professor recorrer ao papel**.

---

## Estrutura

```
packages/domain/          TypeScript puro. Zero dependências de runtime.
                          Entidades, objetos de valor, invariantes, portas.
packages/application/     Casos de uso. Dependem só de portas.
packages/infrastructure/  Adaptadores: Supabase, IndexedDB, outbox, cache.
packages/contracts/       Schemas Zod e os tipos derivados. Pacote folha.
apps/web/                 Next.js App Router. Telas + composition root.
infra/supabase/migrations/ SQL versionado. NÃO confundir com supabase/ (Flutter).
```

As dependências apontam **sempre para dentro**:

```
apps/web  ->  application  ->  domain
     |             |             ^
     |             +-> contracts |
     +-> infrastructure ---------+
```

Isso não é convenção: `.dependency-cruiser.cjs` verifica, e a verificação
roda como teste. Violar a fronteira **quebra o build**.

> **Por que isso existe.** Nas duas tentativas anteriores em Flutter,
> `SupabaseService()` era instanciado dentro das telas. O resultado: testes
> impossíveis de escrever sem um método público criado só para contornar, e
> o núcleo de valor (matching facial, graduação, relatórios) nunca saiu do
> papel. A casca ficou pronta; o produto não.

---

## Começando

### Pré-requisitos

- Node 20+
- pnpm 9+
- Projeto Supabase (região São Paulo)

### Backend

1. Aplique as migrações de `infra/supabase/migrations/` em ordem.
2. Confirme a RLS: consulta anônima sem sessão deve retornar **zero linhas**
   em todas as tabelas.
3. Crie o usuário do professor em Authentication (não há cadastro aberto).
4. Insira a linha correspondente em `operador`, com o mesmo `id`.

### Local

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # preencha
pnpm dev
```

---

## Comandos

```bash
pnpm test        # 207 testes unitários e de integração
pnpm --filter @jiupresence/web run e2e   # Playwright, fluxo offline
pnpm arch        # só a regra de dependência
pnpm typecheck   # tsc em todos os pacotes
pnpm build       # build de produção
```

### Verificação negativa obrigatória

O teste que protege a arquitetura precisa ser verificado de vez em quando,
porque um teste de arquitetura quebrado passa silenciosamente:

1. Adicione `export * from '@jiupresence/infrastructure';` em
   `packages/domain/src/index.ts`.
2. Rode `pnpm test`.
3. **Ele precisa falhar.** Se passar, a proteção não existe.
4. Remova a linha.

> Isso não é paranoia. Na primeira vez que essa verificação foi feita neste
> projeto, ela deu **falso-positivo**: o teste passava com a importação
> proibida, porque `packages/infrastructure/src` ainda não existia e o
> import era irresolvível.

---

## O que funciona hoje

- PWA instalável, shell abre offline
- Autenticação do professor, sessão persistente
- Cadastro de alunos com escala de faixa derivada da idade
- Turmas e matrículas
- **Chamada manual** completa, funcionando sem rede
- Outbox com idempotência, ordenação e espera exponencial
- Tela de pendências para falhas permanentes

## O que não funciona ainda

- **Reconhecimento facial.** A porta está declarada
  (`packages/domain/src/portas/reconhecimento-facial.ts`) mas não
  implementada. Depende de um spike com critério de abandono explícito.
- Graduação e frequência consolidada
- Relatórios em PDF

---

## Decisões que não são óbvias

| Decisão | Por quê |
|---|---|
| Toda escrita passa pelo outbox, **inclusive online** | Dois caminhos de escrita = duas semânticas, e a offline só seria exercida no cenário crítico, portanto a menos testada |
| UUID v7 gerado no cliente | Sem id local, uma entidade criada offline não pode ser referenciada por outra antes de subir |
| Contador de ordem persistente | Derivar do maior `ordem` na fila faz o contador reiniciar quando ela esvazia |
| 409 em chave primária = sucesso; em `chamada_unica_por_turma_e_data` = falha | "Já me mandou isso" é diferente de "outro registro ocupa esse lugar" |
| `skipWaiting: false`, `clientsClaim: true` | O primeiro evita trocar de versão no meio de uma chamada; o segundo é necessário para o app abrir offline |
| Nomes do domínio em português | O único falante do domínio é brasileiro. Traduzir criaria um glossário paralelo |
| Nenhuma coluna `vector` ainda | A dimensão do embedding é **saída** do spike de biometria. Fixar antes garante migração |

---

## Pendente de decisão do professor

1. Escala infantil e idade de corte — assumido: 16 anos, branca/cinza/amarela/laranja/verde
2. Graus dentro da faixa entram no modelo?
3. Aulas mínimas por faixa para graduação
4. Fotos reais do dojo para o spike de biometria
