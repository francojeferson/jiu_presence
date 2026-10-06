# Data Delta: Fundação e Chamada Manual

> Identificador: `001-fundacao-e-chamada-manual`
> Data: `2026-10-04`
> Base de comparação: `supabase/schema.sql` do projeto Flutter 🟢 e as specs em `_reversa_sdd/sdd/`

## 1. Comparação com o schema legado

O schema do Flutter tinha três tabelas. Nenhuma sobrevive sem alteração estrutural.

| Tabela legada | Destino | Motivo |
|---|---|---|
| `academia` | 🟢 **removida** | Existia para multi-tenant e controle de licença (`data_expira`). Ambos fora de escopo: operador único, ferramenta interna |
| `aluno` | 🟡 **reestruturada** | Perde `cpf`, `termo_aceite`, campos de responsável legal, `academia_id` e a coluna `embedding vector(128)`. Ganha `ativo` e `data_ultima_graduacao` |
| `presenca` | 🟡 **reestruturada** | Deixa de referenciar o aluno diretamente e passa a pertencer a uma `chamada`. É a mudança estrutural central |
| — | 🟡 **nova:** `turma` | Conceito ausente no legado. Sem ele não existe "quem faltou", apenas "quem veio" |
| — | 🟡 **nova:** `matricula` | Relação N-para-N entre aluno e turma |
| — | 🟡 **nova:** `chamada` | A aula como entidade. Pré-requisito da ausência como informação de primeira classe |
| — | 🟡 **nova:** `operador` | Espelha `auth.users`, substitui o conceito de usuário dentro de `academia` |

## 2. Tabelas desta feature

### 2.1 `operador`

```sql
id            uuid primary key references auth.users(id) on delete cascade
email         text not null
nome          text not null
criado_em     timestamptz not null default now()
```

🟡 Provisionada manualmente. Não há cadastro aberto.

### 2.2 `aluno`

```sql
id                      uuid primary key          -- UUID v7 gerado no cliente (D-07)
nome                    text not null
data_nascimento         date
escala                  faixa_escala not null     -- 'adulta' | 'infantil'
faixa_atual             text not null             -- validada contra a escala
data_ultima_graduacao   date
ativo                   boolean not null default true
criado_em               timestamptz not null default now()
atualizado_em           timestamptz not null default now()
```

**Removidos em relação ao legado** 🟢: `cpf`, `termo_aceite`, `responsavel_nome`, `responsavel_cpf`, `academia_id`, `embedding vector(128)`, `foto_url`.

**Justificativas:** CPF e campos de responsável existiam para o termo LGPD e para a cobrança, ambos fora de escopo (RN-09). O `embedding` sai por D-14: sua dimensionalidade é saída do spike de biometria, e criar `vector(128)` agora herdando do legado garante migração futura (risco R4 do PRD). `foto_url` volta na feature de biometria, apontando para R2 em vez de Supabase Storage.

**Nota sobre `escala` e `faixa_atual`** 🟡: a escala é persistida em vez de derivada da idade em tempo de consulta, porque o aluno sem data de nascimento precisa de escala explícita (EC-02 de `gestao-de-alunos-e-turmas`) e porque a mudança de escala por idade é decisão do professor, não automática (EC-01). `faixa_atual` é texto validado por constraint contra a escala, e não dois enums separados, para que corrigir a premissa 2 do roadmap toque uma constraint em vez de um tipo com dado existente.

### 2.3 `turma`

```sql
id            uuid primary key
nome          text not null
dias_semana   smallint[] not null        -- 0=domingo .. 6=sábado
horario       time not null
ativa         boolean not null default true
criado_em     timestamptz not null default now()
```

🟡 Conceito novo. É o recorte que reduz o conjunto candidato do futuro matching facial e que dá sentido operacional à pergunta "quem faltou".

### 2.4 `matricula`

```sql
aluno_id            uuid not null references aluno(id) on delete cascade
turma_id            uuid not null references turma(id) on delete cascade
matriculado_em      date not null default current_date
desmatriculado_em   date                        -- null = matrícula vigente
primary key (aluno_id, turma_id, matriculado_em)
```

🟡 A chave primária inclui `matriculado_em` para permitir rematrícula do mesmo aluno na mesma turma após uma saída, sem perder o histórico do período anterior.

### 2.5 `chamada`

```sql
id                uuid primary key
turma_id          uuid not null references turma(id) on delete restrict
data              date not null
realizada_em      timestamptz not null
origem            chamada_origem not null     -- 'manual' nesta feature; 'foto' e 'mista' depois
total_detectado   int                         -- null nesta feature
confirmada        boolean not null default false
criada_offline    boolean not null default false
criado_em         timestamptz not null default now()

unique (turma_id, data)
```

🟡 **A restrição `unique (turma_id, data)` é o que torna a sincronização idempotente de fato** (RN-02, D-08). Validação apenas na aplicação não sobrevive a reenvio de fila.

🟡 `on delete restrict` em `turma_id`: turma com chamadas não pode ser excluída, apenas desativada (EC-04 de `gestao-de-alunos-e-turmas`).

🟡 `data` é a data da **aula**, nunca a do envio (RN-06, RF-31).

### 2.6 `presenca`

```sql
id              uuid primary key
chamada_id      uuid not null references chamada(id) on delete cascade
aluno_id        uuid not null references aluno(id) on delete restrict
origem          presenca_origem not null    -- 'manual' nesta feature; 'automatica' depois
confianca       real                        -- null nesta feature
registrada_em   timestamptz not null default now()

unique (chamada_id, aluno_id)
```

🟡 **A restrição `unique (chamada_id, aluno_id)`** garante RN-03 no nível do banco.

🟡 `on delete restrict` em `aluno_id` é o que implementa RF-15: aluno com histórico não pode ser excluído, apenas inativado. A regra é aplicada no domínio e reforçada aqui, de modo que nem um erro de código nem uma operação manual no banco consigam destruir histórico.

🟡 `on delete cascade` em `chamada_id`: presença não existe fora de uma chamada. É a invariante do agregado.

## 3. Tipos enumerados

```sql
create type faixa_escala    as enum ('adulta', 'infantil');
create type chamada_origem  as enum ('manual', 'foto', 'mista');
create type presenca_origem as enum ('manual', 'automatica');
```

🟡 `chamada_origem` e `presenca_origem` já incluem os valores da feature de biometria, mesmo sem uso agora. Adicionar valor a enum em Postgres é simples, mas incluir desde já evita uma migração e deixa o modelo legível.

🟡 A **faixa** não é enum. Premissa 2 do roadmap registra que a escala infantil pode estar errada, e alterar um tipo enum com dado existente é caro. Fica como `text` com constraint de domínio, mantendo a lista canônica no VO `Faixa` de `packages/domain`.

## 4. Índices

| Índice | Tabela | Justificativa |
|---|---|---|
| `unique (turma_id, data)` | `chamada` | Idempotência da fila. Obrigatório |
| `unique (chamada_id, aluno_id)` | `presenca` | Um aluno por chamada. Obrigatório |
| `(turma_id) where desmatriculado_em is null` | `matricula` | Consulta mais frequente: alunos vigentes de uma turma, no início de toda chamada |
| `(aluno_id)` | `presenca` | Base do cálculo de frequência da feature de graduação |
| `(data desc)` | `chamada` | Listagem de chamadas recentes |
| `(ativo) where ativo = true` | `aluno` | A chamada considera apenas alunos ativos |

## 5. Row Level Security

🟡 RLS habilitada em **todas** as tabelas desde a primeira migração (D-10, RF-08). Com operador único, as políticas são simples, mas precisam existir desde o início: habilitar RLS em banco já populado é fonte conhecida de vazamento.

```sql
alter table <cada_tabela> enable row level security;

-- Sem sessão autenticada: zero linhas, em qualquer tabela.
create policy operador_total on <cada_tabela>
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
```

🟡 Nenhuma política para o papel `anon`. A ausência de política é negação.

## 6. Estruturas locais, apenas no dispositivo

Não existem no Supabase. Implementadas em Dexie sobre IndexedDB (D-06).

```
outbox
  id                    uuid v7, chave de idempotência (D-07, D-08)
  tipo                  'criar_aluno' | 'atualizar_aluno' | 'inativar_aluno' |
                        'criar_turma' | 'criar_matricula' | 'encerrar_matricula' |
                        'criar_chamada' | 'criar_presenca' | 'remover_presenca'
  payload               json
  criado_em             ISO 8601, data real do evento (RF-31)
  ordem                 int monotônico, garante RF-25
  tentativas            int
  proxima_tentativa_em  ISO 8601 | null
  estado                'pendente' | 'enviando' | 'falha_permanente'
  erro                  text | null

cache
  chave                 ex.: 'turma:<id>:alunos'
  valor                 json
  atualizado_em         ISO 8601
  versao_schema         int, dispara reconstrução (RF-17 da spec de sincronização)
```

🟡 **A ordenação usa `ordem`, não o relógio** (EC-06 da spec de sincronização): o relógio do dispositivo pode ser alterado manualmente ou corrigido por NTP, o sequencial não.

🟡 **Assimetria deliberada entre `cache` e `outbox`:** em qualquer recuperação de inconsistência, o cache é descartável — reconstrói-se a partir do servidor. O outbox é a única cópia de uma intenção do professor e nunca é descartado.

## 7. Migrações

| Ordem | Arquivo | Conteúdo |
|---|---|---|
| 1 | `0001_extensions_and_types.sql` | Extensão `pgcrypto`; os três tipos enumerados |
| 2 | `0002_operador.sql` | Tabela `operador`, RLS, política |
| 3 | `0003_aluno_turma_matricula.sql` | As três tabelas, constraints de faixa, índices, RLS |
| 4 | `0004_chamada_presenca.sql` | As duas tabelas, restrições de unicidade, índices, RLS |

🟡 Todas aditivas e reversíveis. Cada arquivo acompanha o procedimento de reversão em comentário.

🟡 **A extensão `pgvector` não é habilitada nesta feature.** Entra na migração da feature de biometria, junto com a coluna vetorial, quando a dimensionalidade for conhecida (D-14).

🟡 Local: `infra/supabase/migrations/`. **Nunca** `supabase/`, que pertence ao projeto Flutter e permanece intocado (RF-09, RF-37) 🟢.

## 8. Mapa de nomenclatura

🟡 Nomes de tabela e coluna em português, mantendo a convenção do schema legado 🟢 e o vocabulário do domínio, que é o vocabulário do professor. O código TypeScript usa os mesmos termos, sem tradução na fronteira: `Aluno`, `Turma`, `Chamada`, `Presenca`, `Faixa`. Traduzir o domínio para inglês criaria um glossário paralelo sem benefício, dado que o único falante do domínio é brasileiro.

---
Gerado por `/reversa-plan` em 2026-10-04.
