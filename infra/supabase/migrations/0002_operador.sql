-- 0002_operador.sql
-- JiuPresence — o operador único (o professor).
--
-- Não há cadastro aberto nem multi-tenant. A tabela academia do schema legado,
-- que existia para licenciamento por academia (data_expira), não tem
-- equivalente: o produto é ferramenta interna de um operador.

create table if not exists operador (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text        not null,
  nome       text        not null,
  criado_em  timestamptz not null default now()
);

comment on table operador is
  'O professor. Espelha auth.users. Provisionado manualmente, sem cadastro aberto.';

-- RLS desde a PRIMEIRA migração (D-10, RF-08).
-- Habilitar RLS em banco já populado é fonte conhecida de vazamento, e o custo
-- de fazer agora é próximo de zero. Ausência de política para o papel `anon`
-- é negação: sem sessão autenticada, zero linhas em qualquer tabela.
alter table operador enable row level security;

drop policy if exists operador_acesso_autenticado on operador;
create policy operador_acesso_autenticado on operador
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- REVERSÃO:
--   drop policy if exists operador_acesso_autenticado on operador;
--   drop table if exists operador;
