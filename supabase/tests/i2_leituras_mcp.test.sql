-- I2 — leituras para o MCP: meu_perfil, plantoes_periodo, anuncios_do_setor, buscar_profissional (RN03, RN29, RN30). Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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
  (pg_temp.u('b1'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', 'Júlio Batista',
   'medico', pg_temp.esp('Clínico', 'medico'), '111111', 'SP'),
  (pg_temp.u('b2'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', 'Ana Souza',
   'medico', pg_temp.esp('Clínico', 'medico'), '222222', 'SP'),
  (pg_temp.u('b3'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'profissional', 'Julia Outro Setor',
   'medico', pg_temp.esp('Clínico', 'medico'), '333333', 'SP');
-- Setor A1: um plantão do b1, um do b2 e um em aberto; setor A2: um do b3
insert into public.plantao (id, hospital_id, setor_id, especialidade_id, inicio, fim, profissional_id, criado_por) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1',
   pg_temp.esp('Clínico', 'medico'), now() + interval '3 days', now() + interval '3 days 12 hours', pg_temp.u('b1'), pg_temp.u('a1')),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1',
   pg_temp.esp('Clínico', 'medico'), now() + interval '5 days', now() + interval '5 days 12 hours', pg_temp.u('b2'), pg_temp.u('a1')),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1',
   pg_temp.esp('Clínico', 'medico'), now() + interval '40 days', now() + interval '40 days 12 hours', null, pg_temp.u('a1')),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2',
   pg_temp.esp('Clínico', 'medico'), now() + interval '3 days', now() + interval '3 days 12 hours', pg_temp.u('b3'), pg_temp.u('a2'));

set local role authenticated;

-- meu_perfil
select pg_temp.como('a1');
select is((select papel::text || '/' || setor from public.meu_perfil()), 'gestor/A1', 'meu_perfil: papel e setor do token');

-- plantoes_periodo
select is((select count(*)::int from public.plantoes_periodo()), 2, 'padrão (30 dias): plantões do setor no período');
select is((select count(*)::int from public.plantoes_periodo(now(), now() + interval '60 days')), 3, 'período maior inclui o plantão em aberto');
select is((select profissional from public.plantoes_periodo(p_profissional_id => pg_temp.u('b2'))), 'Ana Souza', 'filtro por profissional');
select throws_like($$ select * from public.plantoes_periodo(now(), now() - interval '1 day') $$,
  'Período inválido%', 'fim antes do início barrado');
select throws_like($$ select * from public.plantoes_periodo(now(), now() + interval '100 days') $$,
  'Período longo demais%', 'período acima de 93 dias barrado');

select pg_temp.como('b1');
select is((select count(*)::int from public.plantoes_periodo(p_somente_meus => true)), 1, 'somente_meus: só os do usuário');
select is((select count(*)::int from public.plantoes_periodo(p_profissional_id => pg_temp.u('b3'))), 0,
  'RN03/RN30: plantão de outro setor não aparece nem filtrando pelo id');

-- b1 anuncia o próprio plantão com motivo
select lives_ok($$ select public.anunciar('cccccccc-0000-0000-0000-000000000001', 'normal', 'saude', 'Consulta médica') $$,
  'b1 anuncia o próprio plantão');
select is((select anuncio_status::text from public.plantoes_periodo(p_somente_meus => true)), 'aberto',
  'plantoes_periodo traz o anúncio vigente');

-- anuncios_do_setor e RN29
select is((select motivo_texto from public.anuncios_do_setor()), 'Consulta médica', 'RN29: anunciante vê o próprio motivo');
select pg_temp.como('a1');
select is((select motivo_categoria::text from public.anuncios_do_setor()), 'saude', 'RN29: gestor vê o motivo');
select pg_temp.como('b2');
select is((select coalesce(motivo_categoria::text, 'oculto') || '/' || anunciante from public.anuncios_do_setor()), 'oculto/Júlio Batista',
  'RN29: colega vê o anúncio, mas não o motivo');

-- buscar_profissional
select is((select nome from public.buscar_profissional('julio')), 'Júlio Batista', 'busca sem acento e sem caixa');
select is((select count(*)::int from public.buscar_profissional('juli')), 1, 'RN03: profissional de outro setor fica fora da busca');
select throws_like($$ select * from public.buscar_profissional(' a ') $$, 'Informe ao menos 2 letras%', 'termo curto barrado');

-- anon não executa
set local role anon;
select throws_like($$ select * from public.meu_perfil() $$, 'permission denied%', 'anon não chama as leituras do MCP');

select * from finish();
rollback;
