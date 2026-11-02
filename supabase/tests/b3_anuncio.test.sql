-- B3 — anúncio (RN07, RN08, RN09, RN09b, RN09c, RN10, RN29) + bloqueio de edição de plantão anunciado. Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Fixtures: hospital A, setores A1 e A2
insert into public.hospital (id, nome) values ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A');
insert into public.setor (id, hospital_id, nome) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'A2');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a1a1', 'gA1@t'), ('00000000-0000-0000-0000-00000000a2a2', 'gA2@t'),
  ('00000000-0000-0000-0000-0000000000a1', 'p1@t'), ('00000000-0000-0000-0000-0000000000a3', 'p2@t');
insert into public.perfil (id, hospital_id, setor_id, papel, nome) values
  ('00000000-0000-0000-0000-00000000a1a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'gA1'),
  ('00000000-0000-0000-0000-00000000a2a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'gestor', 'gA2');
insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
select v.id, 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', 'T', 'medico',
       (select id from public.especialidade where nome = 'Clínico'), '1', 'SP'
from (values ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000a3'::uuid)) v(id);

-- Plantões de p1: futuro (2 dias), iniciado, começa em 5h, futuro (5 dias)
create temp table t (nome text primary key, id uuid);
grant all on t to authenticated;
with x as (
  insert into public.plantao (hospital_id, setor_id, especialidade_id, inicio, fim, profissional_id, criado_por)
  select 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', (select id from public.especialidade where nome = 'Clínico'),
         now() + v.ini, now() + v.ini + interval '12 hours', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000a1a1'
  from (values (interval '2 days'), (interval '-30 hours'), (interval '5 hours'), (interval '5 days')) v(ini)
  returning id, inicio)
insert into t select case
  when inicio = now() + interval '2 days' then 'futuro'
  when inicio = now() - interval '30 hours' then 'iniciado'
  when inicio = now() + interval '5 hours' then 'em5h'
  else 'futuro5d' end, id from x;

create function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
create function pg_temp.p(n text) returns uuid language sql as $$ select id from t where nome = n $$;

set local role authenticated;

-- ---------- RN07 ----------
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select public.anunciar(pg_temp.p('futuro'), 'normal') $$, 'TK403', null, 'RN07: outro profissional não anuncia');
select pg_temp.como('00000000-0000-0000-0000-00000000a1a1');
select throws_ok($$ select public.anunciar(pg_temp.p('futuro'), 'normal') $$, 'TK403', null, 'RN07: gestor não anuncia plantão alheio');

select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.anunciar(pg_temp.p('iniciado'), 'normal') $$, 'TK422',
  'RN07: plantão já iniciado não pode ser anunciado.', 'RN07: plantão iniciado não é anunciado');

-- ---------- RN09 / RN09b ----------
select throws_like($$ select public.anunciar(pg_temp.p('futuro'), null) $$, 'RN09:%', 'RN09: urgência obrigatória');
select throws_like($$ select public.anunciar(pg_temp.p('futuro'), 'normal', null, 'sem categoria') $$, 'RN09b: informe%', 'RN09b: texto sem categoria falha');
select throws_like($$ select public.anunciar(pg_temp.p('futuro'), 'normal', 'outro', repeat('x', 501)) $$, 'RN09b: o texto%', 'RN09b: texto acima de 500 falha');
select throws_ok($$ insert into public.anuncio (plantao_id, anunciante_id, urgencia, expira_em)
  values (pg_temp.p('futuro'), '00000000-0000-0000-0000-0000000000a1', 'normal', now()) $$, '42501', null, 'INSERT direto bloqueado');

-- ---------- Sucesso + RN10 (normal = 48h) ----------
select lives_ok($$ select public.anunciar(pg_temp.p('futuro'), 'normal', 'saude', 'Exame') $$, 'dono anuncia plantão futuro');
select is((select expira_em from public.anuncio where plantao_id = pg_temp.p('futuro')), now() + interval '48 hours',
  'RN10: normal expira em 48h (plantão em 2 dias = 48h)');
select is((select status::text from public.anuncio where plantao_id = pg_temp.p('futuro')), 'aberto', 'nasce aberto');

-- ---------- RN08 ----------
select throws_like($$ select public.anunciar(pg_temp.p('futuro'), 'urgente') $$, 'RN08:%', 'RN08: segundo anúncio em aberto falha');

-- ---------- RN10: urgente = 24h; corte no início ----------
select lives_ok($$ select public.anunciar(pg_temp.p('futuro5d'), 'urgente') $$, 'anuncia urgente');
select is((select expira_em from public.anuncio where plantao_id = pg_temp.p('futuro5d')), now() + interval '24 hours', 'RN10: urgente expira em 24h');
select lives_ok($$ select public.anunciar(pg_temp.p('em5h'), 'normal') $$, 'anuncia plantão que começa em 5h (P5)');
select is((select expira_em from public.anuncio where plantao_id = pg_temp.p('em5h')), now() + interval '5 hours', 'RN10: prazo cortado no início do plantão');

-- ---------- RN29 ----------
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
select is((select count(*) from public.anuncio where plantao_id = pg_temp.p('futuro')), 1::bigint, 'colega do setor vê o anúncio');
select is((select count(*) from public.anuncio_motivo), 0::bigint, 'RN29: colega não vê o motivo');
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select is((select texto from public.anuncio_motivo), 'Exame', 'RN29/P4: anunciante vê o próprio motivo');
select pg_temp.como('00000000-0000-0000-0000-00000000a1a1');
select is((select categoria::text from public.anuncio_motivo), 'saude', 'RN29: gestor do setor vê o motivo');

-- ---------- Plantão anunciado não é alterado pelo gestor ----------
select throws_ok($$ select public.remover_plantao(pg_temp.p('futuro')) $$, 'TK422',
  'Plantão com anúncio em aberto não pode ser alterado.', 'B2/P3: gestor não remove plantão anunciado');

select pg_temp.como('00000000-0000-0000-0000-00000000a2a2');
select is((select count(*) from public.anuncio), 0::bigint, 'RN03: gestor de outro setor não vê anúncios');

-- ---------- Expiração preguiçosa libera novo anúncio ----------
reset role;
update public.anuncio set expira_em = now() - interval '1 minute' where plantao_id = pg_temp.p('em5h');
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.anunciar(pg_temp.p('em5h'), 'urgente') $$, 'anúncio vencido não bloqueia novo anúncio (RN08 + RN23)');

reset role;
select * from finish();
rollback;
