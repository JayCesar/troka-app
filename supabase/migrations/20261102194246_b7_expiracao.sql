-- B7 — Cancelamento, expiração (pg_cron) e alertas (RN22, RN23, RN24)
-- Decisões automode P1–P5 em docs/aidlc/construction/b7-expiracao/plano.md

-- ---------------------------------------------------------------------------
-- RN24: alerta de plantão em risco
-- ---------------------------------------------------------------------------
create table public.alerta (
  id            uuid primary key default gen_random_uuid(),
  plantao_id    uuid not null references public.plantao (id) on delete restrict,
  anuncio_id    uuid references public.anuncio (id),
  tipo          text not null default 'plantao_em_risco' check (tipo in ('plantao_em_risco')),
  criado_em     timestamptz not null default now(),
  resolvido_em  timestamptz,
  resolvido_por uuid references public.perfil (id)   -- null + resolvido_em = resolvido automaticamente (P4)
);
create index alerta_aberto_idx on public.alerta (plantao_id) where resolvido_em is null;

alter table public.alerta enable row level security;
revoke all on public.alerta from anon, authenticated;
grant select on public.alerta to authenticated;
-- P5: só a gestão do setor
create policy alerta_select_gestor on public.alerta
  for select to authenticated
  using ((select app.sou_gestor()) and exists (select 1 from public.plantao p where p.id = alerta.plantao_id));

-- P3: qualquer transição de anúncio para "expirado" gera alerta e avisos
create function app.anuncio_expirado_alerta() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_plantao public.plantao;
begin
  select * into v_plantao from public.plantao where id = new.plantao_id;
  insert into public.alerta (plantao_id, anuncio_id) values (new.plantao_id, new.id);
  perform app.avisar(app.gestores_do_setor(v_plantao.setor_id), 'Plantão em risco: anúncio expirou sem cobertura — ' || app.rotulo_plantao(v_plantao), '/gestao');
  perform app.avisar(array[new.anunciante_id], 'Seu anúncio expirou sem cobertura: ' || app.rotulo_plantao(v_plantao) || '. A gestão foi alertada.', '/plantoes');
  return new;
end $$;

create trigger anuncio_expirado_alerta
  after update of status on public.anuncio
  for each row when (new.status = 'expirado' and old.status is distinct from 'expirado')
  execute function app.anuncio_expirado_alerta();

-- P4: plantão que muda de dono resolve os alertas abertos
create function app.plantao_resolve_alertas() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.alerta set resolvido_em = now() where plantao_id = new.id and resolvido_em is null;
  return new;
end $$;

create trigger plantao_resolve_alertas
  after update of profissional_id on public.plantao
  for each row when (new.profissional_id is distinct from old.profissional_id)
  execute function app.plantao_resolve_alertas();

create function public.resolver_alerta(p_alerta_id uuid) returns public.alerta
language plpgsql security definer set search_path = ''
as $$
declare
  g public.perfil := app.exigir_gestor();
  v public.alerta;
begin
  update public.alerta a set resolvido_em = now(), resolvido_por = g.id
    from public.plantao p
   where a.id = p_alerta_id and p.id = a.plantao_id and p.setor_id = g.setor_id and a.resolvido_em is null
  returning a.* into v;
  if not found then
    raise exception using errcode = 'TK404', message = 'Alerta não encontrado (ou já resolvido) no seu setor.';
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- RN22: quem anunciou cancela antes da aprovação (P1: aberto ou pendente). RN20b: aprovado não.
-- ---------------------------------------------------------------------------
create function public.cancelar_anuncio(p_anuncio_id uuid) returns public.anuncio
language plpgsql security definer set search_path = ''
as $$
declare
  me          public.perfil := app.exigir_profissional();
  v           public.anuncio;
  v_plantao   public.plantao;
  v_assumidor uuid;
begin
  select * into v from public.anuncio where id = p_anuncio_id for update;
  if not found or v.anunciante_id <> me.id then
    raise exception using errcode = 'TK403', message = 'RN22: só quem anunciou pode cancelar.';
  end if;
  if v.status not in ('aberto', 'pendente') then
    raise exception using errcode = 'TK422', message = 'RN22/RN20b: só é possível cancelar antes da aprovação.';
  end if;
  v_assumidor := v.assumido_por;
  select * into v_plantao from public.plantao where id = v.plantao_id;

  update public.anuncio set status = 'cancelado', atualizado_em = now() where id = v.id returning * into v;

  if v_assumidor is not null then
    perform app.avisar(array[v_assumidor], 'Anúncio cancelado por quem anunciou: ' || app.rotulo_plantao(v_plantao), '/assumir');
    perform app.avisar(app.gestores_do_setor(v_plantao.setor_id), 'Troca pendente cancelada pelo anunciante: ' || app.rotulo_plantao(v_plantao), '/gestao');
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- RN23 (P2): expiração periódica
-- ---------------------------------------------------------------------------
create function app.expirar_vencidos() returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  -- aberto vencido (ninguém assumiu no prazo)
  update public.anuncio set status = 'expirado', atualizado_em = now()
   where status = 'aberto' and expira_em <= now();
  get diagnostics n = row_count;

  -- pendente sem decisão até o início do plantão
  update public.anuncio a set status = 'expirado', atualizado_em = now()
    from public.plantao p
   where p.id = a.plantao_id and a.status = 'pendente' and p.inicio <= now();

  -- candidaturas pendentes de plantões já iniciados
  update public.candidatura c set status = 'cancelada', atualizado_em = now()
    from public.plantao p
   where p.id = c.plantao_id and c.status = 'pendente' and p.inicio <= now();

  return n;
end $$;
revoke all on function app.expirar_vencidos() from public, anon, authenticated;

-- A expiração preguiçosa do `anunciar` (B3) continua; agora o trigger gera o alerta em qualquer caminho.
create extension if not exists pg_cron;
select cron.schedule('troka-expirar-vencidos', '* * * * *', 'select app.expirar_vencidos()');

revoke all on function public.cancelar_anuncio(uuid), public.resolver_alerta(uuid) from public, anon;
grant execute on function public.cancelar_anuncio(uuid), public.resolver_alerta(uuid) to authenticated;
