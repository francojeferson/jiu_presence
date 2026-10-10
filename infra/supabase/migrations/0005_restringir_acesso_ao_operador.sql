-- Somente contas provisionadas manualmente em operador acessam dados.
-- O service_role continua podendo provisionar porque ignora RLS.

drop policy if exists operador_acesso_autenticado on operador;
drop policy if exists operador_le_proprio_perfil on operador;
create policy operador_le_proprio_perfil on operador
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists aluno_acesso_autenticado on aluno;
create policy aluno_acesso_autenticado on aluno
  for all to authenticated
  using (exists (
    select 1 from operador where operador.id = (select auth.uid())
  ))
  with check (exists (
    select 1 from operador where operador.id = (select auth.uid())
  ));

drop policy if exists turma_acesso_autenticado on turma;
create policy turma_acesso_autenticado on turma
  for all to authenticated
  using (exists (
    select 1 from operador where operador.id = (select auth.uid())
  ))
  with check (exists (
    select 1 from operador where operador.id = (select auth.uid())
  ));

drop policy if exists matricula_acesso_autenticado on matricula;
create policy matricula_acesso_autenticado on matricula
  for all to authenticated
  using (exists (
    select 1 from operador where operador.id = (select auth.uid())
  ))
  with check (exists (
    select 1 from operador where operador.id = (select auth.uid())
  ));

drop policy if exists chamada_acesso_autenticado on chamada;
create policy chamada_acesso_autenticado on chamada
  for all to authenticated
  using (exists (
    select 1 from operador where operador.id = (select auth.uid())
  ))
  with check (exists (
    select 1 from operador where operador.id = (select auth.uid())
  ));

drop policy if exists presenca_acesso_autenticado on presenca;
create policy presenca_acesso_autenticado on presenca
  for all to authenticated
  using (exists (
    select 1 from operador where operador.id = (select auth.uid())
  ))
  with check (exists (
    select 1 from operador where operador.id = (select auth.uid())
  ));
