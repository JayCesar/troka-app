-- B5 — Aprovação manual/automática e lista de confiança (RN06c, RN16, RN19, RN19b, RN19c, RN20, RN20b, RN21)
-- Decisões automode P1–P5 em docs/aidlc/construction/b5-aprovacao/plano.md
-- RN20b: não existe RPC que desfaça troca aprovada; desistência/cancelamento exigem status pendente/aberto.

-- ---------------------------------------------------------------------------
-- Lista de confiança (RN19b): marcação individual por setor, alterável a qualquer momento
-- ---------------------------------------------------------------------------
create table public.lista_confianca (
  profissional_id uuid primary key references public.perfil (id) on delete cascade,
  setor_id        uuid not null references public.setor (id),
  incluido_por    uuid not null references public.perfil (id),
  incluido_em     timestamptz not null default now()
);

alter table public.lista_confianca enable row level security;
revoke all on public.lista_confianca from anon, authenticated;
grant select on public.lista_confianca to authenticated;
-- P5: só a gestão do setor
create policy lista_confianca_select_gestor on public.lista_confianca
  for select to authenticated
  using ((select app.sou_gestor()) and setor_id = (select app.meu_setor()));

create function app.confiavel(p_profissional uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.lista_confianca l join public.perfil p on p.id = l.profissional_id
                 where l.profissional_id = p_profissional and l.setor_id = p.setor_id)
$$;
revoke all on function app.confiavel(uuid) from public, anon, authenticated;

create function public.definir_confianca(p_profissional_id uuid, p_confiavel boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.perfil := app.exigir_gestor();
begin
  if not exists (select 1 from public.perfil where id = p_profissional_id and setor_id = g.setor_id and papel = 'profissional') then
    raise exception using errcode = 'TK404', message = 'Profissional não encontrado no seu setor.';
  end if;
  if p_confiavel then
    insert into public.lista_confianca (profissional_id, setor_id, incluido_por)
    values (p_profissional_id, g.setor_id, g.id) on conflict (profissional_id) do nothing;
  else
    delete from public.lista_confianca where profissional_id = p_profissional_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Efetivação (comum à aprovação manual e automática). RN16: revalida RN12–RN15 no ato.
-- ---------------------------------------------------------------------------
create function app.efetivar_troca(p_anuncio_id uuid, p_auto boolean) returns public.anuncio
language plpgsql security definer set search_path = ''
as $$
declare
  v         public.anuncio;
  v_plantao public.plantao;
  v_motivos text[];
begin
  select * into v from public.anuncio where id = p_anuncio_id for update;
  select * into v_plantao from public.plantao where id = v.plantao_id for update;
  if v.status <> 'pendente' then
    raise exception using errcode = 'TK422', message = 'Esta troca não está aguardando aprovação.';
  end if;
  if v_plantao.inicio <= now() then                                            -- P4
    raise exception using errcode = 'TK422', message = 'Plantão já iniciado: a troca não pode mais ser aprovada.';
  end if;
  v_motivos := app.motivos_para(v.assumido_por, v_plantao);                    -- RN16
  if cardinality(v_motivos) > 0 then
    raise exception using errcode = 'TK422', message = 'RN16: a troca não passa mais nas regras. ' || array_to_string(v_motivos, ' ');
  end if;

  -- RN20: só agora o plantão muda de dono
  update public.plantao set profissional_id = v.assumido_por where id = v_plantao.id;
  update public.anuncio set status = 'aprovado', atualizado_em = now() where id = v.id returning * into v;

  perform app.avisar(array[v.anunciante_id, v.assumido_por],
    'Troca aprovada' || case when p_auto then ' automaticamente' else '' end || ': ' || app.rotulo_plantao(v_plantao), '/plantoes');
  return v;
end $$;

create function app.efetivar_candidatura(p_candidatura_id uuid, p_auto boolean) returns public.candidatura
language plpgsql security definer set search_path = ''
as $$
declare
  v         public.candidatura;
  v_plantao public.plantao;
  v_motivos text[];
  v_outros  uuid[];
begin
  select * into v from public.candidatura where id = p_candidatura_id for update;
  select * into v_plantao from public.plantao where id = v.plantao_id for update;
  if v.status <> 'pendente' then
    raise exception using errcode = 'TK422', message = 'Esta candidatura não está aguardando aprovação.';
  end if;
  if v_plantao.profissional_id is not null then
    raise exception using errcode = 'TK422', message = 'RN06c: o plantão já tem dono.';
  end if;
  if v_plantao.inicio <= now() then
    raise exception using errcode = 'TK422', message = 'Plantão já iniciado: a candidatura não pode mais ser aprovada.';
  end if;
  v_motivos := app.motivos_para(v.profissional_id, v_plantao);                  -- RN16
  if cardinality(v_motivos) > 0 then
    raise exception using errcode = 'TK422', message = 'RN16: a candidatura não passa mais nas regras. ' || array_to_string(v_motivos, ' ');
  end if;

  update public.plantao set profissional_id = v.profissional_id where id = v_plantao.id;
  update public.candidatura set status = 'aprovada', atualizado_em = now() where id = v.id returning * into v;

  -- P3: demais candidaturas pendentes do plantão são recusadas
  with r as (
    update public.candidatura set status = 'recusada', atualizado_em = now()
     where plantao_id = v_plantao.id and status = 'pendente'
    returning profissional_id)
  select coalesce(array_agg(profissional_id), '{}') into v_outros from r;

  perform app.avisar(array[v.profissional_id],
    'Candidatura aprovada' || case when p_auto then ' automaticamente' else '' end || ': ' || app.rotulo_plantao(v_plantao), '/plantoes');
  perform app.avisar(v_outros, 'Plantão preenchido por outro profissional: ' || app.rotulo_plantao(v_plantao), '/assumir');
  return v;
end $$;

revoke all on function app.efetivar_troca(uuid, boolean), app.efetivar_candidatura(uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Assumir / candidatar com aprovação automática (RN19c, RN06c) — avaliada no ato (P1)
-- ---------------------------------------------------------------------------
create or replace function public.assumir_anuncio(p_anuncio_id uuid) returns public.anuncio
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

  perform 1 from public.perfil where id = me.id for update;
  v_motivos := app.motivos_para(me.id, v_plantao);
  if cardinality(v_motivos) > 0 then
    raise exception using errcode = 'TK422', message = array_to_string(v_motivos, ' ');
  end if;

  update public.anuncio
     set status = 'pendente', assumido_por = me.id, assumido_em = now(), atualizado_em = now()
   where id = v.id
  returning * into v;

  -- RN19c: ambos na lista de confiança do setor neste momento → aprovação automática
  if app.confiavel(v.anunciante_id) and app.confiavel(me.id) then
    return app.efetivar_troca(v.id, true);
  end if;

  perform app.avisar(array[v.anunciante_id], me.nome || ' assumiu seu anúncio (' || app.rotulo_plantao(v_plantao) || '). Aguardando aprovação.', '/plantoes');
  perform app.avisar(app.gestores_do_setor(v_plantao.setor_id), 'Troca aguardando aprovação: ' || app.rotulo_plantao(v_plantao), '/gestao');
  return v;
end $$;

create or replace function public.candidatar(p_plantao_id uuid) returns public.candidatura
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

  -- RN06c: profissional na lista de confiança → atribuição automática
  if app.confiavel(me.id) then
    return app.efetivar_candidatura(v.id, true);
  end if;

  perform app.avisar(app.gestores_do_setor(v_plantao.setor_id), me.nome || ' se candidatou ao plantão ' || app.rotulo_plantao(v_plantao), '/gestao');
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Decisão do gestor (RN19, RN21): só o gestor do setor do plantão
-- ---------------------------------------------------------------------------
create function app.anuncio_do_meu_setor(p_anuncio_id uuid, g public.perfil) returns public.anuncio
language plpgsql security definer set search_path = ''
as $$
declare v public.anuncio;
begin
  select a.* into v from public.anuncio a join public.plantao p on p.id = a.plantao_id
   where a.id = p_anuncio_id and p.setor_id = g.setor_id
     for update of a;
  if not found then
    raise exception using errcode = 'TK404', message = 'RN21: troca não encontrada no seu setor.';
  end if;
  return v;
end $$;

create function app.candidatura_do_meu_setor(p_candidatura_id uuid, g public.perfil) returns public.candidatura
language plpgsql security definer set search_path = ''
as $$
declare v public.candidatura;
begin
  select c.* into v from public.candidatura c join public.plantao p on p.id = c.plantao_id
   where c.id = p_candidatura_id and p.setor_id = g.setor_id
     for update of c;
  if not found then
    raise exception using errcode = 'TK404', message = 'RN21: candidatura não encontrada no seu setor.';
  end if;
  return v;
end $$;
revoke all on function app.anuncio_do_meu_setor(uuid, public.perfil), app.candidatura_do_meu_setor(uuid, public.perfil)
  from public, anon, authenticated;

create function public.aprovar_troca(p_anuncio_id uuid) returns public.anuncio
language plpgsql security definer set search_path = ''
as $$
declare g public.perfil := app.exigir_gestor();
begin
  perform app.anuncio_do_meu_setor(p_anuncio_id, g);
  return app.efetivar_troca(p_anuncio_id, false);
end $$;

-- P2: recusa devolve o anúncio a aberto (ou expirado, se o prazo passou)
create function public.recusar_troca(p_anuncio_id uuid) returns public.anuncio
language plpgsql security definer set search_path = ''
as $$
declare
  g         public.perfil := app.exigir_gestor();
  v         public.anuncio := app.anuncio_do_meu_setor(p_anuncio_id, g);
  v_plantao public.plantao;
  v_assumidor uuid := v.assumido_por;
begin
  if v.status <> 'pendente' then
    raise exception using errcode = 'TK422', message = 'Esta troca não está aguardando aprovação.';
  end if;
  select * into v_plantao from public.plantao where id = v.plantao_id;
  update public.anuncio
     set status = case when expira_em > now() then 'aberto'::public.status_anuncio else 'expirado'::public.status_anuncio end,
         assumido_por = null, assumido_em = null, atualizado_em = now()
   where id = v.id and status = 'pendente'
  returning * into v;
  perform app.avisar(array[v_assumidor, v.anunciante_id], 'Troca recusada pela gestão: ' || app.rotulo_plantao(v_plantao), '/plantoes');
  return v;
end $$;

create function public.aprovar_candidatura(p_candidatura_id uuid) returns public.candidatura
language plpgsql security definer set search_path = ''
as $$
declare g public.perfil := app.exigir_gestor();
begin
  perform app.candidatura_do_meu_setor(p_candidatura_id, g);
  return app.efetivar_candidatura(p_candidatura_id, false);
end $$;

create function public.recusar_candidatura(p_candidatura_id uuid) returns public.candidatura
language plpgsql security definer set search_path = ''
as $$
declare
  g public.perfil := app.exigir_gestor();
  v public.candidatura := app.candidatura_do_meu_setor(p_candidatura_id, g);
  v_plantao public.plantao;
begin
  if v.status <> 'pendente' then
    raise exception using errcode = 'TK422', message = 'Esta candidatura não está aguardando aprovação.';
  end if;
  select * into v_plantao from public.plantao where id = v.plantao_id;
  update public.candidatura set status = 'recusada', atualizado_em = now() where id = v.id and status = 'pendente' returning * into v;
  perform app.avisar(array[v.profissional_id], 'Candidatura recusada pela gestão: ' || app.rotulo_plantao(v_plantao), '/assumir');
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Leituras do gestor
-- ---------------------------------------------------------------------------
-- Pendências com revalidação prévia (motivos vazio = aprovação deve passar)
create function public.pendencias_do_setor()
returns table (tipo text, id uuid, plantao_id uuid, inicio timestamptz, fim timestamptz, especialidade text,
               solicitante text, anunciante text, urgencia public.urgencia, solicitado_em timestamptz, motivos text[])
language plpgsql stable security definer set search_path = ''
as $$
declare g public.perfil := app.exigir_gestor();
begin
  return query
  select 'troca', a.id, p.id, p.inicio, p.fim, e.nome, s.nome, an.nome, a.urgencia, a.assumido_em, app.motivos_para(a.assumido_por, p)
    from public.anuncio a join public.plantao p on p.id = a.plantao_id
    join public.especialidade e on e.id = p.especialidade_id
    join public.perfil s on s.id = a.assumido_por join public.perfil an on an.id = a.anunciante_id
   where p.setor_id = g.setor_id and a.status = 'pendente'
  union all
  select 'candidatura', c.id, p.id, p.inicio, p.fim, e.nome, s.nome, null, null, c.criado_em, app.motivos_para(c.profissional_id, p)
    from public.candidatura c join public.plantao p on p.id = c.plantao_id
    join public.especialidade e on e.id = p.especialidade_id join public.perfil s on s.id = c.profissional_id
   where p.setor_id = g.setor_id and c.status = 'pendente'
  order by 4;
end $$;

create function public.equipe_do_setor()
returns table (id uuid, nome text, categoria public.categoria_profissional, especialidade text, confiavel boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare g public.perfil := app.exigir_gestor();
begin
  return query
  select pf.id, pf.nome, pf.categoria, e.nome, exists (select 1 from public.lista_confianca l where l.profissional_id = pf.id)
    from public.perfil pf join public.especialidade e on e.id = pf.especialidade_id
   where pf.setor_id = g.setor_id and pf.papel = 'profissional'
   order by pf.nome;
end $$;

revoke all on function public.definir_confianca(uuid, boolean), public.aprovar_troca(uuid), public.recusar_troca(uuid),
                       public.aprovar_candidatura(uuid), public.recusar_candidatura(uuid),
                       public.pendencias_do_setor(), public.equipe_do_setor()
  from public, anon;
grant execute on function public.definir_confianca(uuid, boolean), public.aprovar_troca(uuid), public.recusar_troca(uuid),
                          public.aprovar_candidatura(uuid), public.recusar_candidatura(uuid),
                          public.pendencias_do_setor(), public.equipe_do_setor()
  to authenticated;

-- Mensagem genérica: exigir_gestor agora protege plantões (RN05) e aprovações (RN21)
create or replace function app.exigir_gestor() returns public.perfil
language plpgsql stable security definer set search_path = ''
as $$
declare v public.perfil;
begin
  select * into v from public.perfil where id = (select auth.uid());
  if not found or v.papel <> 'gestor' then
    raise exception using errcode = 'TK403', message = 'Ação exclusiva do gestor do setor (RN05, RN21).';
  end if;
  return v;
end $$;
