-- B2 — plantões (RN04, RN05, RN06) e validação de atribuição (RN12, RN13, RN14). Tudo desfeito no rollback.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Fixtures: hospital A com setores A1 e A2
insert into public.hospital (id, nome) values ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A');
insert into public.setor (id, hospital_id, nome) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'A2');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a1a1', 'gA1@t'), ('00000000-0000-0000-0000-00000000a2a2', 'gA2@t'),
  ('00000000-0000-0000-0000-0000000000a1', 'pA1@t'), ('00000000-0000-0000-0000-0000000000e1', 'eA1@t'),
  ('00000000-0000-0000-0000-0000000000a2', 'pA2@t');
insert into public.perfil (id, hospital_id, setor_id, papel, nome) values
  ('00000000-0000-0000-0000-00000000a1a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'gA1'),
  ('00000000-0000-0000-0000-00000000a2a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'gestor', 'gA2');
insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
select v.id, 'aaaaaaaa-0000-0000-0000-000000000000', v.setor, 'profissional', 'T', v.cat::public.categoria_profissional,
       (select id from public.especialidade where nome = v.esp), '1', 'SP'
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'medico', 'Clínico'),
  ('00000000-0000-0000-0000-0000000000e1'::uuid, 'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'enfermeiro', 'Enfermagem Clínica'),
  ('00000000-0000-0000-0000-0000000000a2'::uuid, 'aaaaaaaa-0000-0000-0000-0000000000a2'::uuid, 'medico', 'Clínico')
) as v(id, setor, cat, esp);

-- Atalhos
create function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
create function pg_temp.clinico() returns uuid language sql as $$ select id from public.especialidade where nome = 'Clínico' $$;
create function pg_temp.d(h int) returns timestamptz language sql as $$ select date_trunc('hour', now()) + interval '2 days' + make_interval(hours => h) $$;

set local role authenticated;

-- ---------- RN05: só gestor do setor ----------
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.criar_plantao(pg_temp.clinico(), pg_temp.d(0), pg_temp.d(12)) $$,
  'TK403', null, 'RN05: profissional não cria plantão');
select throws_ok($$ insert into public.plantao (hospital_id, setor_id, especialidade_id, inicio, fim, criado_por)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', pg_temp.clinico(), now(), now() + interval '1h', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'RN05: INSERT direto na tabela é bloqueado');

select pg_temp.como('00000000-0000-0000-0000-00000000a1a1');

-- ---------- RN04 / RN06 ----------
select throws_ok($$ select public.criar_plantao(pg_temp.clinico(), pg_temp.d(12), pg_temp.d(12)) $$,
  'TK422', 'RN04: o fim do plantão deve ser depois do início.', 'RN04: fim = início falha');
select throws_ok($$ select public.criar_plantao(pg_temp.clinico(), pg_temp.d(12), pg_temp.d(0)) $$,
  'TK422', 'RN04: o fim do plantão deve ser depois do início.', 'RN04: fim antes do início falha');

create temp table t (nome text primary key, id uuid);
grant all on t to authenticated;
insert into t select 'aberto', id from public.criar_plantao(pg_temp.clinico(), pg_temp.d(0), pg_temp.d(12));
select is((select status from public.plantao where id = (select id from t where nome = 'aberto')), 'aberto', 'RN06: sem profissional = aberto');
select is((select setor_id from public.plantao where id = (select id from t where nome = 'aberto')),
  'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'RN05: setor vem do perfil do gestor');

-- ---------- Atribuição (RN12, RN13, RN14) ----------
select throws_like($$ select public.criar_plantao(pg_temp.clinico(), pg_temp.d(24), pg_temp.d(36), '00000000-0000-0000-0000-0000000000a2') $$,
  'RN12%', 'RN12: não atribui profissional de outro setor');
select throws_like($$ select public.criar_plantao(pg_temp.clinico(), pg_temp.d(24), pg_temp.d(36), '00000000-0000-0000-0000-0000000000e1') $$,
  'RN13%', 'RN13/RN12b: não atribui especialidade/categoria diferente');

insert into t select 'atribuido', id from public.criar_plantao(pg_temp.clinico(), pg_temp.d(24), pg_temp.d(36), '00000000-0000-0000-0000-0000000000a1');
select is((select status from public.plantao where id = (select id from t where nome = 'atribuido')), 'atribuido', 'RN06: com profissional = atribuído');

select throws_like($$ select public.criar_plantao(pg_temp.clinico(), pg_temp.d(30), pg_temp.d(42), '00000000-0000-0000-0000-0000000000a1') $$,
  'RN14: sobrepõe%', 'RN14: sobreposição bloqueada');
select throws_like($$ select public.criar_plantao(pg_temp.clinico(), pg_temp.d(41), pg_temp.d(53), '00000000-0000-0000-0000-0000000000a1') $$,
  'RN14: descanso%', 'RN14: descanso de 5h bloqueado');
select lives_ok($$ select public.criar_plantao(pg_temp.clinico(), pg_temp.d(47), pg_temp.d(59), '00000000-0000-0000-0000-0000000000a1') $$,
  'RN14: descanso de exatamente 11h permitido');

-- ---------- Editar / remover ----------
select lives_ok($$ select public.editar_plantao((select id from t where nome = 'aberto'), pg_temp.clinico(), pg_temp.d(1), pg_temp.d(13), null) $$,
  'gestor edita plantão futuro do setor');
select is((select inicio from public.plantao where id = (select id from t where nome = 'aberto')), pg_temp.d(1), 'edição gravada');
select throws_like($$ select public.editar_plantao((select id from t where nome = 'atribuido'), pg_temp.clinico(), pg_temp.d(40), pg_temp.d(52), '00000000-0000-0000-0000-0000000000a1') $$,
  'RN14%', 'RN14: edição que cria conflito é bloqueada (P4)');

-- plantão já iniciado (inserido direto como superusuário)
reset role;
with x as (
  insert into public.plantao (hospital_id, setor_id, especialidade_id, inicio, fim, criado_por)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', pg_temp.clinico(), now() - interval '1h', now() + interval '11h', '00000000-0000-0000-0000-00000000a1a1')
  returning id)
insert into t select 'iniciado', id from x;
set local role authenticated;
select throws_ok($$ select public.remover_plantao((select id from t where nome = 'iniciado')) $$,
  'TK422', 'Plantão já iniciado não pode ser alterado.', 'P3: plantão iniciado não pode ser removido');

-- gestor de outro setor
select pg_temp.como('00000000-0000-0000-0000-00000000a2a2');
select throws_ok($$ select public.remover_plantao((select id from t where nome = 'aberto')) $$,
  'TK404', null, 'RN05: gestor de outro setor não remove');
select is((select count(*) from public.plantao where setor_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 0::bigint,
  'RN03: gestor de A2 não vê plantões de A1');

select pg_temp.como('00000000-0000-0000-0000-00000000a1a1');
select lives_ok($$ select public.remover_plantao((select id from t where nome = 'aberto')) $$, 'gestor remove plantão futuro do setor');
select is((select count(*) from public.plantao where id = (select id from t where nome = 'aberto')), 0::bigint, 'remoção efetivada');

reset role;
select * from finish();
rollback;
