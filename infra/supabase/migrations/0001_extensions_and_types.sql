-- 0001_extensions_and_types.sql
-- JiuPresence — extensões e tipos enumerados.
--
-- NOTA: este diretório é NOVO. O arquivo supabase/schema.sql, do projeto Flutter
-- legado, permanece intocado (RF-09, RF-37). Ele é conceitualmente substituído
-- por estas migrações, mas fisicamente preservado até que os critérios de
-- _reversa_sdd/sdd/descomissionamento-do-legado.md sejam atendidos.
--
-- A extensão pgvector NÃO é habilitada aqui (D-14). A dimensionalidade do
-- embedding é saída do spike de biometria; criar vector(128) agora, herdando
-- do schema legado, garantiria migração futura (risco R4 do PRD).

create extension if not exists pgcrypto;

-- Escala de graduação. A idade de corte entre as duas é 16 anos.
-- Premissa 2 do roadmap: a composição exata da escala infantil varia entre
-- federações e ainda não foi confirmada com o usuário.
do $$ begin
  create type faixa_escala as enum ('adulta', 'infantil');
exception when duplicate_object then null; end $$;

-- Como a chamada foi conduzida. 'foto' e 'mista' ainda não são produzidos
-- nesta feature (a chamada é manual), mas entram no enum desde já:
-- adicionar valor a enum é barato, e incluir agora deixa o modelo legível.
do $$ begin
  create type chamada_origem as enum ('manual', 'foto', 'mista');
exception when duplicate_object then null; end $$;

-- Como a presença individual foi definida. 'automatica' entra com a biometria.
do $$ begin
  create type presenca_origem as enum ('manual', 'automatica');
exception when duplicate_object then null; end $$;

-- REVERSÃO:
--   drop type if exists presenca_origem;
--   drop type if exists chamada_origem;
--   drop type if exists faixa_escala;
--   (pgcrypto é mantida: outras partes do Postgres podem depender dela)
