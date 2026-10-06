-- 0003_aluno_turma_matricula.sql
-- JiuPresence — alunos, turmas e matrículas.
--
-- DELTA em relação ao schema legado (supabase/schema.sql do Flutter):
--   aluno    reestruturada: perde cpf, termo_aceite, campos de responsável,
--            academia_id e a coluna embedding vector(128). Ganha ativo e escala.
--   turma    NOVA. Conceito ausente no legado. Sem ela não existe "quem faltou",
--            apenas "quem veio", e o matching facial futuro teria que comparar
--            contra todos os alunos da academia em vez dos ~20 da turma.
--   matricula NOVA. Relação N-para-N.

-- ---------------------------------------------------------------- aluno

create table if not exists aluno (
  id                     uuid         primary key,  -- UUID v7 gerado no cliente (D-07)
  nome                   text         not null check (length(trim(nome)) > 0),
  data_nascimento        date,
  escala                 faixa_escala not null,
  faixa_atual            text         not null,
  data_ultima_graduacao  date,
  ativo                  boolean      not null default true,
  criado_em              timestamptz  not null default now(),
  atualizado_em          timestamptz  not null default now(),

  -- A faixa é validada contra a escala por CONSTRAINT, não por tipo enum.
  -- Premissa 2 do roadmap registra que a escala infantil pode estar errada
  -- (varia entre federações), e alterar enum com dado existente é caro.
  -- Com constraint, corrigir é uma migração de uma linha.
  constraint aluno_faixa_coerente_com_escala check (
    (escala = 'adulta'   and faixa_atual in ('branca','azul','roxa','marrom','preta'))
    or
    (escala = 'infantil' and faixa_atual in ('branca','cinza','amarela','laranja','verde'))
  )
);

comment on column aluno.escala is
  'Persistida, não derivada da idade: aluno sem data_nascimento precisa de escala '
  'explícita, e a migração de escala por idade é decisão do professor, não automática.';

comment on column aluno.data_ultima_graduacao is
  'Marco zero da contagem de frequência. Na feature de graduação passa a ser '
  'derivado da graduação mais recente, permanecendo aqui como valor inicial.';

create index if not exists aluno_ativo_idx on aluno (ativo) where ativo = true;
create index if not exists aluno_nome_idx  on aluno (nome);

-- ---------------------------------------------------------------- turma

create table if not exists turma (
  id           uuid        primary key,
  nome         text        not null check (length(trim(nome)) > 0),
  dias_semana  smallint[]  not null default '{}',   -- 0=domingo .. 6=sábado
  horario      time        not null,
  ativa        boolean     not null default true,
  criado_em    timestamptz not null default now(),

  constraint turma_dias_semana_validos check (
    dias_semana <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);

create index if not exists turma_ativa_idx on turma (ativa) where ativa = true;

-- ---------------------------------------------------------------- matricula

create table if not exists matricula (
  aluno_id           uuid not null references aluno (id) on delete cascade,
  turma_id           uuid not null references turma (id) on delete cascade,
  matriculado_em     date not null default current_date,
  desmatriculado_em  date,

  -- matriculado_em entra na chave para permitir rematrícula do mesmo aluno
  -- na mesma turma após uma saída, sem perder o histórico do período anterior.
  primary key (aluno_id, turma_id, matriculado_em),

  constraint matricula_periodo_valido check (
    desmatriculado_em is null or desmatriculado_em >= matriculado_em
  )
);

-- Consulta mais frequente do sistema: alunos vigentes de uma turma,
-- executada no início de toda chamada.
create index if not exists matricula_turma_vigente_idx
  on matricula (turma_id) where desmatriculado_em is null;

-- ---------------------------------------------------------------- RLS

alter table aluno     enable row level security;
alter table turma     enable row level security;
alter table matricula enable row level security;

drop policy if exists aluno_acesso_autenticado on aluno;
create policy aluno_acesso_autenticado on aluno
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists turma_acesso_autenticado on turma;
create policy turma_acesso_autenticado on turma
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists matricula_acesso_autenticado on matricula;
create policy matricula_acesso_autenticado on matricula
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- REVERSÃO:
--   drop table if exists matricula;
--   drop table if exists turma;
--   drop table if exists aluno;
