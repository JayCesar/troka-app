-- B10 — Cadastro de profissional pelo gestor com validação do conselho (RN01b; RN01, RN02)
-- Decisões automode P1–P6 em docs/aidlc/construction/b10-cadastro/plano.md

-- P4: como o conselho foi validado (null = cadastro anterior ao B10, ex.: seed)
create type public.validacao_conselho as enum ('verificado', 'simulado', 'nao_verificado');
alter table public.perfil
  add column conselho_validacao   public.validacao_conselho,
  add column conselho_validado_em timestamptz;

-- RN01b: UF do conselho precisa ser uma das 27 UFs (o CHECK do B1 só validava o formato)
alter table public.perfil add constraint perfil_conselho_uf_valida check (
  conselho_uf is null or conselho_uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
                                         'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'));

-- P5: um conselho (categoria + UF + número) por pessoa
create unique index perfil_conselho_unico on public.perfil (categoria, conselho_uf, conselho_numero) where papel = 'profissional';

-- ---------------------------------------------------------------------------
-- Chamada só pela Edge Function `cadastrar-profissional` (service_role), DEPOIS de validar o conselho.
-- As regras de vínculo ficam aqui: setor/hospital vêm do gestor; especialidade da categoria (FK composta);
-- CHECK de papel exige conselho + UF (RN01). Papel sempre "profissional" (RN02).
-- ---------------------------------------------------------------------------
create function public.cadastrar_profissional_interno(
  p_gestor_id        uuid,
  p_usuario_id       uuid,
  p_nome             text,
  p_categoria        public.categoria_profissional,
  p_especialidade_id uuid,
  p_conselho_numero  text,
  p_conselho_uf      text,
  p_validacao        public.validacao_conselho
) returns public.perfil
language plpgsql security definer set search_path = ''
as $$
declare
  g public.perfil;
  v public.perfil;
begin
  select * into g from public.perfil where id = p_gestor_id;
  if not found or g.papel <> 'gestor' then
    raise exception using errcode = 'TK403', message = 'RN01: só o gestor cadastra profissionais.';
  end if;
  if p_validacao is null then
    raise exception using errcode = 'TK422', message = 'RN01b: o cadastro exige o resultado da validação do conselho.';
  end if;
  if exists (select 1 from public.perfil where papel = 'profissional' and categoria = p_categoria
               and conselho_uf = upper(p_conselho_uf) and conselho_numero = trim(p_conselho_numero)) then
    raise exception using errcode = 'TK422', message = 'RN01b: este registro de conselho já está cadastrado.';
  end if;

  -- histórico (B8) registra o gestor como autor
  perform set_config('request.jwt.claims', json_build_object('sub', g.id, 'role', 'authenticated')::text, true);

  insert into public.perfil (id, hospital_id, setor_id, papel, nome, categoria, especialidade_id,
                             conselho_numero, conselho_uf, conselho_validacao, conselho_validado_em)
  values (p_usuario_id, g.hospital_id, g.setor_id, 'profissional', trim(p_nome), p_categoria, p_especialidade_id,
          trim(p_conselho_numero), upper(p_conselho_uf), p_validacao, now())
  returning * into v;
  return v;
exception
  when foreign_key_violation then
    raise exception using errcode = 'TK422', message = 'RN01: especialidade inválida para a categoria informada.';
end $$;

revoke all on function public.cadastrar_profissional_interno(uuid, uuid, text, public.categoria_profissional, uuid, text, text, public.validacao_conselho)
  from public, anon, authenticated;
grant execute on function public.cadastrar_profissional_interno(uuid, uuid, text, public.categoria_profissional, uuid, text, text, public.validacao_conselho)
  to service_role;

-- Equipe passa a mostrar o status da validação
drop function public.equipe_do_setor();
create function public.equipe_do_setor()
returns table (id uuid, nome text, categoria public.categoria_profissional, especialidade text, confiavel boolean,
               conselho text, conselho_validacao public.validacao_conselho)
language plpgsql stable security definer set search_path = ''
as $$
declare g public.perfil := app.exigir_gestor();
begin
  return query
  select pf.id, pf.nome, pf.categoria, e.nome, exists (select 1 from public.lista_confianca l where l.profissional_id = pf.id),
         case pf.categoria when 'medico' then 'CRM' else 'COREN' end || ' ' || pf.conselho_numero || '/' || pf.conselho_uf,
         pf.conselho_validacao
    from public.perfil pf join public.especialidade e on e.id = pf.especialidade_id
   where pf.setor_id = g.setor_id and pf.papel = 'profissional'
   order by pf.nome;
end $$;
revoke all on function public.equipe_do_setor() from public, anon;
grant execute on function public.equipe_do_setor() to authenticated;

-- ---------------------------------------------------------------------------
-- Checagem prévia (antes de enviar convite): e-mail livre, especialidade da categoria e conselho livre. null = pode cadastrar.
-- Evita convite reenviado a usuário existente e a compensação apagar alguém que já existia.
-- ---------------------------------------------------------------------------
create function public.cadastro_verificar(
  p_email text, p_categoria public.categoria_profissional, p_especialidade_id uuid, p_conselho_uf text, p_conselho_numero text
) returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when exists (select 1 from auth.users where lower(email) = lower(trim(p_email)))
      then 'Já existe um usuário com este e-mail.'
    when not exists (select 1 from public.especialidade where id = p_especialidade_id and categoria = p_categoria)
      then 'RN01: especialidade inválida para a categoria informada.'
    when exists (select 1 from public.perfil where papel = 'profissional' and categoria = p_categoria
                   and conselho_uf = upper(p_conselho_uf) and conselho_numero = trim(p_conselho_numero))
      then 'RN01b: este registro de conselho já está cadastrado.'
  end
$$;
revoke all on function public.cadastro_verificar(text, public.categoria_profissional, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cadastro_verificar(text, public.categoria_profissional, uuid, text, text) to service_role;
