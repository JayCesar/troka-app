-- B7 — cancelamento, expiração e alertas (RN22, RN23, RN24). Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

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
  (pg_temp.u('a0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'GA1'),
  (pg_temp.u('c0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'gestor', 'GA2');
insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
select pg_temp.u(x), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', upper(x), 'medico',
       pg_temp.clinico(), left(gen_random_uuid()::text, 8), 'SP'
from unnest(array['b1', 'b2']) x;

create temp table t (nome text primary key, id uuid);
grant all on t to authenticated;
do $$
declare r record; v_id uuid;
begin
  for r in select * from (values ('P1', 0), ('P2', 24), ('P4', 48), ('P5', 72), ('P6', 96)) v(nome, ini) loop
    insert into public.plantao (hospital_id, setor_id, especialidade_id, inicio, fim, profissional_id, criado_por)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', pg_temp.clinico(),
            pg_temp.d(r.ini), pg_temp.d(r.ini + 12), pg_temp.u('b1'), pg_temp.u('a0'))
    returning id into v_id;
    insert into t values (r.nome, v_id);
  end loop;
end $$;
create function pg_temp.p(n text) returns uuid language sql as $$ select id from t where nome = n $$;
-- now() é constante na transação: o ativo vem primeiro para desempatar com o cancelado
create function pg_temp.an(n text) returns uuid language sql as $$ select id from public.anuncio where plantao_id = pg_temp.p(n) order by status in ('aberto', 'pendente') desc, criado_em desc limit 1 $$;
create function pg_temp.st(n text) returns text language sql as $$ select status::text from public.anuncio where id = pg_temp.an(n) $$;

set local role authenticated;

-- ---------- RN22: cancelamento ----------
select pg_temp.como('b1');
select public.anunciar(pg_temp.p('P1'), 'normal');
select pg_temp.como('b2');
select throws_ok($$ select public.cancelar_anuncio(pg_temp.an('P1')) $$, 'TK403', null, 'RN22: só quem anunciou cancela');
select pg_temp.como('b1');
select is((select status::text from public.cancelar_anuncio(pg_temp.an('P1'))), 'cancelado', 'RN22: anunciante cancela anúncio aberto');
select lives_ok($$ select public.anunciar(pg_temp.p('P1'), 'urgente') $$, 'RN08: cancelado não bloqueia novo anúncio');

select pg_temp.como('b2');
select public.assumir_anuncio(pg_temp.an('P1'));
select pg_temp.como('b1');
select is((select status::text from public.cancelar_anuncio(pg_temp.an('P1'))), 'cancelado', 'RN22/P1: cancela também quando pendente');
reset role;
select ok(exists (select 1 from public.aviso where perfil_id = pg_temp.u('b2') and texto like 'Anúncio cancelado%'), 'P1: assumidor é avisado do cancelamento');
set local role authenticated;

-- RN20b: aprovado não cancela
select pg_temp.como('b1');
select public.anunciar(pg_temp.p('P2'), 'normal');
select pg_temp.como('b2');
select public.assumir_anuncio(pg_temp.an('P2'));
select pg_temp.como('a0');
select public.aprovar_troca(pg_temp.an('P2'));
select pg_temp.como('b1');
select throws_like($$ select public.cancelar_anuncio(pg_temp.an('P2')) $$, 'RN22/RN20b%', 'RN20b: não cancela após aprovação');

-- ---------- RN23 + RN24: expiração e alerta ----------
select public.anunciar(pg_temp.p('P4'), 'normal');
reset role;
update public.anuncio set expira_em = now() - interval '1 minute' where id = pg_temp.an('P4');
select is(app.expirar_vencidos(), 1, 'RN23: job expira 1 anúncio vencido');
select is(pg_temp.st('P4'), 'expirado', 'RN23: anúncio vencido vira expirado');
select is((select count(*) from public.alerta where anuncio_id = pg_temp.an('P4') and resolvido_em is null), 1::bigint, 'RN24: expirado gera alerta de plantão em risco');
select ok(exists (select 1 from public.aviso where perfil_id = pg_temp.u('a0') and texto like 'Plantão em risco%'), 'RN24: gestão é avisada');
select is(app.expirar_vencidos(), 0, 'job é idempotente');

set local role authenticated;
select pg_temp.como('a0');
select is((select count(*) from public.alerta), 1::bigint, 'P5: gestor do setor vê o alerta');
select pg_temp.como('b1');
select is((select count(*) from public.alerta), 0::bigint, 'P5: profissional não vê alertas');
select pg_temp.como('c0');
select is((select count(*) from public.alerta), 0::bigint, 'P5: gestor de outro setor não vê');
select throws_ok($$ select public.resolver_alerta((select id from public.alerta limit 1)) $$, 'TK404', null, 'outro setor não resolve');
reset role;
create temp table al as select id from public.alerta where anuncio_id = pg_temp.an('P4');
grant select on al to authenticated;
set local role authenticated;
select pg_temp.como('a0');
select is((select resolvido_por from public.resolver_alerta((select id from al))), pg_temp.u('a0'), 'gestor resolve o alerta');

-- P4: troca de dono resolve sozinho
select pg_temp.como('b1');
select public.anunciar(pg_temp.p('P5'), 'normal');
reset role;
update public.anuncio set expira_em = now() - interval '1 minute' where id = pg_temp.an('P5');
select app.expirar_vencidos();
set local role authenticated;
select pg_temp.como('a0');
select public.editar_plantao(pg_temp.p('P5'), pg_temp.clinico(), pg_temp.d(72), pg_temp.d(84), pg_temp.u('b2'));
reset role;
select ok((select resolvido_em is not null and resolvido_por is null from public.alerta where anuncio_id = pg_temp.an('P5')),
  'P4: alerta resolvido automaticamente quando o plantão muda de dono');

-- P2: pendente sem decisão até o início expira
set local role authenticated;
select pg_temp.como('b1');
select public.anunciar(pg_temp.p('P6'), 'normal');
select pg_temp.como('b2');
select public.assumir_anuncio(pg_temp.an('P6'));
reset role;
update public.plantao set inicio = now() - interval '1 hour', fim = now() + interval '11 hours' where id = pg_temp.p('P6');
select app.expirar_vencidos();
select is(pg_temp.st('P6'), 'expirado', 'P2: pendente sem decisão até o início expira');

select is((select count(*) from cron.job where jobname = 'troka-expirar-vencidos' and schedule = '* * * * *'), 1::bigint,
  'RN23: job pg_cron agendado a cada minuto');

select * from finish();
rollback;
