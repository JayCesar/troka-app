-- M2 — pedido de acesso público (RN01 preservada, RN30 isolamento). Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create function pg_temp.u(x text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || x)::uuid $$;
insert into public.hospital (id, nome) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'T Hospital B');
insert into public.setor (id, hospital_id, nome) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'B1');
insert into auth.users (id, email) select pg_temp.u(x), x || '@t.com' from unnest(array['a0', 'b0', 'a2']) x;
insert into public.perfil (id, hospital_id, setor_id, papel, nome) values
  (pg_temp.u('a0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'Gestora A'),
  (pg_temp.u('b0'), 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'gestor', 'Gestor B');
insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
select pg_temp.u('a2'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', 'Prof A',
       'medico', id, '424242', 'SP' from public.especialidade where nome = 'Clínico';

-- Anônimo: lista hospitais e envia pedido
set local role anon;
select ok((select count(*) from public.hospitais_para_cadastro() where nome like 'T Hospital%') = 2, 'anônimo lista hospitais (id e nome)');
select lives_ok($$ select public.solicitar_acesso('aaaaaaaa-0000-0000-0000-000000000000', ' Dra. Nova ', 'Nova@Mail.com', 'medico', '123456/SP') $$,
  'anônimo envia pedido de acesso');
select lives_ok($$ select public.solicitar_acesso('aaaaaaaa-0000-0000-0000-000000000000', 'Dra. Nova', 'nova@mail.com', 'medico') $$,
  'pedido repetido não dá erro (idempotente)');
select lives_ok($$ select public.solicitar_acesso('aaaaaaaa-0000-0000-0000-000000000000', 'Já Tenho', 'A2@t.com', 'medico') $$,
  'e-mail já cadastrado: resposta igual (não revela conta)');
select throws_like($$ select public.solicitar_acesso('aaaaaaaa-0000-0000-0000-000000000000', 'Fulano', 'sem-arroba', 'medico') $$,
  'Informe um e-mail válido.', 'e-mail inválido barrado');
select throws_like($$ select public.solicitar_acesso('cccccccc-0000-0000-0000-000000000000', 'Fulano', 'f@x.com', 'medico') $$,
  'Escolha um hospital%', 'hospital inexistente barrado');
select throws_ok($$ select count(*) from public.pedido_acesso $$, '42501', null, 'anônimo não lê pedidos');
reset role;

select results_eq($$ select nome, email, status from public.pedido_acesso $$, $$ values ('Dra. Nova', 'nova@mail.com', 'pendente') $$,
  'um único pedido pendente, normalizado; nenhum para e-mail já cadastrado');

-- RN30: só a gestão do hospital do pedido vê e decide
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', true);
select is((select count(*)::int from public.pedido_acesso), 0, 'RN30: gestor de outro hospital não vê o pedido');
select throws_like($$ select public.resolver_pedido_acesso((select id from public.pedido_acesso limit 1), true) $$,
  'Pedido não encontrado%', 'RN30: gestor de outro hospital não decide');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from public.pedido_acesso), 0, 'profissional não vê pedidos');

reset role;
create temp table alvo as select id from public.pedido_acesso;
grant select on alvo to authenticated;
set local role authenticated;
select throws_like($$ select public.resolver_pedido_acesso((select id from alvo), true) $$, 'RN01: só a gestão%', 'profissional não decide');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is((select status from public.resolver_pedido_acesso((select id from alvo), true)), 'aprovado', 'gestão do hospital aprova');
select throws_like($$ select public.resolver_pedido_acesso((select id from alvo), false) $$, 'Pedido não encontrado%', 'pedido já resolvido não muda');

select * from finish();
rollback;
