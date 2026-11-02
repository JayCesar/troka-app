-- B8 — histórico (RN25, RN26, RN27). Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create function pg_temp.u(x text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || x)::uuid $$;
create function pg_temp.como(x text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(x), 'role', 'authenticated')::text, true) $$;
create function pg_temp.d(h int) returns timestamptz language sql as $$ select date_trunc('hour', now()) + interval '2 days' + make_interval(hours => h) $$;
create function pg_temp.clinico() returns uuid language sql as $$ select id from public.especialidade where nome = 'Clínico' $$;

insert into public.hospital (id, nome) values ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A');
insert into public.setor (id, hospital_id, nome) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'A2');
insert into auth.users (id, email) select pg_temp.u(x), x || '@t' from unnest(array['a0', 'c0', 'b1', 'b2']) x;
insert into public.perfil (id, hospital_id, setor_id, papel, nome) values
  (pg_temp.u('a0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'Gestora A1'),
  (pg_temp.u('c0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'gestor', 'Gestor A2');
insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
select pg_temp.u(x), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', upper(x), 'medico',
       pg_temp.clinico(), '1', 'SP'
from unnest(array['b1', 'b2']) x;

create function pg_temp.h(e text, op text) returns bigint language sql as $$
  select count(*) from public.historico where setor_id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and entidade = e and acao = op $$;

select is(pg_temp.h('perfil', 'insert'), 3::bigint, 'RN25: cadastro de perfis registrado');

-- Fluxo completo pelo app
set local role authenticated;
select pg_temp.como('a0');
create temp table t as select id from public.criar_plantao(pg_temp.clinico(), pg_temp.d(0), pg_temp.d(12), pg_temp.u('b1'));
grant select on t to authenticated;
select pg_temp.como('b1');
select public.anunciar((select id from t), 'urgente', 'saude', 'segredo');
select pg_temp.como('b2');
select public.assumir_anuncio((select id from public.anuncio limit 1));
select pg_temp.como('a0');
select public.aprovar_troca((select id from public.anuncio limit 1));
reset role;

select is(pg_temp.h('plantao', 'insert'), 1::bigint, 'RN25: criação de plantão');
select is(pg_temp.h('anuncio', 'insert'), 1::bigint, 'RN25: anúncio publicado');
select is(pg_temp.h('anuncio_motivo', 'insert'), 1::bigint, 'RN25: motivo registrado');
select is(pg_temp.h('anuncio', 'update'), 2::bigint, 'RN25: anúncio aberto→pendente→aprovado');
select is(pg_temp.h('plantao', 'update'), 1::bigint, 'RN25: troca de dono');
select is((select ator_id from public.historico where entidade = 'anuncio' and acao = 'insert' and setor_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), pg_temp.u('b1'), 'RN25: registra quem fez');
select ok(exists (select 1 from public.historico where resumo = 'Plantão mudou de dono: B1 → B2'), 'resumo legível da troca');

-- RN26: imutável para qualquer papel (aqui como superusuário)
select throws_ok($$ update public.historico set resumo = 'x' $$, 'TK423', null, 'RN26: UPDATE bloqueado até para o superusuário');
select throws_ok($$ delete from public.historico $$, 'TK423', null, 'RN26: DELETE bloqueado até para o superusuário');
select throws_ok($$ truncate public.historico $$, 'TK423', null, 'RN26: TRUNCATE bloqueado');

set local role authenticated;
select pg_temp.como('a0');
select throws_ok($$ insert into public.historico (hospital_id, setor_id, entidade, acao, resumo)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'x', 'insert', 'forjado') $$,
  '42501', null, 'RN26: nem o gestor escreve no histórico');

-- Visibilidade (P3) e RN27
select ok((select count(*) from public.historico) >= 8, 'gestor do setor lê o histórico');
select ok((select count(*) from public.historico_do_setor(null)) >= 8, 'RN27: histórico completo disponível para exportar');
select pg_temp.como('b1');
select is((select count(*) from public.historico), 0::bigint, 'P3/RN29: profissional não lê o histórico (contém motivos)');
select pg_temp.como('c0');
select is((select count(*) from public.historico where setor_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 0::bigint, 'RN03: gestor de outro setor não vê o histórico de A1');

reset role;
select * from finish();
rollback;
