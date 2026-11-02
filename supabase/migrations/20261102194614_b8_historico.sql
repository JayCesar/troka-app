-- B8 — Histórico imutável e CSV (RN25, RN26, RN27). Decisões automode P1–P5 em docs/aidlc/construction/b8-historico/plano.md

create table public.historico (
  id          bigint generated always as identity primary key,
  ocorrido_em timestamptz not null default now(),
  hospital_id uuid not null,
  setor_id    uuid not null,
  ator_id     uuid,          -- null = Sistema (pg_cron, seed). Sem FK: o registro sobrevive a qualquer remoção.
  entidade    text not null, -- tabela de origem
  entidade_id uuid,
  acao        text not null check (acao in ('insert', 'update', 'delete')),
  plantao_id  uuid,          -- contexto (sem FK, pelo mesmo motivo)
  resumo      text not null,
  antes       jsonb,
  depois      jsonb
);
create index historico_setor_idx on public.historico (setor_id, ocorrido_em desc);

-- ---------------------------------------------------------------------------
-- RN26: nunca editado nem apagado — vale para qualquer papel, inclusive postgres/service_role
-- ---------------------------------------------------------------------------
create function app.historico_imutavel() returns trigger
language plpgsql
as $$
begin
  raise exception using errcode = 'TK423', message = 'RN26: o histórico nunca é editado nem apagado.';
end $$;

create trigger historico_imutavel before update or delete on public.historico
  for each row execute function app.historico_imutavel();
create trigger historico_sem_truncate before truncate on public.historico
  for each statement execute function app.historico_imutavel();

-- P3: leitura só pela gestão do setor; escrita só pelos triggers
alter table public.historico enable row level security;
revoke all on public.historico from anon, authenticated;
grant select on public.historico to authenticated;
create policy historico_select_gestor on public.historico
  for select to authenticated
  using ((select app.sou_gestor()) and setor_id = (select app.meu_setor()) and hospital_id = (select app.meu_hospital()));

-- ---------------------------------------------------------------------------
-- RN25: toda mudança é registrada (trigger genérico)
-- ---------------------------------------------------------------------------
create function app.nome(p uuid) returns text
language sql stable security definer set search_path = ''
-- null entra, null sai (para o coalesce do resumo funcionar); id desconhecido vira '—'
as $$ select case when p is null then null else coalesce((select nome from public.perfil where id = p), '—') end $$;

create function app.resumo_historico(t text, op text, a jsonb, d jsonb) returns text
language plpgsql stable security definer set search_path = ''
as $$
begin
  return case t
    when 'plantao' then case op
      when 'INSERT' then 'Plantão criado' || coalesce(' para ' || app.nome((d->>'profissional_id')::uuid), ' (em aberto)')
      when 'DELETE' then 'Plantão removido'
      else case when a->>'profissional_id' is distinct from d->>'profissional_id'
                then 'Plantão mudou de dono: ' || coalesce(app.nome((a->>'profissional_id')::uuid), 'em aberto') || ' → ' || coalesce(app.nome((d->>'profissional_id')::uuid), 'em aberto')
                else 'Plantão editado' end end
    when 'anuncio' then case op
      when 'INSERT' then 'Anúncio publicado por ' || app.nome((d->>'anunciante_id')::uuid) || ' (' || (d->>'urgencia') || ')'
      else case
        when a->>'status' is distinct from d->>'status'
          then 'Anúncio: ' || (a->>'status') || ' → ' || (d->>'status')
               || coalesce(' (' || app.nome((d->>'assumido_por')::uuid) || ')', '')
        when a->>'adicional_valor' is distinct from d->>'adicional_valor'
          then coalesce('Adicional definido: R$ ' || replace(d->>'adicional_valor', '.', ','), 'Adicional removido')   -- RN18
        else 'Anúncio atualizado' end end
    when 'anuncio_motivo' then 'Motivo registrado: ' || (d->>'categoria')
    when 'candidatura' then case op
      when 'INSERT' then 'Candidatura de ' || app.nome((d->>'profissional_id')::uuid)
      else 'Candidatura de ' || app.nome((d->>'profissional_id')::uuid) || ': ' || (a->>'status') || ' → ' || (d->>'status') end
    when 'lista_confianca' then case op
      when 'INSERT' then app.nome((d->>'profissional_id')::uuid) || ' incluído(a) na lista de confiança'
      when 'DELETE' then app.nome((a->>'profissional_id')::uuid) || ' removido(a) da lista de confiança'
      else 'Lista de confiança alterada' end
    when 'alerta' then case op
      when 'INSERT' then 'Alerta: plantão em risco'
      else case when a->>'resolvido_em' is null and d->>'resolvido_em' is not null
                then 'Alerta resolvido' || case when d->>'resolvido_por' is null then ' automaticamente' else '' end
                else 'Alerta atualizado' end end
    when 'perfil' then case op
      when 'INSERT' then 'Perfil cadastrado: ' || (d->>'nome')
      when 'DELETE' then 'Perfil removido: ' || (a->>'nome')
      else 'Perfil alterado: ' || (d->>'nome') end
    else t || ' ' || lower(op)
  end;
end $$;

create function app.registrar_historico() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_antes    jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_depois   jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r          jsonb := coalesce(v_depois, v_antes);
  v_plantao  uuid;
  v_setor    uuid;
  v_hospital uuid;
begin
  v_plantao := case tg_table_name
    when 'plantao' then (r->>'id')::uuid
    when 'anuncio_motivo' then (select plantao_id from public.anuncio where id = (r->>'anuncio_id')::uuid)
    else (r->>'plantao_id')::uuid end;

  if v_plantao is not null then
    select setor_id, hospital_id into v_setor, v_hospital from public.plantao where id = v_plantao;
  end if;
  v_setor := coalesce(v_setor, (r->>'setor_id')::uuid);     -- plantão removido, perfil, lista_confianca
  v_hospital := coalesce(v_hospital, (r->>'hospital_id')::uuid, (select hospital_id from public.setor where id = v_setor));

  insert into public.historico (hospital_id, setor_id, ator_id, entidade, entidade_id, acao, plantao_id, resumo, antes, depois)
  values (v_hospital, v_setor, (select auth.uid()), tg_table_name,
          coalesce((r->>'id')::uuid, (r->>'anuncio_id')::uuid, (r->>'profissional_id')::uuid),
          lower(tg_op), v_plantao, app.resumo_historico(tg_table_name, tg_op, v_antes, v_depois), v_antes, v_depois);
  return null;
end $$;

revoke all on function app.nome(uuid), app.resumo_historico(text, text, jsonb, jsonb), app.registrar_historico(), app.historico_imutavel()
  from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['plantao', 'anuncio', 'anuncio_motivo', 'candidatura', 'lista_confianca', 'alerta', 'perfil'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function app.registrar_historico()',
                   t || '_historico', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Leitura legível para a gestão (tela e CSV, RN27)
-- ---------------------------------------------------------------------------
create function public.historico_do_setor(p_limite int default 200)
returns table (ocorrido_em timestamptz, ator text, entidade text, resumo text, plantao text)
language plpgsql stable security definer set search_path = ''
as $$
declare g public.perfil := app.exigir_gestor();
begin
  return query
  select h.ocorrido_em,
         case when h.ator_id is null then 'Sistema' else app.nome(h.ator_id) end,
         h.entidade, h.resumo,
         (select app.rotulo_plantao(p) from public.plantao p where p.id = h.plantao_id)
    from public.historico h
   where h.setor_id = g.setor_id and h.hospital_id = g.hospital_id
   order by h.ocorrido_em desc, h.id desc
   limit p_limite;
end $$;

revoke all on function public.historico_do_setor(int) from public, anon;
grant execute on function public.historico_do_setor(int) to authenticated;
