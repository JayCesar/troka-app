-- M3 — aviso de novo pedido de acesso para a gestão do hospital (RN30). Rollback no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

create function pg_temp.u(x text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || x)::uuid $$;
insert into public.hospital (id, nome) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'T Hospital A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'T Hospital B');
insert into public.setor (id, hospital_id, nome) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1'),
  ('aaaaaaaa-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000000', 'A3'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'B1');
insert into auth.users (id, email) select pg_temp.u(x), x || '@t.com' from unnest(array['a0', 'a3', 'b0', 'a2']) x;
insert into public.perfil (id, hospital_id, setor_id, papel, nome) values
  (pg_temp.u('a0'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'gestor', 'Gestora A1'),
  (pg_temp.u('a3'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a3', 'gestor', 'Gestor A3'),
  (pg_temp.u('b0'), 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'gestor', 'Gestor B');
insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
select pg_temp.u('a2'), 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'profissional', 'Prof A',
       'medico', id, '424242', 'SP' from public.especialidade where nome = 'Clínico';

set local role anon;
select public.solicitar_acesso('aaaaaaaa-0000-0000-0000-000000000000', 'Dra. Nova', 'nova@mail.com', 'medico');
select public.solicitar_acesso('aaaaaaaa-0000-0000-0000-000000000000', 'Dra. Nova', 'NOVA@mail.com', 'medico'); -- reenvio
select public.solicitar_acesso('aaaaaaaa-0000-0000-0000-000000000000', 'Já Tenho', 'a2@t.com', 'medico');      -- já tem conta
reset role;

select results_eq(
  $$ select perfil_id, texto, link from public.aviso where texto like 'Novo pedido de acesso%' order by perfil_id $$,
  $$ values (pg_temp.u('a0'), 'Novo pedido de acesso: Dra. Nova (Médico)', '/gestao/aprovacoes'),
            (pg_temp.u('a3'), 'Novo pedido de acesso: Dra. Nova (Médico)', '/gestao/aprovacoes') $$,
  'todos os gestores do hospital (de qualquer setor) recebem um aviso, com link para Aprovações');
select is((select count(*)::int from public.aviso where perfil_id = pg_temp.u('b0')), 0, 'RN30: gestor de outro hospital não é avisado');
select is((select count(*)::int from public.aviso where perfil_id = pg_temp.u('a2')), 0, 'profissional não é avisado');
select is((select count(*)::int from public.aviso where texto like '%Já Tenho%'), 0, 'e-mail já cadastrado não gera aviso (não revela conta)');
select is((select count(*)::int from public.aviso where texto like '%@%'), 0, 'e-mail do solicitante não aparece no aviso');

-- O gestor lê o próprio aviso pela RLS
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is((select count(*)::int from public.aviso where texto like 'Novo pedido de acesso%'), 1, 'gestor vê só o próprio aviso');

select * from finish();
