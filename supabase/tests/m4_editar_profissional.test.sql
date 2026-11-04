-- M4 — gestor edita nome/especialidade de profissional do próprio setor (RN01, RN03, RN13). Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create function pg_temp.u(x text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || x)::uuid $$;
create function pg_temp.esp(n text, c public.categoria_profissional) returns uuid language sql stable as
  $$ select id from public.especialidade where nome = n and categoria = c $$;
create function pg_temp.como(x text) returns void language sql as
  $$ select set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(x), 'role', 'authenticated')::text, true) $$;

insert into public.hospital (id, nome) values ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A');
insert into public.setor (id, hospital_id, nome) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'A2');
insert into auth.users (id, email) select pg_temp.u(x), x || '@t.com' from unnest(array['a1', 'a2', 'b1', 'b2', 'b3']) x;
insert into public.perfil (id, hospital_id, setor_id, papel, nome) values
  (pg_temp.u('a1'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'Gestora A1'),
  (pg_temp.u('a2'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'gestor', 'Gestor A2');
insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf) values
  (pg_temp.u('b1'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', 'Nome Errado',
   'enfermeiro', pg_temp.esp('Enfermagem Clínica', 'enfermeiro'), '111111', 'SP'),
  (pg_temp.u('b2'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', 'Com Plantão',
   'medico', pg_temp.esp('Clínico', 'medico'), '222222', 'SP'),
  (pg_temp.u('b3'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', 'Outro Prof',
   'medico', pg_temp.esp('Clínico', 'medico'), '333333', 'SP');
-- p2 tem plantão futuro na especialidade atual
insert into public.plantao (hospital_id, setor_id, especialidade_id, inicio, fim, profissional_id, criado_por)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', pg_temp.esp('Clínico', 'medico'),
        now() + interval '2 days', now() + interval '2 days 12 hours', pg_temp.u('b2'), pg_temp.u('a1'));

set local role authenticated;

-- Gestor do setor corrige o nome
select pg_temp.como('a1');
select is((select nome from public.editar_profissional(pg_temp.u('b1'), '  Júlio Batista  ', pg_temp.esp('Enfermagem Clínica', 'enfermeiro'))),
  'Júlio Batista', 'gestor do setor corrige o nome (com trim)');
select is((select count(*)::int from public.historico where entidade = 'perfil' and acao = 'update' and entidade_id = pg_temp.u('b1')
             and ator_id = pg_temp.u('a1') and resumo = 'Perfil alterado: Júlio Batista'), 1,
  'B8: alteração registrada no histórico com o gestor como autor');

-- Validações
select throws_like($$ select public.editar_profissional(pg_temp.u('b1'), 'Jo', pg_temp.esp('Enfermagem Clínica', 'enfermeiro')) $$,
  'Informe o nome completo%', 'nome curto barrado');
select throws_like($$ select public.editar_profissional(pg_temp.u('b1'), 'Júlio Batista', null) $$,
  'Escolha a especialidade.', 'especialidade obrigatória');
select throws_like($$ select public.editar_profissional(pg_temp.u('b1'), 'Júlio Batista', pg_temp.esp('Clínico', 'medico')) $$,
  'RN01: especialidade inválida%', 'RN01: especialidade de outra categoria barrada');
select throws_like($$ select public.editar_profissional(pg_temp.u('a2'), 'Gestor Novo', pg_temp.esp('Clínico', 'medico')) $$,
  'Profissional não encontrado%', 'gestor não é editado por esta RPC');

-- RN13: com plantão futuro não troca a especialidade; só o nome, sim
select throws_like($$ select public.editar_profissional(pg_temp.u('b2'), 'Com Plantão', pg_temp.esp('Intensivista', 'medico')) $$,
  'RN13: há plantões futuros%', 'RN13: troca bloqueada com plantão futuro na especialidade atual');
select is((select nome from public.editar_profissional(pg_temp.u('b2'), 'Com Plantão Corrigido', pg_temp.esp('Clínico', 'medico'))),
  'Com Plantão Corrigido', 'mesmo com plantão futuro, o nome pode ser corrigido');
select is((select e.nome from public.editar_profissional(pg_temp.u('b3'), 'Outro Prof', pg_temp.esp('Intensivista', 'medico')) p
             join public.especialidade e on e.id = p.especialidade_id), 'Intensivista', 'sem pendências, a especialidade muda');

-- RN03/RN30: gestor de outro setor e profissional são barrados
select pg_temp.como('a2');
select throws_like($$ select public.editar_profissional(pg_temp.u('b1'), 'Invasor', pg_temp.esp('Enfermagem Clínica', 'enfermeiro')) $$,
  'Profissional não encontrado%', 'RN03: gestor de outro setor não edita');
select pg_temp.como('b3');
select throws_like($$ select public.editar_profissional(pg_temp.u('b1'), 'Invasor', pg_temp.esp('Enfermagem Clínica', 'enfermeiro')) $$,
  'Ação exclusiva do gestor%', 'profissional não edita');
reset role;
set local role anon;
select throws_ok($$ select public.editar_profissional(pg_temp.u('b1'), 'Invasor', null) $$, '42501', null, 'anônimo não executa');

select * from finish();
