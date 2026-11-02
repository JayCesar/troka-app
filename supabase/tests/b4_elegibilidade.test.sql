-- B4 — elegibilidade, candidatura, assumir/desistir (RN06c, RN11, RN12–RN15, RN22b). Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Ids: a0 gestor A1 · b1 anunciante · b2/b5 livres · b3 ocupado · e4 enfermeiro · c2 outro setor
create function pg_temp.u(x text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || x)::uuid $$;
create function pg_temp.como(x text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(x), 'role', 'authenticated')::text, true) $$;
create function pg_temp.d(h int) returns timestamptz language sql as $$ select date_trunc('hour', now()) + interval '2 days' + make_interval(hours => h) $$;

insert into public.hospital (id, nome) values ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A');
insert into public.setor (id, hospital_id, nome) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'A2');
insert into auth.users (id, email) select pg_temp.u(x), x || '@t' from unnest(array['a0', 'b1', 'b2', 'b3', 'e4', 'b5', 'c2']) x;
insert into public.perfil (id, hospital_id, setor_id, papel, nome)
values (pg_temp.u('a0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'G');
insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
select pg_temp.u(v.x), 'aaaaaaaa-0000-0000-0000-000000000000', v.setor, 'profissional', upper(v.x), v.cat::public.categoria_profissional,
       (select id from public.especialidade where nome = v.esp), '1', 'SP'
from (values
  ('b1', 'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'medico', 'Clínico'),
  ('b2', 'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'medico', 'Clínico'),
  ('b3', 'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'medico', 'Clínico'),
  ('b5', 'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'medico', 'Clínico'),
  ('e4', 'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'enfermeiro', 'Enfermagem Clínica'),
  ('c2', 'aaaaaaaa-0000-0000-0000-0000000000a2'::uuid, 'medico', 'Clínico')
) v(x, setor, cat, esp);

-- Plantões: P1 (b1), Q3 (b3, sobrepõe P1), O (aberto, longe), O2 (aberto, dentro de P1)
create temp table t (nome text primary key, id uuid);
grant all on t to authenticated;
with x as (
  insert into public.plantao (hospital_id, setor_id, especialidade_id, inicio, fim, profissional_id, criado_por)
  select 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', (select id from public.especialidade where nome = 'Clínico'),
         pg_temp.d(v.ini), pg_temp.d(v.ini + v.dur), v.prof, pg_temp.u('a0')
  from (values (0, 12, pg_temp.u('b1')), (6, 12, pg_temp.u('b3')), (72, 12, null), (2, 8, null)) v(ini, dur, prof)
  returning id, inicio, profissional_id)
insert into t select case
  when profissional_id = pg_temp.u('b1') then 'P1' when profissional_id = pg_temp.u('b3') then 'Q3'
  when inicio = pg_temp.d(72) then 'O' else 'O2' end, id from x;
create function pg_temp.p(n text) returns uuid language sql as $$ select id from t where nome = n $$;
create function pg_temp.anuncio() returns uuid language sql as $$ select id from public.anuncio where plantao_id = pg_temp.p('P1') $$;
create function pg_temp.avisos(x text) returns bigint language sql as $$ select count(*) from public.aviso where perfil_id = pg_temp.u(x) $$;

-- ---------- RN11: anúncio avisa só elegíveis ----------
set local role authenticated;
select pg_temp.como('b1');
select public.anunciar(pg_temp.p('P1'), 'urgente');
reset role;
select is(pg_temp.avisos('b2'), 1::bigint, 'RN11: elegível é avisado');
select is(pg_temp.avisos('b3'), 0::bigint, 'RN11: quem tem conflito (RN14) não é avisado');
select is(pg_temp.avisos('e4'), 0::bigint, 'RN11: outra categoria/especialidade não é avisada');
select is(pg_temp.avisos('c2'), 0::bigint, 'RN11: outro setor não é avisado');
select is(pg_temp.avisos('b1'), 0::bigint, 'RN11: anunciante não é avisado do próprio anúncio');

-- ---------- Assumir: RN12–RN15 ----------
set local role authenticated;
select pg_temp.como('b1');
select throws_like($$ select public.assumir_anuncio(pg_temp.anuncio()) $$, 'RN15%', 'RN15: não assume o próprio plantão');
select pg_temp.como('b3');
select throws_like($$ select public.assumir_anuncio(pg_temp.anuncio()) $$, 'RN14: sobrepõe%', 'RN14: sobreposição bloqueia assumir');
select pg_temp.como('e4');
select throws_like($$ select public.assumir_anuncio(pg_temp.anuncio()) $$, 'RN13%', 'RN13/RN12b: especialidade/categoria diferente');
select pg_temp.como('c2');
select throws_ok($$ select public.assumir_anuncio(pg_temp.anuncio()) $$, 'TK404', null, 'RN12: outro setor não encontra o anúncio');
select pg_temp.como('a0');
select throws_ok($$ select public.assumir_anuncio(pg_temp.anuncio()) $$, 'TK403', null, 'gestor não assume');

select pg_temp.como('b2');
select lives_ok($$ select public.assumir_anuncio(pg_temp.anuncio()) $$, 'elegível assume');
select results_eq($$ select status::text, assumido_por from public.anuncio where id = pg_temp.anuncio() $$,
  $$ values ('pendente', pg_temp.u('b2')) $$, 'anúncio fica pendente com o assumidor');
select pg_temp.como('b5');
select throws_ok($$ select public.assumir_anuncio(pg_temp.anuncio()) $$, 'TK422', 'Este anúncio não está mais disponível.',
  'RN22b: um assumidor por vez');
reset role;
select is((select count(*) from public.aviso where perfil_id in (pg_temp.u('b1'), pg_temp.u('a0'))), 2::bigint,
  'anunciante e gestor são avisados da pendência');
set local role authenticated;

-- P2: compromisso pendente conta para RN14
select pg_temp.como('b2');
select throws_like($$ select public.candidatar(pg_temp.p('O2')) $$, 'RN14: sobrepõe%', 'P2: troca pendente bloqueia candidatura sobreposta');

-- ---------- RN22b: desistir ----------
select pg_temp.como('b5');
select throws_ok($$ select public.desistir_anuncio(pg_temp.anuncio()) $$, 'TK403', null, 'RN22b: só quem assumiu desiste');
select pg_temp.como('b2');
select lives_ok($$ select public.desistir_anuncio(pg_temp.anuncio()) $$, 'RN22b: quem assumiu desiste antes da aprovação');
select results_eq($$ select status::text, assumido_por from public.anuncio where id = pg_temp.anuncio() $$,
  $$ values ('aberto', null::uuid) $$, 'RN22b: anúncio volta a aberto');

-- ---------- RN06c: candidatura ----------
select lives_ok($$ select public.candidatar(pg_temp.p('O')) $$, 'RN06c: elegível se candidata a plantão aberto');
select throws_like($$ select public.candidatar(pg_temp.p('O')) $$, 'Você já se candidatou%', 'candidatura duplicada bloqueada');
select throws_like($$ select public.candidatar(pg_temp.p('P1')) $$, 'RN06c%', 'RN06c: plantão atribuído não aceita candidatura');
select pg_temp.como('e4');
select throws_like($$ select public.candidatar(pg_temp.p('O')) $$, 'RN13%', 'RN13: candidatura exige especialidade idêntica');
select ok((select cardinality(motivos) > 0 from public.ofertas_para_mim() where plantao_id = pg_temp.p('O')),
  'ofertas_para_mim mostra o motivo de inelegibilidade');

select pg_temp.como('a0');
select throws_like($$ select public.editar_plantao(pg_temp.p('O'), (select id from public.especialidade where nome = 'Clínico'), pg_temp.d(73), pg_temp.d(85)) $$,
  'Plantão com candidaturas pendentes%', 'P6: plantão com candidatura pendente travado');
select is((select count(*) from public.candidatura), 1::bigint, 'P5: gestor do setor vê a candidatura');
select pg_temp.como('b5');
select is((select count(*) from public.candidatura), 0::bigint, 'P5: colega não vê candidatura alheia');

reset role;
select * from finish();
rollback;
