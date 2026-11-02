-- B4 — Elegibilidade, candidatura, assumir e desistir (RN06c, RN11, RN12, RN12b, RN13, RN14, RN15, RN22b)
-- Decisões automode P1–P6 em docs/aidlc/construction/b4-elegibilidade/plano.md

-- ---------------------------------------------------------------------------
-- Anúncio: quem assumiu (RN22b: um assumidor por vez)
-- ---------------------------------------------------------------------------
alter table public.anuncio
  add column assumido_por uuid references public.perfil (id),
  add column assumido_em  timestamptz,
  add constraint anuncio_assumidor_por_status check (
    (status <> 'aberto' or assumido_por is null) and (status <> 'pendente' or assumido_por is not null)
  );
create index anuncio_assumido_por_idx on public.anuncio (assumido_por) where status = 'pendente';

-- ---------------------------------------------------------------------------
-- Candidatura a plantão aberto (RN06c; aprovação no B5)
-- ---------------------------------------------------------------------------
create type public.status_candidatura as enum ('pendente', 'aprovada', 'recusada', 'desistida', 'cancelada');

create table public.candidatura (
  id              uuid primary key default gen_random_uuid(),
  plantao_id      uuid not null references public.plantao (id) on delete restrict, -- histórico (RN26)
  profissional_id uuid not null references public.perfil (id),
  status          public.status_candidatura not null default 'pendente',
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create unique index candidatura_uma_pendente on public.candidatura (plantao_id, profissional_id) where status = 'pendente';
create index candidatura_profissional_pendente_idx on public.candidatura (profissional_id) where status = 'pendente';

-- ---------------------------------------------------------------------------
-- Avisos (RN11)
-- ---------------------------------------------------------------------------
create table public.aviso (
  id        uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfil (id) on delete cascade,
  texto     text not null,
  link      text,
  lido_em   timestamptz,
  criado_em timestamptz not null default now()
);
create index aviso_perfil_idx on public.aviso (perfil_id, criado_em desc);

create function app.avisar(p_perfis uuid[], p_texto text, p_link text default null) returns void
language sql security definer set search_path = ''
as $$ insert into public.aviso (perfil_id, texto, link) select unnest(p_perfis), p_texto, p_link $$;

create function app.gestores_do_setor(p_setor uuid) returns uuid[]
language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(id), '{}') from public.perfil where setor_id = p_setor and papel = 'gestor' $$;

-- Rótulo legível do plantão para avisos: "Clínico · 05/11 07:00"
create function app.rotulo_plantao(p public.plantao) returns text
language sql stable security definer set search_path = ''
as $$ select e.nome || ' · ' || to_char(p.inicio at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
      from public.especialidade e where e.id = p.especialidade_id $$;

revoke all on function app.avisar(uuid[], text, text), app.gestores_do_setor(uuid), app.rotulo_plantao(public.plantao)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RN12–RN14 com compromissos pendentes (decisão P2).
-- Intervalos ocupados = plantões do profissional + anúncios que ele assumiu (pendentes) + candidaturas pendentes.
-- ---------------------------------------------------------------------------
create or replace function app.motivos_inelegibilidade(
  p_profissional    uuid,
  p_setor           uuid,
  p_especialidade   uuid,
  p_inicio          timestamptz,
  p_fim             timestamptz,
  p_ignorar_plantao uuid default null
) returns text[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_perfil  public.perfil;
  v_motivos text[] := '{}';
begin
  select * into v_perfil from public.perfil where id = p_profissional;
  if not found or v_perfil.papel <> 'profissional' then
    return array['Profissional inexistente.'];
  end if;

  if v_perfil.setor_id <> p_setor then                              -- RN12
    v_motivos := array_append(v_motivos, 'RN12: profissional de outro setor.');
  end if;
  if v_perfil.especialidade_id <> p_especialidade then              -- RN13 / RN12b
    v_motivos := array_append(v_motivos, 'RN13: especialidade diferente da exigida.');
  end if;

  with ocupado as (
    select p.inicio, p.fim from public.plantao p
     where p.profissional_id = p_profissional and p.id is distinct from p_ignorar_plantao
    union all
    select p.inicio, p.fim from public.anuncio a join public.plantao p on p.id = a.plantao_id
     where a.assumido_por = p_profissional and a.status = 'pendente' and p.id is distinct from p_ignorar_plantao
    union all
    select p.inicio, p.fim from public.candidatura c join public.plantao p on p.id = c.plantao_id
     where c.profissional_id = p_profissional and c.status = 'pendente' and p.id is distinct from p_ignorar_plantao
  )
  select case
           when exists (select 1 from ocupado o where o.inicio < p_fim and o.fim > p_inicio)
             then array_append(v_motivos, 'RN14: sobrepõe outro plantão do profissional.')
           when exists (select 1 from ocupado o where o.inicio < p_fim + interval '11 hours' and o.fim > p_inicio - interval '11 hours')
             then array_append(v_motivos, 'RN14: descanso mínimo de 11h não respeitado.')
           else v_motivos
         end
    into v_motivos;

  return v_motivos;
end $$;

-- Motivos para o usuário atual assumir/candidatar-se a um plantão (inclui RN15)
create function app.motivos_para(p_profissional uuid, p public.plantao) returns text[]
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p.profissional_id = p_profissional then
    return array['RN15: você não pode assumir o próprio plantão.'];
  end if;
  return app.motivos_inelegibilidade(p_profissional, p.setor_id, p.especialidade_id, p.inicio, p.fim, p.id);
end $$;
revoke all on function app.motivos_para(uuid, public.plantao) from public, anon, authenticated;

create function app.exigir_profissional() returns public.perfil
language plpgsql stable security definer set search_path = ''
as $$
declare v public.perfil;
begin
  select * into v from public.perfil where id = (select auth.uid());
  if not found or v.papel <> 'profissional' then
    raise exception using errcode = 'TK403', message = 'Ação exclusiva de profissionais.';
  end if;
  return v;
end $$;
revoke all on function app.exigir_profissional() from public, anon, authenticated;

-- Decisão P6: candidatura pendente também trava edição/remoção do plantão
create or replace function app.plantao_editavel(p_id uuid, p_gestor public.perfil) returns public.plantao
language plpgsql security definer set search_path = ''
as $$
declare v public.plantao;
begin
  select * into v from public.plantao where id = p_id and setor_id = p_gestor.setor_id for update;
  if not found then
    raise exception using errcode = 'TK404', message = 'Plantão não encontrado no seu setor.';
  end if;
  if v.inicio <= now() then
    raise exception using errcode = 'TK422', message = 'Plantão já iniciado não pode ser alterado.';
  end if;
  if app.tem_anuncio_em_aberto(p_id) then
    raise exception using errcode = 'TK422', message = 'Plantão com anúncio em aberto não pode ser alterado.';
  end if;
  if exists (select 1 from public.candidatura where plantao_id = p_id and status = 'pendente') then
    raise exception using errcode = 'TK422', message = 'Plantão com candidaturas pendentes não pode ser alterado.';
  end if;
  return v;
end $$;

create or replace function public.remover_plantao(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.perfil := app.exigir_gestor();
begin
  perform app.plantao_editavel(p_id, g);
  if exists (select 1 from public.anuncio where plantao_id = p_id)
     or exists (select 1 from public.candidatura where plantao_id = p_id) then
    raise exception using errcode = 'TK422', message = 'RN26: plantão com histórico de anúncios ou candidaturas não pode ser removido.';
  end if;
  delete from public.plantao where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.candidatura enable row level security;
alter table public.aviso enable row level security;
revoke all on public.candidatura, public.aviso from anon, authenticated;
grant select on public.candidatura, public.aviso to authenticated;

-- P5: candidato e gestão do setor
create policy candidatura_select_restrita on public.candidatura
  for select to authenticated
  using (
    profissional_id = (select auth.uid())
    or ((select app.sou_gestor()) and exists (select 1 from public.plantao p where p.id = candidatura.plantao_id))
  );

create policy aviso_select_proprio on public.aviso
  for select to authenticated
  using (perfil_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RN11: anunciar passa a avisar só os elegíveis
-- ---------------------------------------------------------------------------
create or replace function public.anunciar(
  p_plantao_id       uuid,
  p_urgencia         public.urgencia,
  p_motivo_categoria public.motivo_categoria default null,
  p_motivo_texto     text default null
) returns public.anuncio
language plpgsql security definer set search_path = ''
as $$
declare
  v_plantao public.plantao;
  v_texto   text := nullif(trim(p_motivo_texto), '');
  v         public.anuncio;
begin
  select * into v_plantao from public.plantao where id = p_plantao_id for update;
  if not found or v_plantao.profissional_id is distinct from (select auth.uid()) then
    raise exception using errcode = 'TK403', message = 'RN07: só o profissional dono do plantão pode anunciá-lo.';
  end if;
  if v_plantao.inicio <= now() then
    raise exception using errcode = 'TK422', message = 'RN07: plantão já iniciado não pode ser anunciado.';
  end if;
  if p_urgencia is null then
    raise exception using errcode = 'TK422', message = 'RN09: informe a urgência do anúncio.';
  end if;
  if v_texto is not null and p_motivo_categoria is null then
    raise exception using errcode = 'TK422', message = 'RN09b: informe a categoria do motivo (Saúde, Pessoal ou Outro).';
  end if;
  if char_length(v_texto) > 500 then
    raise exception using errcode = 'TK422', message = 'RN09b: o texto do motivo tem limite de 500 caracteres.';
  end if;

  update public.anuncio set status = 'expirado', atualizado_em = now()
   where plantao_id = v_plantao.id and status = 'aberto' and expira_em <= now();

  if app.tem_anuncio_em_aberto(v_plantao.id) then
    raise exception using errcode = 'TK422', message = 'RN08: este plantão já tem um anúncio em aberto.';
  end if;

  insert into public.anuncio (plantao_id, anunciante_id, urgencia, expira_em)
  values (
    v_plantao.id, v_plantao.profissional_id, p_urgencia,
    least(now() + case p_urgencia when 'urgente' then interval '24 hours' else interval '48 hours' end, v_plantao.inicio)
  )
  returning * into v;

  if p_motivo_categoria is not null then
    insert into public.anuncio_motivo (anuncio_id, categoria, texto) values (v.id, p_motivo_categoria, v_texto);
  end if;

  -- RN11: só profissionais elegíveis do setor são avisados
  perform app.avisar(
    array(select pf.id from public.perfil pf
           where pf.setor_id = v_plantao.setor_id and pf.papel = 'profissional' and pf.id <> v_plantao.profissional_id
             and cardinality(app.motivos_para(pf.id, v_plantao)) = 0),
    case p_urgencia when 'urgente' then 'URGENTE — ' else '' end || 'Novo anúncio: ' || app.rotulo_plantao(v_plantao),
    '/assumir');

  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Assumir / desistir de anúncio (RN12–RN15, RN22b). Aprovação no B5.
-- ---------------------------------------------------------------------------
create function public.assumir_anuncio(p_anuncio_id uuid) returns public.anuncio
language plpgsql security definer set search_path = ''
as $$
declare
  me        public.perfil := app.exigir_profissional();
  v         public.anuncio;
  v_plantao public.plantao;
  v_motivos text[];
begin
  select * into v from public.anuncio where id = p_anuncio_id for update;
  if found then
    select * into v_plantao from public.plantao where id = v.plantao_id;
  end if;
  if not found or v_plantao.setor_id <> me.setor_id then
    raise exception using errcode = 'TK404', message = 'Anúncio não encontrado no seu setor.';
  end if;
  if v.status <> 'aberto' or v.expira_em <= now() or v_plantao.inicio <= now() then
    raise exception using errcode = 'TK422', message = 'Este anúncio não está mais disponível.';
  end if;

  perform 1 from public.perfil where id = me.id for update; -- serializa compromissos do mesmo profissional (RN14)
  v_motivos := app.motivos_para(me.id, v_plantao);
  if cardinality(v_motivos) > 0 then
    raise exception using errcode = 'TK422', message = array_to_string(v_motivos, ' ');
  end if;

  update public.anuncio
     set status = 'pendente', assumido_por = me.id, assumido_em = now(), atualizado_em = now()
   where id = v.id
  returning * into v;

  perform app.avisar(array[v.anunciante_id], me.nome || ' assumiu seu anúncio (' || app.rotulo_plantao(v_plantao) || '). Aguardando aprovação.', '/plantoes');
  perform app.avisar(app.gestores_do_setor(v_plantao.setor_id), 'Troca aguardando aprovação: ' || app.rotulo_plantao(v_plantao), '/gestao');
  return v;
end $$;

create function public.desistir_anuncio(p_anuncio_id uuid) returns public.anuncio
language plpgsql security definer set search_path = ''
as $$
declare
  me        public.perfil := app.exigir_profissional();
  v         public.anuncio;
  v_plantao public.plantao;
begin
  select * into v from public.anuncio where id = p_anuncio_id for update;
  if not found or v.assumido_por is distinct from me.id or v.status <> 'pendente' then
    raise exception using errcode = 'TK403', message = 'RN22b: só quem assumiu pode desistir, e só antes da aprovação.';
  end if;
  select * into v_plantao from public.plantao where id = v.plantao_id;

  -- RN22b: volta a aberto; mantém o prazo original (decisão P3)
  update public.anuncio
     set status = case when expira_em > now() then 'aberto'::public.status_anuncio else 'expirado'::public.status_anuncio end,
         assumido_por = null, assumido_em = null, atualizado_em = now()
   where id = v.id
  returning * into v;

  perform app.avisar(array[v.anunciante_id], me.nome || ' desistiu de assumir seu plantão (' || app.rotulo_plantao(v_plantao) || ').', '/plantoes');
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Candidatura a plantão aberto (RN06c)
-- ---------------------------------------------------------------------------
create function public.candidatar(p_plantao_id uuid) returns public.candidatura
language plpgsql security definer set search_path = ''
as $$
declare
  me        public.perfil := app.exigir_profissional();
  v_plantao public.plantao;
  v_motivos text[];
  v         public.candidatura;
begin
  select * into v_plantao from public.plantao where id = p_plantao_id and setor_id = me.setor_id for update;
  if not found then
    raise exception using errcode = 'TK404', message = 'Plantão não encontrado no seu setor.';
  end if;
  if v_plantao.profissional_id is not null or v_plantao.inicio <= now() then
    raise exception using errcode = 'TK422', message = 'RN06c: o plantão não está em aberto.';
  end if;
  if exists (select 1 from public.candidatura where plantao_id = v_plantao.id and profissional_id = me.id and status = 'pendente') then
    raise exception using errcode = 'TK422', message = 'Você já se candidatou a este plantão.';
  end if;

  perform 1 from public.perfil where id = me.id for update;
  v_motivos := app.motivos_para(me.id, v_plantao);
  if cardinality(v_motivos) > 0 then
    raise exception using errcode = 'TK422', message = array_to_string(v_motivos, ' ');
  end if;

  insert into public.candidatura (plantao_id, profissional_id) values (v_plantao.id, me.id) returning * into v;
  perform app.avisar(app.gestores_do_setor(v_plantao.setor_id), me.nome || ' se candidatou ao plantão ' || app.rotulo_plantao(v_plantao), '/gestao');
  return v;
end $$;

create function public.desistir_candidatura(p_candidatura_id uuid) returns public.candidatura
language plpgsql security definer set search_path = ''
as $$
declare
  me public.perfil := app.exigir_profissional();
  v  public.candidatura;
begin
  update public.candidatura set status = 'desistida', atualizado_em = now()
   where id = p_candidatura_id and profissional_id = me.id and status = 'pendente'
  returning * into v;
  if not found then
    raise exception using errcode = 'TK403', message = 'Candidatura não encontrada ou já decidida.';
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Ofertas para o profissional logado (/assumir): anúncios abertos de colegas + plantões abertos do setor,
-- com os motivos de inelegibilidade (vazio = pode assumir/candidatar-se).
-- ---------------------------------------------------------------------------
create function public.ofertas_para_mim()
returns table (
  tipo          text,      -- 'anuncio' | 'plantao'
  anuncio_id    uuid,
  plantao_id    uuid,
  inicio        timestamptz,
  fim           timestamptz,
  especialidade text,
  urgencia      public.urgencia,
  expira_em     timestamptz,
  anunciante    text,
  motivos       text[],
  ja_candidatei boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me public.perfil := app.exigir_profissional();
begin
  return query
  select 'anuncio', a.id, p.id, p.inicio, p.fim, e.nome, a.urgencia, a.expira_em, an.nome,
         app.motivos_para(me.id, p), false
    from public.anuncio a
    join public.plantao p on p.id = a.plantao_id
    join public.especialidade e on e.id = p.especialidade_id
    join public.perfil an on an.id = a.anunciante_id
   where p.setor_id = me.setor_id and a.status = 'aberto' and a.expira_em > now()
     and p.inicio > now() and a.anunciante_id <> me.id
  union all
  select 'plantao', null, p.id, p.inicio, p.fim, e.nome, null, null, null,
         app.motivos_para(me.id, p),
         exists (select 1 from public.candidatura c where c.plantao_id = p.id and c.profissional_id = me.id and c.status = 'pendente')
    from public.plantao p
    join public.especialidade e on e.id = p.especialidade_id
   where p.setor_id = me.setor_id and p.profissional_id is null and p.inicio > now()
  order by 4;
end $$;

-- Minhas solicitações pendentes (anúncios assumidos + candidaturas), para desistir
create function public.minhas_solicitacoes()
returns table (tipo text, id uuid, plantao_id uuid, inicio timestamptz, fim timestamptz, especialidade text, anunciante text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me public.perfil := app.exigir_profissional();
begin
  return query
  select 'anuncio', a.id, p.id, p.inicio, p.fim, e.nome, an.nome
    from public.anuncio a join public.plantao p on p.id = a.plantao_id
    join public.especialidade e on e.id = p.especialidade_id join public.perfil an on an.id = a.anunciante_id
   where a.assumido_por = me.id and a.status = 'pendente'
  union all
  select 'candidatura', c.id, p.id, p.inicio, p.fim, e.nome, null
    from public.candidatura c join public.plantao p on p.id = c.plantao_id
    join public.especialidade e on e.id = p.especialidade_id
   where c.profissional_id = me.id and c.status = 'pendente'
  order by 4;
end $$;

create function public.marcar_avisos_lidos() returns void
language sql security definer set search_path = ''
as $$ update public.aviso set lido_em = now() where perfil_id = (select auth.uid()) and lido_em is null $$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
revoke all on function public.assumir_anuncio(uuid), public.desistir_anuncio(uuid), public.candidatar(uuid),
                       public.desistir_candidatura(uuid), public.ofertas_para_mim(), public.minhas_solicitacoes(),
                       public.marcar_avisos_lidos()
  from public, anon;
grant execute on function public.assumir_anuncio(uuid), public.desistir_anuncio(uuid), public.candidatar(uuid),
                          public.desistir_candidatura(uuid), public.ofertas_para_mim(), public.minhas_solicitacoes(),
                          public.marcar_avisos_lidos()
  to authenticated;
