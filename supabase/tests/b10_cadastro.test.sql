-- B10 — cadastro interno de profissional (RN01, RN01b, RN02). Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create function pg_temp.u(x text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || x)::uuid $$;
insert into public.hospital (id, nome) values ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A');
insert into public.setor (id, hospital_id, nome) values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1');
insert into auth.users (id, email) select pg_temp.u(x), x || '@t' from unnest(array['a0', 'b1', 'b2', 'b3', 'b4']) x;
insert into public.perfil (id, hospital_id, setor_id, papel, nome)
values (pg_temp.u('a0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'Gestora');
create function pg_temp.esp(n text) returns uuid language sql as $$ select id from public.especialidade where nome = n $$;

-- Só a service_role (Edge Function) executa
set local role authenticated;
select throws_ok($$ select public.cadastrar_profissional_interno(pg_temp.u('a0'), pg_temp.u('b1'), 'X', 'medico', pg_temp.esp('Clínico'), '123', 'SP', 'verificado') $$,
  '42501', null, 'RN01: usuário comum não chama o cadastro interno');
reset role;
set local role service_role;

select is((select setor_id from public.cadastrar_profissional_interno(pg_temp.u('a0'), pg_temp.u('b1'), ' Dra. Teste ', 'medico', pg_temp.esp('Clínico'), ' 9123456 ', 'sp', 'nao_verificado')),
  'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'RN01: setor vem do gestor');
select results_eq($$ select nome, papel::text, conselho_numero, conselho_uf::text, conselho_validacao::text from public.perfil where id = pg_temp.u('b1') $$,
  $$ values ('Dra. Teste', 'profissional', '9123456', 'SP', 'nao_verificado') $$, 'RN02/P4: papel profissional e status de validação gravados');

select throws_like($$ select public.cadastrar_profissional_interno(pg_temp.u('a0'), pg_temp.u('b2'), 'Y', 'medico', pg_temp.esp('Clínico'), '9123456', 'SP', 'verificado') $$,
  'RN01b: este registro%', 'P5: conselho duplicado bloqueado');
select lives_ok($$ select public.cadastrar_profissional_interno(pg_temp.u('a0'), pg_temp.u('b2'), 'Y', 'enfermeiro', pg_temp.esp('Enfermagem Clínica'), '9123456', 'SP', 'simulado') $$,
  'P5: mesmo número em outra categoria (COREN) é outro registro');
select throws_like($$ select public.cadastrar_profissional_interno(pg_temp.u('a0'), pg_temp.u('b3'), 'Z', 'enfermeiro', pg_temp.esp('Clínico'), '777', 'SP', 'verificado') $$,
  'RN01: especialidade inválida%', 'RN01: especialidade precisa ser da categoria');
select throws_like($$ select public.cadastrar_profissional_interno(pg_temp.u('b1'), pg_temp.u('b3'), 'Z', 'medico', pg_temp.esp('Clínico'), '778', 'SP', 'verificado') $$,
  'RN01: só o gestor%', 'RN01: só gestor cadastra');
select throws_like($$ select public.cadastrar_profissional_interno(pg_temp.u('a0'), pg_temp.u('b3'), 'Z', 'medico', pg_temp.esp('Clínico'), '779', 'SP', null) $$,
  'RN01b: o cadastro exige%', 'RN01b: sem resultado de validação não conclui');
select throws_ok($$ select public.cadastrar_profissional_interno(pg_temp.u('a0'), pg_temp.u('b4'), 'W', 'medico', pg_temp.esp('Clínico'), '780', 'XX', 'verificado') $$,
  '23514', null, 'RN01: UF inválida barrada pelo CHECK');

select is(public.cadastro_verificar('B1@T', 'medico', pg_temp.esp('Clínico'), 'SP', '1'), 'Já existe um usuário com este e-mail.', 'pré-checagem: e-mail existente (sem diferenciar maiúsculas)');
select is(public.cadastro_verificar('novo@t', 'medico', pg_temp.esp('Clínico'), 'sp', ' 9123456 '), 'RN01b: este registro de conselho já está cadastrado.', 'pré-checagem: conselho em uso');
select is(public.cadastro_verificar('novo@t', 'enfermeiro', pg_temp.esp('Clínico'), 'SP', '55555'), 'RN01: especialidade inválida para a categoria informada.', 'pré-checagem: especialidade da categoria');
select is(public.cadastro_verificar('novo@t', 'medico', pg_temp.esp('Clínico'), 'SP', '55555'), null, 'pré-checagem: livre');
reset role;
select is((select ator_id from public.historico where entidade = 'perfil' and entidade_id = pg_temp.u('b1')), pg_temp.u('a0'),
  'histórico registra o gestor como autor do cadastro');

select * from finish();
rollback;
