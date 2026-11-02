-- Seed LOCAL (roda no `supabase db reset`; nunca vai para a nuvem).
-- Senha de todos os usuários: troka123

-- Hospitais (RN30) e setores (RN01)
insert into public.hospital (id, nome) values
  ('10000000-0000-0000-0000-000000000001', 'Hospital Vila Nova'),
  ('10000000-0000-0000-0000-000000000002', 'Hospital Santa Clara');

insert into public.setor (id, hospital_id, nome) values
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'UTI Adulto'),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'Pronto-Socorro'),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'Clínica Médica'),
  ('20000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000002', 'UTI Adulto'),
  ('20000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000002', 'Pronto-Socorro'),
  ('20000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000002', 'Clínica Médica');

-- Cria usuário no Auth (e-mail confirmado) + perfil
create function pg_temp.usuario(
  p_id uuid, p_email text, p_nome text, p_setor uuid, p_papel public.papel,
  p_categoria public.categoria_profissional default null, p_especialidade text default null,
  p_conselho text default null, p_uf text default null
) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('troka123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('nome', p_nome), now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (p_id, p_id::text, 'email', jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true), now(), now(), now());

  insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id, conselho_numero, conselho_uf)
  select p_id, s.hospital_id, s.id, p_papel, p_nome, p_categoria,
         (select e.id from public.especialidade e where e.nome = p_especialidade and e.categoria = p_categoria),
         p_conselho, p_uf
  from public.setor s where s.id = p_setor;
end $$;

-- Vila Nova
select pg_temp.usuario('30000000-0000-0000-0000-000000000001', 'ana@vilanova.com.br',   'Ana Ribeiro',       '20000000-0000-0000-0000-000000000013', 'gestor');
select pg_temp.usuario('30000000-0000-0000-0000-000000000002', 'paulo@vilanova.com.br', 'Paulo Teixeira',    '20000000-0000-0000-0000-000000000012', 'gestor');
select pg_temp.usuario('30000000-0000-0000-0000-000000000003', 'lucia@vilanova.com.br', 'Lúcia Martins',     '20000000-0000-0000-0000-000000000011', 'gestor');
select pg_temp.usuario('40000000-0000-0000-0000-000000000001', 'carlos@troka.app',      'Dr. Carlos Mendes', '20000000-0000-0000-0000-000000000013', 'profissional', 'medico', 'Clínico',      '123456', 'SP');
select pg_temp.usuario('40000000-0000-0000-0000-000000000004', 'juliana@troka.app',     'Dra. Juliana Alves','20000000-0000-0000-0000-000000000013', 'profissional', 'medico', 'Clínico',      '456789', 'SP');
select pg_temp.usuario('40000000-0000-0000-0000-000000000002', 'beatriz@troka.app',     'Dra. Beatriz Lima', '20000000-0000-0000-0000-000000000011', 'profissional', 'medico', 'Intensivista', '234567', 'SP');
select pg_temp.usuario('40000000-0000-0000-0000-000000000003', 'rafael@troka.app',      'Dr. Rafael Costa',  '20000000-0000-0000-0000-000000000012', 'profissional', 'medico', 'Emergencista', '345678', 'SP');
select pg_temp.usuario('40000000-0000-0000-0000-000000000006', 'marina@troka.app',      'Dra. Marina Souza', '20000000-0000-0000-0000-000000000012', 'profissional', 'medico', 'Emergencista', '678901', 'SP');
select pg_temp.usuario('50000000-0000-0000-0000-000000000001', 'fernanda@troka.app',    'Enf. Fernanda Rocha','20000000-0000-0000-0000-000000000013', 'profissional', 'enfermeiro', 'Enfermagem Clínica',       '111222', 'SP');
select pg_temp.usuario('50000000-0000-0000-0000-000000000002', 'lucas@troka.app',       'Enf. Lucas Pereira', '20000000-0000-0000-0000-000000000012', 'profissional', 'enfermeiro', 'Enfermagem em Emergência', '333444', 'SP');

-- Santa Clara
select pg_temp.usuario('30000000-0000-0000-0000-000000000004', 'roberto@santaclara.com.br', 'Roberto Dias',      '20000000-0000-0000-0000-000000000023', 'gestor');
select pg_temp.usuario('30000000-0000-0000-0000-000000000005', 'helena@santaclara.com.br',  'Helena Prado',      '20000000-0000-0000-0000-000000000021', 'gestor');
select pg_temp.usuario('40000000-0000-0000-0000-000000000005', 'pedro@troka.app',           'Dr. Pedro Nogueira','20000000-0000-0000-0000-000000000021', 'profissional', 'medico', 'Intensivista', '567890', 'SP');
select pg_temp.usuario('40000000-0000-0000-0000-000000000007', 'tiago@troka.app',           'Dr. Tiago Moura',   '20000000-0000-0000-0000-000000000023', 'profissional', 'medico', 'Clínico',      '789012', 'SP');
select pg_temp.usuario('50000000-0000-0000-0000-000000000003', 'camila@troka.app',          'Enf. Camila Torres','20000000-0000-0000-0000-000000000023', 'profissional', 'enfermeiro', 'Enfermagem Clínica', '555666', 'SP');
