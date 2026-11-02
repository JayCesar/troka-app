-- B6 — adicional (RN17, RN17b, RN18). Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create function pg_temp.u(x text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || x)::uuid $$;
create function pg_temp.como(x text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(x), 'role', 'authenticated')::text, true) $$;
create function pg_temp.d(h int) returns timestamptz language sql as $$ select date_trunc('hour', now()) + interval '2 days' + make_interval(hours => h) $$;

insert into public.hospital (id, nome) values ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A');
insert into public.setor (id, hospital_id, nome) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'A2');
insert into auth.users (id, email) select pg_temp.u(x), x || '@t' from unnest(array['a0', 'c0', 'b1', 'b2']) x;
insert into public.perfil (id, hospital_id, setor_id, papel, nome) values
  (pg_temp.u('a0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'GA1'),
  (pg_temp.u('c0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'gestor', 'GA2');
insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
select pg_temp.u(x), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', upper(x), 'medico',
       (select id from public.especialidade where nome = 'Clínico'), left(gen_random_uuid()::text, 8), 'SP'
from unnest(array['b1', 'b2']) x;
insert into public.plantao (hospital_id, setor_id, especialidade_id, inicio, fim, profissional_id, criado_por)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', (select id from public.especialidade where nome = 'Clínico'),
        pg_temp.d(0), pg_temp.d(12), pg_temp.u('b1'), pg_temp.u('a0'));
create function pg_temp.an() returns uuid language sql as $$ select id from public.anuncio limit 1 $$;

set local role authenticated;
select pg_temp.como('b1');
select public.anunciar((select id from public.plantao where profissional_id = pg_temp.u('b1')), 'normal');

-- RN17: só gestor do setor
select throws_ok($$ select public.definir_adicional(pg_temp.an(), 100) $$, 'TK403', null, 'RN17: profissional não oferece adicional');
select pg_temp.como('c0');
select throws_ok($$ select public.definir_adicional(pg_temp.an(), 100) $$, 'TK404', null, 'RN17: gestor de outro setor não oferece');

-- RN17b
select pg_temp.como('a0');
select throws_like($$ select public.definir_adicional(pg_temp.an(), 0) $$, 'RN17b%', 'RN17b: valor deve ser > 0');
select throws_like($$ select public.definir_adicional(pg_temp.an(), -10) $$, 'RN17b%', 'RN17b: valor negativo falha');
select is((select adicional_valor from public.definir_adicional(pg_temp.an(), 150.555)), 150.56::numeric, 'RN17b: valor fixo em reais (2 casas)');
select is((select adicional_valor from public.definir_adicional(pg_temp.an(), null)), null::numeric, 'RN17b: opcional — pode remover');
select is((select adicional_valor from public.definir_adicional(pg_temp.an(), 200)), 200::numeric, 'gestor redefine enquanto aberto');
reset role;
select is((select count(*) from public.aviso where perfil_id = pg_temp.u('b2') and texto like 'Adicional%'), 2::bigint, 'P4: elegível avisado do adicional');
set local role authenticated;

-- RN18: visível antes de assumir
select pg_temp.como('b2');
select is((select adicional from public.ofertas_para_mim() where tipo = 'anuncio'), 200::numeric, 'RN18: adicional aparece antes de assumir');
select public.assumir_anuncio(pg_temp.an());

-- P1: congela depois de assumido
select pg_temp.como('a0');
select throws_like($$ select public.definir_adicional(pg_temp.an(), 300) $$, 'RN17:%', 'P1: adicional congela após assumido');
select is((select adicional from public.pendencias_do_setor()), 200::numeric, 'RN18: gestor vê o adicional na decisão');

-- RN18: permanece registrado após a conclusão
select public.aprovar_troca(pg_temp.an());
select is((select adicional_valor from public.anuncio where id = pg_temp.an()), 200::numeric, 'RN18: adicional fica registrado após aprovação');

reset role;
select * from finish();
rollback;
