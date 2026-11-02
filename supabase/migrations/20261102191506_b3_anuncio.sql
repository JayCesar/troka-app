-- B3 — Anúncio de troca (RN06b, RN07, RN08, RN09, RN09b, RN09c, RN10, RN29)
-- RN06b: anúncio é o único caminho de troca para profissionais (não existe RPC de troca direta).

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.urgencia as enum ('normal', 'urgente');                     -- RN09c
create type public.motivo_categoria as enum ('saude', 'pessoal', 'outro');     -- RN09b
-- Ciclo de vida completo; as transições entram bolt a bolt (B4 pendente, B5 aprovado/recusado, B7 cancelado/expirado)
create type public.status_anuncio as enum ('aberto', 'pendente', 'aprovado', 'recusado', 'cancelado', 'expirado');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.anuncio (
  id            uuid primary key default gen_random_uuid(),
  plantao_id    uuid not null references public.plantao (id) on delete restrict, -- histórico preservado (RN26)
  anunciante_id uuid not null references public.perfil (id),
  urgencia      public.urgencia not null,                                         -- RN09
  expira_em     timestamptz not null,                                             -- RN10
  status        public.status_anuncio not null default 'aberto',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- RN08 (decisão B3/P1): no máximo um anúncio aberto OU pendente por plantão
create unique index anuncio_um_em_aberto_por_plantao on public.anuncio (plantao_id) where status in ('aberto', 'pendente');
create index anuncio_status_expira_idx on public.anuncio (status, expira_em);

-- RN29: motivo em tabela separada, com RLS própria
create table public.anuncio_motivo (
  anuncio_id uuid primary key references public.anuncio (id) on delete cascade,
  categoria  public.motivo_categoria not null,                                    -- RN09b
  texto      text check (texto is null or char_length(texto) between 1 and 500)  -- RN09b + decisão B3/P2
);

-- ---------------------------------------------------------------------------
-- "Em aberto" efetivo: pendente, ou aberto ainda dentro do prazo.
-- Até o pg_cron do B7, a expiração é preguiçosa (feita ao anunciar de novo).
-- ---------------------------------------------------------------------------
create function app.tem_anuncio_em_aberto(p_plantao uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.anuncio
                 where plantao_id = p_plantao
                   and (status = 'pendente' or (status = 'aberto' and expira_em > now())))
$$;
revoke all on function app.tem_anuncio_em_aberto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.anuncio enable row level security;
alter table public.anuncio_motivo enable row level security;
revoke all on public.anuncio, public.anuncio_motivo from anon, authenticated;
grant select on public.anuncio, public.anuncio_motivo to authenticated;

-- Anúncio visível a quem vê o plantão (RLS de plantao: mesmo hospital e setor, RN03/RN30)
create policy anuncio_select_mesmo_setor on public.anuncio
  for select to authenticated
  using (exists (select 1 from public.plantao p where p.id = anuncio.plantao_id));

-- RN29 + decisão B3/P4: só o anunciante e o gestor do setor
create policy anuncio_motivo_select_restrito on public.anuncio_motivo
  for select to authenticated
  using (exists (
    select 1 from public.anuncio a join public.plantao p on p.id = a.plantao_id
    where a.id = anuncio_motivo.anuncio_id
      and (a.anunciante_id = (select auth.uid())
           or ((select app.sou_gestor()) and p.setor_id = (select app.meu_setor())))
  ));

-- ---------------------------------------------------------------------------
-- RPC: anunciar
-- ---------------------------------------------------------------------------
create function public.anunciar(
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
  -- RN07: só o dono (não revela se o plantão existe para quem não é dono)
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

  -- expiração preguiçosa de anúncio vencido sem ninguém (RN23 completa no B7)
  update public.anuncio set status = 'expirado', atualizado_em = now()
   where plantao_id = v_plantao.id and status = 'aberto' and expira_em <= now();

  if app.tem_anuncio_em_aberto(v_plantao.id) then
    raise exception using errcode = 'TK422', message = 'RN08: este plantão já tem um anúncio em aberto.';
  end if;

  insert into public.anuncio (plantao_id, anunciante_id, urgencia, expira_em)
  values (
    v_plantao.id, v_plantao.profissional_id, p_urgencia,
    -- RN10: 24h urgente / 48h normal, ou até o início, o que vier primeiro
    least(now() + case p_urgencia when 'urgente' then interval '24 hours' else interval '48 hours' end, v_plantao.inicio)
  )
  returning * into v;

  if p_motivo_categoria is not null then
    insert into public.anuncio_motivo (anuncio_id, categoria, texto) values (v.id, p_motivo_categoria, v_texto);
  end if;

  return v;
end $$;

revoke all on function public.anunciar(uuid, public.urgencia, public.motivo_categoria, text) from public, anon;
grant execute on function public.anunciar(uuid, public.urgencia, public.motivo_categoria, text) to authenticated;

-- ---------------------------------------------------------------------------
-- B2/P3 completa: gestor não altera plantão com anúncio em aberto;
-- plantão com histórico de anúncios não é removido (RN26).
-- ---------------------------------------------------------------------------
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
  return v;
end $$;

create or replace function public.remover_plantao(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.perfil := app.exigir_gestor();
begin
  perform app.plantao_editavel(p_id, g);
  if exists (select 1 from public.anuncio where plantao_id = p_id) then
    raise exception using errcode = 'TK422', message = 'RN26: plantão com histórico de anúncios não pode ser removido.';
  end if;
  delete from public.plantao where id = p_id;
end $$;
