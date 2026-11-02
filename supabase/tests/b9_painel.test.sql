-- B9 — painel de gestão (RN28). Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

create function pg_temp.u(x text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || x)::uuid $$;
create function pg_temp.como(x text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(x), 'role', 'authenticated')::text, true) $$;
create function pg_temp.clinico() returns uuid language sql as $$ select id from public.especialidade where nome = 'Clínico' $$;

insert into public.hospital (id, nome) values ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A');
insert into public.setor (id, hospital_id, nome) values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1');
insert into auth.users (id, email) select pg_temp.u(x), x || '@t' from unnest(array['a0', 'b1', 'b2', 'b3']) x;
insert into public.perfil (id, hospital_id, setor_id, papel, nome)
values (pg_temp.u('a0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'G');
insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
select pg_temp.u(x), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', upper(x), 'medico', pg_temp.clinico(), left(gen_random_uuid()::text, 8), 'SP'
from unnest(array['b1', 'b2', 'b3']) x;

-- 2 plantões abertos futuros + 1 aberto passado (não conta); b1: plantão em 4h (anúncio vence em <6h) e em 3 dias (urgente)
insert into public.plantao (hospital_id, setor_id, especialidade_id, inicio, fim, profissional_id, criado_por)
select 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', pg_temp.clinico(), now() + v.ini, now() + v.ini + interval '12 hours', v.prof, pg_temp.u('a0')
from (values (interval '5 days', null::uuid), (interval '6 days', null), (interval '-30 hours', null),
             (interval '4 hours', pg_temp.u('b1')), (interval '3 days', pg_temp.u('b1')), (interval '8 days', pg_temp.u('b1'))) v(ini, prof);

set local role authenticated;
select pg_temp.como('b1');
select public.anunciar((select id from public.plantao where profissional_id = pg_temp.u('b1') and inicio < now() + interval '5 hours'), 'normal');  -- vence no início (4h)
select public.anunciar((select id from public.plantao where profissional_id = pg_temp.u('b1') and inicio between now() + interval '2 days' and now() + interval '4 days'), 'urgente');
select public.anunciar((select id from public.plantao where profissional_id = pg_temp.u('b1') and inicio > now() + interval '7 days'), 'normal');
select pg_temp.como('b2');
select public.candidatar((select id from public.plantao where profissional_id is null and inicio between now() + interval '4 days' and now() + interval '5 days 1 hour'));
reset role;
update public.anuncio set expira_em = now() - interval '1 minute'
 where plantao_id = (select id from public.plantao where profissional_id = pg_temp.u('b1') and inicio > now() + interval '7 days');
select app.expirar_vencidos();   -- gera 1 alerta (RN24)

set local role authenticated;
select pg_temp.como('a0');
select is((select em_aberto from public.painel_do_setor()), 2, 'RN28: plantões em aberto (futuros, sem dono)');
select is((select urgentes from public.painel_do_setor()), 1, 'RN28: anúncios urgentes');
select is((select a_vencer from public.painel_do_setor()), 1, 'RN28: anúncios a vencer em até 6h');
select is((select alertas from public.painel_do_setor()), 1, 'RN28: alertas abertos');
select is((select pendencias from public.painel_do_setor()), 1, 'pendências (candidatura)');
select pg_temp.como('b1');
select throws_ok($$ select * from public.painel_do_setor() $$, 'TK403', null, 'painel é só da gestão');
reset role;
select * from finish();
rollback;
