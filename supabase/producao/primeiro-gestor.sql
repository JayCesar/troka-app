-- Dados iniciais da NUVEM: hospital, setor e o primeiro gestor. Só dados (o schema vem das migrations).
-- Roda uma vez no SQL Editor do painel. É idempotente: rodar de novo não duplica nada.
--
-- Antes: crie o usuário em Authentication → Users → Add user → "Create new user"
--        (e-mail + senha, marque "Auto Confirm User").
-- Depois: preencha as 4 variáveis abaixo e execute.
do $$
declare
  v_email    text := 'SEU_EMAIL@exemplo.com';
  v_nome     text := 'Seu Nome';
  v_hospital text := 'Nome do Hospital';
  v_setor    text := 'Nome do Setor';
  v_usuario  uuid;
  v_hosp     uuid;
  v_set      uuid;
begin
  select id into v_usuario from auth.users where lower(email) = lower(trim(v_email));
  if v_usuario is null then
    raise exception 'Usuário % não existe. Crie antes em Authentication → Users → Add user.', v_email;
  end if;

  insert into public.hospital (nome) values (trim(v_hospital))
    on conflict (nome) do update set nome = excluded.nome
    returning id into v_hosp;

  insert into public.setor (hospital_id, nome) values (v_hosp, trim(v_setor))
    on conflict (hospital_id, nome) do update set nome = excluded.nome
    returning id into v_set;

  -- RN02: gestor é papel administrativo, sem categoria/especialidade/conselho (constraint perfil_vinculo_por_papel)
  insert into public.perfil (id, hospital_id, setor_id, papel, nome)
    values (v_usuario, v_hosp, v_set, 'gestor', trim(v_nome))
    on conflict (id) do nothing;

  raise notice 'Pronto: gestor % no setor % (%).', v_nome, v_setor, v_hospital;
end $$;
