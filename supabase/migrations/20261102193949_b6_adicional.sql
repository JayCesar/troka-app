-- B6 — Adicional financeiro (RN17, RN17b, RN18). Decisões automode P1–P5 em docs/aidlc/construction/b6-adicional/plano.md

-- RN17b: valor fixo em reais, por anúncio, opcional. RN18: fica no anúncio mesmo após conclusão/expiração.
alter table public.anuncio
  add column adicional_valor        numeric(10, 2) check (adicional_valor is null or adicional_valor > 0),
  add column adicional_definido_por uuid references public.perfil (id),
  add column adicional_definido_em  timestamptz;

-- RN17: só o gestor do setor; P1: só enquanto o anúncio está aberto (depois de assumido, congela)
create function public.definir_adicional(p_anuncio_id uuid, p_valor numeric) returns public.anuncio
language plpgsql security definer set search_path = ''
as $$
declare
  g         public.perfil := app.exigir_gestor();
  v         public.anuncio := app.anuncio_do_meu_setor(p_anuncio_id, g);
  v_plantao public.plantao;
begin
  if v.status <> 'aberto' or v.expira_em <= now() then
    raise exception using errcode = 'TK422', message = 'RN17: o adicional só pode ser definido enquanto o anúncio está em aberto.';
  end if;
  if p_valor is not null and p_valor <= 0 then
    raise exception using errcode = 'TK422', message = 'RN17b: o adicional deve ser um valor em reais maior que zero.';
  end if;

  update public.anuncio
     set adicional_valor = round(p_valor, 2), adicional_definido_por = g.id, adicional_definido_em = now(), atualizado_em = now()
   where id = v.id
  returning * into v;

  -- P4: elegíveis são avisados do adicional (mesma regra da RN11)
  if p_valor is not null then
    select * into v_plantao from public.plantao where id = v.plantao_id;
    perform app.avisar(
      array(select pf.id from public.perfil pf
             where pf.setor_id = v_plantao.setor_id and pf.papel = 'profissional' and pf.id <> v.anunciante_id
               and cardinality(app.motivos_para(pf.id, v_plantao)) = 0),
      'Adicional de R$ ' || to_char(v.adicional_valor, 'FM999G990D00') || ' para cobrir ' || app.rotulo_plantao(v_plantao),
      '/assumir');
  end if;
  return v;
end $$;

revoke all on function public.definir_adicional(uuid, numeric) from public, anon;
grant execute on function public.definir_adicional(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- RN18: adicional visível antes de assumir (ofertas) e na decisão do gestor (pendências).
-- Mudança no tipo de retorno exige drop + create.
-- ---------------------------------------------------------------------------
drop function public.ofertas_para_mim();
create function public.ofertas_para_mim()
returns table (
  tipo          text,
  anuncio_id    uuid,
  plantao_id    uuid,
  inicio        timestamptz,
  fim           timestamptz,
  especialidade text,
  urgencia      public.urgencia,
  expira_em     timestamptz,
  anunciante    text,
  adicional     numeric,
  motivos       text[],
  ja_candidatei boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me public.perfil := app.exigir_profissional();
begin
  return query
  select 'anuncio', a.id, p.id, p.inicio, p.fim, e.nome, a.urgencia, a.expira_em, an.nome, a.adicional_valor,
         app.motivos_para(me.id, p), false
    from public.anuncio a
    join public.plantao p on p.id = a.plantao_id
    join public.especialidade e on e.id = p.especialidade_id
    join public.perfil an on an.id = a.anunciante_id
   where p.setor_id = me.setor_id and a.status = 'aberto' and a.expira_em > now()
     and p.inicio > now() and a.anunciante_id <> me.id
  union all
  select 'plantao', null, p.id, p.inicio, p.fim, e.nome, null, null, null, null,
         app.motivos_para(me.id, p),
         exists (select 1 from public.candidatura c where c.plantao_id = p.id and c.profissional_id = me.id and c.status = 'pendente')
    from public.plantao p
    join public.especialidade e on e.id = p.especialidade_id
   where p.setor_id = me.setor_id and p.profissional_id is null and p.inicio > now()
  order by 4;
end $$;

drop function public.pendencias_do_setor();
create function public.pendencias_do_setor()
returns table (tipo text, id uuid, plantao_id uuid, inicio timestamptz, fim timestamptz, especialidade text,
               solicitante text, anunciante text, urgencia public.urgencia, adicional numeric, solicitado_em timestamptz, motivos text[])
language plpgsql stable security definer set search_path = ''
as $$
declare g public.perfil := app.exigir_gestor();
begin
  return query
  select 'troca', a.id, p.id, p.inicio, p.fim, e.nome, s.nome, an.nome, a.urgencia, a.adicional_valor, a.assumido_em, app.motivos_para(a.assumido_por, p)
    from public.anuncio a join public.plantao p on p.id = a.plantao_id
    join public.especialidade e on e.id = p.especialidade_id
    join public.perfil s on s.id = a.assumido_por join public.perfil an on an.id = a.anunciante_id
   where p.setor_id = g.setor_id and a.status = 'pendente'
  union all
  select 'candidatura', c.id, p.id, p.inicio, p.fim, e.nome, s.nome, null, null, null, c.criado_em, app.motivos_para(c.profissional_id, p)
    from public.candidatura c join public.plantao p on p.id = c.plantao_id
    join public.especialidade e on e.id = p.especialidade_id join public.perfil s on s.id = c.profissional_id
   where p.setor_id = g.setor_id and c.status = 'pendente'
  order by 4;
end $$;

revoke all on function public.ofertas_para_mim(), public.pendencias_do_setor() from public, anon;
grant execute on function public.ofertas_para_mim(), public.pendencias_do_setor() to authenticated;
