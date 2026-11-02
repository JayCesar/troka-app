-- B1 — isolamento e integridade (RN01, RN02, RN03, RN30). Fixtures próprias; tudo é desfeito no rollback.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Fixtures: hospital A (setores A1, A2) e hospital B (setor B1)
insert into public.hospital (id, nome) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'T Hospital B');
insert into public.setor (id, hospital_id, nome) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'A2'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'B1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@t'), ('00000000-0000-0000-0000-0000000000a9', 'a1gestor@t'),
  ('00000000-0000-0000-0000-0000000000a2', 'a2@t'), ('00000000-0000-0000-0000-0000000000b1', 'b1@t'),
  ('00000000-0000-0000-0000-0000000000ff', 'invalido@t');

create function pg_temp.prof(p_id uuid, p_setor uuid) returns void language sql as $$
  insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
  select p_id, s.hospital_id, s.id, 'profissional', 'T', 'medico',
         (select id from public.especialidade where nome = 'Clínico' and categoria = 'medico'), '1', 'SP'
  from public.setor s where s.id = p_setor $$;
select pg_temp.prof('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1');
select pg_temp.prof('00000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a2');
select pg_temp.prof('00000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000b1');
insert into public.perfil (id, hospital_id, setor_id, papel, nome) values
  ('00000000-0000-0000-0000-0000000000a9', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'T gestor');

-- ---------- Integridade (RN01, RN02, decisão B1/P2) ----------
select throws_ok(
  $$ insert into public.perfil (id, hospital_id, setor_id, papel, nome)
     values ('00000000-0000-0000-0000-0000000000ff', 'aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'gestor', 'x') $$,
  '23503', null, 'RN01: setor precisa ser do hospital do perfil');

select throws_ok(
  $$ insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria)
     values ('00000000-0000-0000-0000-0000000000ff', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'x', 'medico') $$,
  '23514', null, 'P2: gestor não tem categoria');

select throws_ok(
  $$ insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id)
     values ('00000000-0000-0000-0000-0000000000ff', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', 'x', 'medico',
             (select id from public.especialidade where nome = 'Clínico')) $$,
  '23514', null, 'RN01: profissional exige conselho e UF');

select throws_ok(
  $$ insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
     values ('00000000-0000-0000-0000-0000000000ff', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', 'x', 'enfermeiro',
             (select id from public.especialidade where nome = 'Clínico'), '1', 'SP') $$,
  '23503', null, 'RN01: especialidade precisa ser da categoria do profissional');

-- ---------- Anônimo não vê nada ----------
set local role anon;
select throws_ok('select * from public.perfil', '42501', null, 'anon não lê perfil');
select throws_ok('select * from public.hospital', '42501', null, 'anon não lê hospital');
reset role;

-- ---------- Profissional do setor A1 ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select results_eq('select id from public.hospital',
  $$ values ('aaaaaaaa-0000-0000-0000-000000000000'::uuid) $$, 'RN30: vê só o próprio hospital');
select results_eq('select id from public.setor',
  $$ values ('aaaaaaaa-0000-0000-0000-0000000000a1'::uuid) $$, 'RN03: vê só o próprio setor');
select results_eq('select id from public.perfil order by id',
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000a9'::uuid) $$,
  'RN03: vê só perfis do mesmo setor (não vê A2 nem B1)');
select isnt_empty('select 1 from public.especialidade', 'catálogo de especialidades visível');

select throws_ok($$ update public.perfil set papel = 'gestor' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'RN02: profissional não altera o próprio papel');
select throws_ok($$ insert into public.hospital (nome) values ('x') $$, '42501', null, 'não cria hospital via API');
select throws_ok($$ delete from public.perfil $$, '42501', null, 'não apaga perfis via API');

-- ---------- Profissional do hospital B ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*) from public.perfil where hospital_id = 'aaaaaaaa-0000-0000-0000-000000000000'), 0::bigint,
  'RN30: hospital B não vê perfis do hospital A');
select is((select count(*) from public.hospital where id = 'aaaaaaaa-0000-0000-0000-000000000000'), 0::bigint,
  'RN30: hospital B não vê o hospital A');

-- ---------- Usuário sem perfil ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}', true);
select is_empty('select 1 from public.perfil', 'usuário sem perfil não vê nada');
reset role;

select * from finish();
rollback;
