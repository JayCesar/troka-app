-- B9 — Painel de gestão (RN28). Decisões automode P1–P3 em docs/aidlc/construction/b9-painel/plano.md

create function public.painel_do_setor()
returns table (em_aberto int, urgentes int, a_vencer int, alertas int, pendencias int)
language plpgsql stable security definer set search_path = ''
as $$
declare g public.perfil := app.exigir_gestor();
begin
  return query
  select
    -- P2: plantões futuros sem dono
    (select count(*)::int from public.plantao p
      where p.setor_id = g.setor_id and p.profissional_id is null and p.inicio > now()),
    -- anúncios urgentes ainda em aberto
    (select count(*)::int from public.anuncio a join public.plantao p on p.id = a.plantao_id
      where p.setor_id = g.setor_id and a.urgencia = 'urgente'
        and (a.status = 'pendente' or (a.status = 'aberto' and a.expira_em > now()))),
    -- P1: abertos que vencem nas próximas 6h
    (select count(*)::int from public.anuncio a join public.plantao p on p.id = a.plantao_id
      where p.setor_id = g.setor_id and a.status = 'aberto'
        and a.expira_em > now() and a.expira_em <= now() + interval '6 hours'),
    -- RN24: alertas não resolvidos
    (select count(*)::int from public.alerta l join public.plantao p on p.id = l.plantao_id
      where p.setor_id = g.setor_id and l.resolvido_em is null),
    -- trocas e candidaturas aguardando decisão
    (select count(*)::int from public.anuncio a join public.plantao p on p.id = a.plantao_id
      where p.setor_id = g.setor_id and a.status = 'pendente')
    + (select count(*)::int from public.candidatura c join public.plantao p on p.id = c.plantao_id
      where p.setor_id = g.setor_id and c.status = 'pendente');
end $$;

revoke all on function public.painel_do_setor() from public, anon;
grant execute on function public.painel_do_setor() to authenticated;
