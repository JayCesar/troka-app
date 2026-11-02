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

-- ---------------------------------------------------------------------------
-- Plantões (B2): próximas 2 semanas, relativos à data do `db reset`, horário de Brasília.
-- Passam pelo trigger de validação (setor, especialidade, sobreposição, 11h).
-- ---------------------------------------------------------------------------
create function pg_temp.plantao(p_setor uuid, p_especialidade text, p_dia int, p_hora int, p_horas int, p_prof uuid default null)
returns void language sql as $$
  insert into public.plantao (hospital_id, setor_id, especialidade_id, inicio, fim, profissional_id, criado_por)
  select s.hospital_id, s.id, e.id,
         ((current_date + p_dia) + make_time(p_hora, 0, 0)) at time zone 'America/Sao_Paulo',
         ((current_date + p_dia) + make_time(p_hora, 0, 0)) at time zone 'America/Sao_Paulo' + make_interval(hours => p_horas),
         p_prof,
         (select g.id from public.perfil g where g.setor_id = s.id and g.papel = 'gestor' limit 1)
  from public.setor s, public.especialidade e
  where s.id = p_setor and e.nome = p_especialidade $$;

-- Vila Nova · Clínica Médica (gestora Ana)
select pg_temp.plantao('20000000-0000-0000-0000-000000000013', 'Clínico', 1, 7, 12, '40000000-0000-0000-0000-000000000001');  -- Carlos
select pg_temp.plantao('20000000-0000-0000-0000-000000000013', 'Clínico', 4, 7, 12, '40000000-0000-0000-0000-000000000001');  -- Carlos
select pg_temp.plantao('20000000-0000-0000-0000-000000000013', 'Clínico', 6, 19, 12, '40000000-0000-0000-0000-000000000001'); -- Carlos (noturno)
select pg_temp.plantao('20000000-0000-0000-0000-000000000013', 'Clínico', 2, 7, 12, '40000000-0000-0000-0000-000000000004');  -- Juliana
select pg_temp.plantao('20000000-0000-0000-0000-000000000013', 'Clínico', 5, 19, 12, '40000000-0000-0000-0000-000000000004'); -- Juliana
select pg_temp.plantao('20000000-0000-0000-0000-000000000013', 'Enfermagem Clínica', 1, 7, 12, '50000000-0000-0000-0000-000000000001'); -- Fernanda
select pg_temp.plantao('20000000-0000-0000-0000-000000000013', 'Enfermagem Clínica', 3, 7, 12, '50000000-0000-0000-0000-000000000001'); -- Fernanda
select pg_temp.plantao('20000000-0000-0000-0000-000000000013', 'Clínico', 2, 19, 12);  -- aberto
select pg_temp.plantao('20000000-0000-0000-0000-000000000013', 'Clínico', 8, 7, 12);   -- aberto
select pg_temp.plantao('20000000-0000-0000-0000-000000000013', 'Enfermagem Clínica', 4, 19, 12); -- aberto

-- Vila Nova · Pronto-Socorro (gestor Paulo)
select pg_temp.plantao('20000000-0000-0000-0000-000000000012', 'Emergencista', 1, 19, 12, '40000000-0000-0000-0000-000000000003'); -- Rafael
select pg_temp.plantao('20000000-0000-0000-0000-000000000012', 'Emergencista', 3, 7, 12, '40000000-0000-0000-0000-000000000006');  -- Marina
select pg_temp.plantao('20000000-0000-0000-0000-000000000012', 'Enfermagem em Emergência', 2, 19, 12, '50000000-0000-0000-0000-000000000002'); -- Lucas
select pg_temp.plantao('20000000-0000-0000-0000-000000000012', 'Emergencista', 2, 7, 12);  -- aberto
select pg_temp.plantao('20000000-0000-0000-0000-000000000012', 'Enfermagem em Emergência', 5, 7, 12); -- aberto

-- Santa Clara · UTI Adulto (gestora Helena) e Clínica Médica (gestor Roberto)
select pg_temp.plantao('20000000-0000-0000-0000-000000000021', 'Intensivista', 2, 7, 12, '40000000-0000-0000-0000-000000000005'); -- Pedro
select pg_temp.plantao('20000000-0000-0000-0000-000000000021', 'Intensivista', 3, 19, 12); -- aberto
select pg_temp.plantao('20000000-0000-0000-0000-000000000023', 'Clínico', 1, 7, 12, '40000000-0000-0000-0000-000000000007');  -- Tiago
select pg_temp.plantao('20000000-0000-0000-0000-000000000023', 'Enfermagem Clínica', 2, 7, 12, '50000000-0000-0000-0000-000000000003'); -- Camila
select pg_temp.plantao('20000000-0000-0000-0000-000000000023', 'Clínico', 4, 7, 12); -- aberto

-- ---------------------------------------------------------------------------
-- Anúncios (B3): criados pela RPC `anunciar`, "logado" como o dono do plantão.
-- ---------------------------------------------------------------------------
create function pg_temp.anunciar_como(p_dono uuid, p_ordem int, p_urgencia public.urgencia,
                                       p_cat public.motivo_categoria default null, p_texto text default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_dono, 'role', 'authenticated')::text, true);
  perform public.anunciar(
    (select id from public.plantao where profissional_id = p_dono order by inicio offset p_ordem limit 1),
    p_urgencia, p_cat, p_texto);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.anunciar_como('40000000-0000-0000-0000-000000000004', 1, 'normal', 'pessoal', 'Casamento da minha irmã'); -- Juliana (noturno, dia 5)
select pg_temp.anunciar_como('40000000-0000-0000-0000-000000000003', 0, 'urgente', 'saude', 'Cirurgia marcada');        -- Rafael (PS, amanhã)
select pg_temp.anunciar_como('40000000-0000-0000-0000-000000000005', 0, 'normal');                                       -- Pedro (SC UTI), sem motivo

-- ---------------------------------------------------------------------------
-- B4: uma troca pendente e uma candidatura, para o B5 ter o que aprovar.
-- ---------------------------------------------------------------------------
create function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;

-- Marina assume o anúncio urgente do Rafael (PS Vila Nova)
select pg_temp.como('40000000-0000-0000-0000-000000000006');
select public.assumir_anuncio((select a.id from public.anuncio a where a.anunciante_id = '40000000-0000-0000-0000-000000000003'));
-- Carlos se candidata ao plantão Clínico aberto do dia 8 (Clínica Médica Vila Nova)
select pg_temp.como('40000000-0000-0000-0000-000000000001');
select public.candidatar((select id from public.plantao
                          where setor_id = '20000000-0000-0000-0000-000000000013' and profissional_id is null
                          order by inicio desc limit 1));
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- B5: lista de confiança (incluída DEPOIS das pendências do seed — elas seguem manuais, RN19c não retroage)
-- Clínica Médica VN: Carlos e Juliana confiáveis (troca entre eles = automática). PS VN: só Marina.
-- ---------------------------------------------------------------------------
insert into public.lista_confianca (profissional_id, setor_id, incluido_por)
select p.id, p.setor_id, (select g.id from public.perfil g where g.setor_id = p.setor_id and g.papel = 'gestor' limit 1)
from public.perfil p
where p.id in ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000006');

-- ---------------------------------------------------------------------------
-- B6: Ana oferece R$ 250,00 no anúncio da Juliana (Clínica Médica VN)
-- ---------------------------------------------------------------------------
select pg_temp.como('30000000-0000-0000-0000-000000000001');
select public.definir_adicional((select id from public.anuncio where anunciante_id = '40000000-0000-0000-0000-000000000004'), 250);
select set_config('request.jwt.claims', '', true);
