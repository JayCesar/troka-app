-- B5 — aprovação manual/automática e lista de confiança (RN06c, RN16, RN19, RN19b, RN19c, RN20, RN20b, RN21). Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Ids: a0 gestor A1 · c0 gestor A2 · b1..b6 profissionais Clínico de A1
create function pg_temp.u(x text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || x)::uuid $$;
create function pg_temp.como(x text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(x), 'role', 'authenticated')::text, true) $$;
create function pg_temp.d(h int) returns timestamptz language sql as $$ select date_trunc('hour', now()) + interval '2 days' + make_interval(hours => h) $$;
create function pg_temp.clinico() returns uuid language sql as $$ select id from public.especialidade where nome = 'Clínico' $$;

insert into public.hospital (id, nome) values ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A');
insert into public.setor (id, hospital_id, nome) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'A2');
insert into auth.users (id, email) select pg_temp.u(x), x || '@t' from unnest(array['a0', 'c0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6']) x;
insert into public.perfil (id, hospital_id, setor_id, papel, nome) values
  (pg_temp.u('a0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'GA1'),
  (pg_temp.u('c0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'gestor', 'GA2');
insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
select pg_temp.u(x), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', upper(x), 'medico',
       pg_temp.clinico(), '1', 'SP'
from unnest(array['b1', 'b2', 'b3', 'b4', 'b5', 'b6']) x;

-- Plantões: P1 (b1), P3 (b3), abertos O, O2, O3 — todos bem separados no tempo
create temp table t (nome text primary key, id uuid);
grant all on t to authenticated;
do $$
declare r record; v_id uuid;
begin
  for r in select * from (values ('P1', 0, pg_temp.u('b1')), ('P3', 48, pg_temp.u('b3')), ('O', 96, null::uuid), ('O2', 144, null::uuid), ('O3', 192, null::uuid)) v(nome, ini, prof) loop
    insert into public.plantao (hospital_id, setor_id, especialidade_id, inicio, fim, profissional_id, criado_por)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', pg_temp.clinico(),
            pg_temp.d(r.ini), pg_temp.d(r.ini + 12), r.prof, pg_temp.u('a0'))
    returning id into v_id;
    insert into t values (r.nome, v_id);
  end loop;
end $$;
create function pg_temp.p(n text) returns uuid language sql as $$ select id from t where nome = n $$;
create function pg_temp.an(n text) returns uuid language sql as $$ select id from public.anuncio where plantao_id = pg_temp.p(n) order by criado_em desc limit 1 $$;
create function pg_temp.cand(n text, x text) returns uuid language sql as $$
  select id from public.candidatura where plantao_id = pg_temp.p(n) and profissional_id = pg_temp.u(x) order by criado_em desc limit 1 $$;

set local role authenticated;

-- ---------- RN19b: lista de confiança ----------
select pg_temp.como('b1');
select throws_ok($$ select public.definir_confianca(pg_temp.u('b2'), true) $$, 'TK403', null, 'RN19b: profissional não mexe na lista');
select pg_temp.como('c0');
select throws_ok($$ select public.definir_confianca(pg_temp.u('b2'), true) $$, 'TK404', null, 'RN19b: gestor de outro setor não mexe na lista');
select pg_temp.como('a0');
select lives_ok($$ select public.definir_confianca(pg_temp.u('b1'), true); select public.definir_confianca(pg_temp.u('b2'), true) $$,
  'RN19b: gestor marca b1 e b2 como confiáveis');
select is((select count(*) from public.lista_confianca), 2::bigint, 'P5: gestor vê a lista');
select pg_temp.como('b1');
select is((select count(*) from public.lista_confianca), 0::bigint, 'P5: profissional não vê a lista');

-- ---------- RN19c: troca automática entre confiáveis ----------
select public.anunciar(pg_temp.p('P1'), 'normal');
select pg_temp.como('b2');
select is((select status::text from public.assumir_anuncio(pg_temp.an('P1'))), 'aprovado', 'RN19c: ambos confiáveis → aprovado automático');
select is((select profissional_id from public.plantao where id = pg_temp.p('P1')), pg_temp.u('b2'), 'RN20: plantão muda de dono na aprovação');
select throws_ok($$ select public.desistir_anuncio(pg_temp.an('P1')) $$, 'TK403', null, 'RN20b: não desfaz troca aprovada');

-- ---------- Manual: assumir fica pendente; recusa devolve a aberto (P2) ----------
select pg_temp.como('b3');
select public.anunciar(pg_temp.p('P3'), 'normal');
select pg_temp.como('b4');
select is((select status::text from public.assumir_anuncio(pg_temp.an('P3'))), 'pendente', 'RN19: sem confiança → pendente');
select is((select profissional_id from public.plantao where id = pg_temp.p('P3')), pg_temp.u('b3'), 'RN20: dono não muda antes da aprovação');

select throws_ok($$ select public.aprovar_troca(pg_temp.an('P3')) $$, 'TK403', null, 'RN21: profissional não aprova');
select pg_temp.como('c0');
select throws_ok($$ select public.aprovar_troca(pg_temp.an('P3')) $$, 'TK404', null, 'RN21: gestor de outro setor não aprova');

select pg_temp.como('a0');
select is((select status::text from public.recusar_troca(pg_temp.an('P3'))), 'aberto', 'P2: recusa devolve o anúncio a aberto');

-- P1: incluir na lista depois da solicitação não aprova a pendente
select pg_temp.como('b4');
select public.assumir_anuncio(pg_temp.an('P3'));
select pg_temp.como('a0');
select public.definir_confianca(pg_temp.u('b3'), true);
select public.definir_confianca(pg_temp.u('b4'), true);
select is((select status::text from public.anuncio where id = pg_temp.an('P3')), 'pendente', 'RN19c: mudança na lista não retroage');

-- RN16: revalida na aprovação
reset role;
update public.perfil set especialidade_id = (select id from public.especialidade where nome = 'Intensivista') where id = pg_temp.u('b4');
set local role authenticated;
select pg_temp.como('a0');
select throws_like($$ select public.aprovar_troca(pg_temp.an('P3')) $$, 'RN16%', 'RN16: aprovação revalida elegibilidade');
reset role;
update public.perfil set especialidade_id = pg_temp.clinico() where id = pg_temp.u('b4');
set local role authenticated;
select pg_temp.como('a0');
select is((select status::text from public.aprovar_troca(pg_temp.an('P3'))), 'aprovado', 'RN19: gestor aprova com um clique');
select is((select profissional_id from public.plantao where id = pg_temp.p('P3')), pg_temp.u('b4'), 'RN20: dono muda após aprovação manual');
select throws_like($$ select public.recusar_troca(pg_temp.an('P3')) $$, 'Esta troca não está%', 'RN20b: troca aprovada não volta');

-- ---------- RN06c: candidatura ----------
select pg_temp.como('b5');                                           -- b5 não confiável
select is((select status::text from public.candidatar(pg_temp.p('O'))), 'pendente', 'RN06c: candidatura comum fica pendente');
select pg_temp.como('b6');
select public.candidatar(pg_temp.p('O'));
select pg_temp.como('a0');
select is((select status::text from public.aprovar_candidatura(pg_temp.cand('O', 'b5'))), 'aprovada', 'RN06c: gestor aprova candidatura');
select is((select profissional_id from public.plantao where id = pg_temp.p('O')), pg_temp.u('b5'), 'RN06c: plantão ganha dono');
select is((select status::text from public.candidatura where id = pg_temp.cand('O', 'b6')), 'recusada', 'P3: demais candidaturas recusadas');

select pg_temp.como('b6');
select public.candidatar(pg_temp.p('O2'));
select pg_temp.como('a0');
select is((select status::text from public.recusar_candidatura(pg_temp.cand('O2', 'b6'))), 'recusada', 'gestor recusa candidatura');
select is((select profissional_id from public.plantao where id = pg_temp.p('O2')), null::uuid, 'plantão segue aberto após recusa');

select pg_temp.como('b1');                                           -- b1 confiável
select is((select status::text from public.candidatar(pg_temp.p('O3'))), 'aprovada', 'RN06c: confiável → atribuição automática');
select is((select profissional_id from public.plantao where id = pg_temp.p('O3')), pg_temp.u('b1'), 'RN06c: dono definido automaticamente');

select pg_temp.como('a0');
select is((select count(*) from public.pendencias_do_setor()), 0::bigint, 'nenhuma pendência restante');

reset role;
select * from finish();
rollback;
