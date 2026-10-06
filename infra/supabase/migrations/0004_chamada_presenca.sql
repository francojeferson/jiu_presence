-- 0004_chamada_presenca.sql
-- JiuPresence — a aula e as presenças.
--
-- Esta é a mudança estrutural central em relação ao schema legado.
-- No Flutter, presenca referenciava o aluno diretamente, sem contexto de aula.
-- Isso torna impossível responder "quem faltou na turma das 19h hoje", que é a
-- pergunta operacional real do professor e a base da decisão de graduação.
--
-- As DUAS restrições de unicidade abaixo não são detalhe: são o que torna a
-- sincronização do outbox idempotente de fato (D-08). Validação apenas na
-- camada de aplicação não sobrevive a reenvio de fila.

-- ---------------------------------------------------------------- chamada

create table if not exists chamada (
  id               uuid           primary key,  -- UUID v7 do cliente, = chave de idempotência
  turma_id         uuid           not null references turma (id) on delete restrict,
  data             date           not null,
  realizada_em     timestamptz    not null,
  origem           chamada_origem not null default 'manual',
  total_detectado  integer,                     -- null nesta feature (sem biometria)
  confirmada       boolean        not null default false,
  criada_offline   boolean        not null default false,
  criado_em        timestamptz    not null default now(),

  -- RN-02 / RF-21. É a invariante que sustenta a idempotência.
  constraint chamada_unica_por_turma_e_data unique (turma_id, data)
);

comment on column chamada.data is
  'Data da AULA, nunca a data do envio (RN-06, RF-31). O dispositivo pode ficar '
  'dias offline; a chamada sincroniza depois mas pertence ao dia em que ocorreu.';

comment on constraint chamada_unica_por_turma_e_data on chamada is
  'Idempotência da fila de sincronização. Reenvio do mesmo item não duplica.';

-- on delete restrict: turma com chamadas não pode ser excluída, apenas
-- desativada (EC-04 de gestao-de-alunos-e-turmas).

create index if not exists chamada_data_idx     on chamada (data desc);
create index if not exists chamada_turma_idx    on chamada (turma_id);

-- ---------------------------------------------------------------- presenca

create table if not exists presenca (
  id             uuid            primary key,
  chamada_id     uuid            not null references chamada (id) on delete cascade,
  aluno_id       uuid            not null references aluno (id)   on delete restrict,
  origem         presenca_origem not null default 'manual',
  confianca      real,                         -- null quando manual
  registrada_em  timestamptz     not null default now(),

  -- RN-03 / RF-09 da spec de chamada: um aluno não pode ter duas presenças
  -- na mesma aula.
  constraint presenca_unica_por_chamada_e_aluno unique (chamada_id, aluno_id),

  -- Confiança só existe quando a presença veio do reconhecimento.
  constraint presenca_confianca_coerente_com_origem check (
    (origem = 'manual'     and confianca is null)
    or
    (origem = 'automatica' and confianca is not null and confianca between 0 and 1)
  )
);

-- on delete restrict em aluno_id implementa RF-15 no nível do banco:
-- aluno com histórico não pode ser excluído, apenas inativado. A regra é
-- aplicada no domínio e reforçada aqui, de modo que nem um erro de código nem
-- uma operação manual no painel consigam destruir histórico.
--
-- on delete cascade em chamada_id: presença não existe fora de uma chamada.
-- É a invariante do agregado.

create index if not exists presenca_aluno_idx   on presenca (aluno_id);
create index if not exists presenca_chamada_idx on presenca (chamada_id);

-- ---------------------------------------------------------------- RLS

alter table chamada  enable row level security;
alter table presenca enable row level security;

drop policy if exists chamada_acesso_autenticado on chamada;
create policy chamada_acesso_autenticado on chamada
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists presenca_acesso_autenticado on presenca;
create policy presenca_acesso_autenticado on presenca
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- REVERSÃO:
--   drop table if exists presenca;
--   drop table if exists chamada;
