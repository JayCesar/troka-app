-- I2 — Leituras com contrato estável para o MCP (e reaproveitáveis pelo front).
-- Todas são SECURITY INVOKER: quem filtra é a RLS existente (RN03, RN29, RN30), sem duplicar regra aqui.
-- Só leitura: nenhuma regra de negócio nova.

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Quem é o usuário do token: o MCP usa para saber o papel e quais tools fazem sentido.
-- ---------------------------------------------------------------------------
create function public.meu_perfil()
returns table (id uuid, nome text, papel public.papel, categoria public.categoria_profissional,
               especialidade text, hospital text, setor text)
language sql stable security invoker set search_path = ''
as $$
  select pf.id, pf.nome, pf.papel, pf.categoria, e.nome, h.nome, s.nome
    from public.perfil pf
    join public.hospital h on h.id = pf.hospital_id
    join public.setor s on s.id = pf.setor_id
    left join public.especialidade e on e.id = pf.especialidade_id
   where pf.id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Plantões do setor num período (RLS: só o setor do usuário, RN03/RN30).
-- p_somente_meus: só os do próprio usuário; p_profissional_id: os de um colega do setor.
-- Traz o anúncio vigente (aberto no prazo ou pendente), se houver.
-- ---------------------------------------------------------------------------
create function public.plantoes_periodo(
  p_de              timestamptz default now(),
  p_ate             timestamptz default now() + interval '30 days',
  p_somente_meus    boolean     default false,
  p_profissional_id uuid        default null
)
returns table (id uuid, inicio timestamptz, fim timestamptz, status text,
               especialidade_id uuid, especialidade text, profissional_id uuid, profissional text,
               anuncio_id uuid, anuncio_status public.status_anuncio, anuncio_urgencia public.urgencia)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if p_de is null or p_ate is null or p_ate <= p_de then
    raise exception using errcode = 'TK422', message = 'Período inválido: o fim deve ser depois do início.';
  end if;
  if p_ate - p_de > interval '93 days' then
    raise exception using errcode = 'TK422', message = 'Período longo demais: consulte no máximo 93 dias por vez.';
  end if;

  return query
  select p.id, p.inicio, p.fim, p.status, p.especialidade_id, e.nome, p.profissional_id, pf.nome,
         a.id, a.status, a.urgencia
    from public.plantao p
    join public.especialidade e on e.id = p.especialidade_id
    left join public.perfil pf on pf.id = p.profissional_id
    left join lateral (
      select an.id, an.status, an.urgencia from public.anuncio an
       where an.plantao_id = p.id
         and (an.status = 'pendente' or (an.status = 'aberto' and an.expira_em > now()))
       limit 1
    ) a on true
   where p.fim > p_de and p.inicio < p_ate
     and (not coalesce(p_somente_meus, false) or p.profissional_id = (select auth.uid()))
     and (p_profissional_id is null or p.profissional_id = p_profissional_id)
   order by p.inicio;
end $$;

-- ---------------------------------------------------------------------------
-- Anúncios vigentes do setor. O motivo vem da tabela anuncio_motivo, cuja RLS
-- só o libera ao gestor e ao anunciante (RN29); para os demais vem null.
-- ---------------------------------------------------------------------------
create function public.anuncios_do_setor()
returns table (id uuid, status public.status_anuncio, urgencia public.urgencia, expira_em timestamptz,
               adicional_valor numeric, plantao_id uuid, inicio timestamptz, fim timestamptz,
               especialidade text, anunciante text, assumido_por text,
               motivo_categoria public.motivo_categoria, motivo_texto text)
language sql stable security invoker set search_path = ''
as $$
  select a.id, a.status, a.urgencia, a.expira_em, a.adicional_valor, p.id, p.inicio, p.fim,
         e.nome, an.nome, ass.nome, m.categoria, m.texto
    from public.anuncio a
    join public.plantao p on p.id = a.plantao_id
    join public.especialidade e on e.id = p.especialidade_id
    join public.perfil an on an.id = a.anunciante_id
    left join public.perfil ass on ass.id = a.assumido_por
    left join public.anuncio_motivo m on m.anuncio_id = a.id
   where a.status = 'pendente' or (a.status = 'aberto' and a.expira_em > now())
   order by a.expira_em;
$$;

-- ---------------------------------------------------------------------------
-- Busca de profissional do setor por nome, sem acento e sem caixa ("julio" acha "Júlio").
-- Serve para o MCP transformar "plantão da Ana" em uuid.
-- ---------------------------------------------------------------------------
create function public.buscar_profissional(p_termo text)
returns table (id uuid, nome text, categoria public.categoria_profissional, especialidade text)
language plpgsql stable security invoker set search_path = ''
as $$
declare v_termo text := trim(coalesce(p_termo, ''));
begin
  if char_length(v_termo) < 2 then
    raise exception using errcode = 'TK422', message = 'Informe ao menos 2 letras do nome.';
  end if;

  return query
  select pf.id, pf.nome, pf.categoria, e.nome
    from public.perfil pf
    left join public.especialidade e on e.id = pf.especialidade_id
   where pf.papel = 'profissional'
     and extensions.unaccent('extensions.unaccent', lower(pf.nome))
         like '%' || extensions.unaccent('extensions.unaccent', lower(v_termo)) || '%'
   order by pf.nome
   limit 20;
end $$;

revoke all on function public.meu_perfil(), public.plantoes_periodo(timestamptz, timestamptz, boolean, uuid),
                       public.anuncios_do_setor(), public.buscar_profissional(text)
  from public, anon;
grant execute on function public.meu_perfil(), public.plantoes_periodo(timestamptz, timestamptz, boolean, uuid),
                          public.anuncios_do_setor(), public.buscar_profissional(text)
  to authenticated;
