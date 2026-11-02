-- B2 — Plantões (RN04, RN05, RN06) + validação de atribuição (RN12, RN12b, RN13, RN14)
-- Códigos de erro próprios: TK403 sem permissão · TK404 não encontrado (ou de outro setor) · TK422 regra violada

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------
create table public.plantao (
  id               uuid primary key default gen_random_uuid(),
  hospital_id      uuid not null references public.hospital (id),
  setor_id         uuid not null,
  especialidade_id uuid not null references public.especialidade (id),            -- RN04
  inicio           timestamptz not null,
  fim              timestamptz not null,
  profissional_id  uuid references public.perfil (id) on delete restrict,
  -- RN06: aberto (sem profissional) ou atribuído
  status           text generated always as (case when profissional_id is null then 'aberto' else 'atribuido' end) stored,
  criado_por       uuid not null references public.perfil (id),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  foreign key (setor_id, hospital_id) references public.setor (id, hospital_id),  -- RN04
  constraint plantao_fim_apos_inicio check (fim > inicio)                         -- RN04
);

create index plantao_setor_inicio_idx on public.plantao (setor_id, inicio);
create index plantao_profissional_inicio_idx on public.plantao (profissional_id, inicio) where profissional_id is not null;

-- ---------------------------------------------------------------------------
-- Motivos que impedem um profissional de ocupar um intervalo (vazio = pode).
-- Reaproveitada no B4 (elegibilidade para assumir) e no B5 (revalidação, RN16).
-- RN14 considera todos os plantões atuais do profissional, inclusive os recebidos por troca.
-- ---------------------------------------------------------------------------
create function app.motivos_inelegibilidade(
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

  if v_perfil.setor_id <> p_setor then                              -- RN12 (hospital vem junto do setor)
    v_motivos := array_append(v_motivos, 'RN12: profissional de outro setor.');
  end if;
  if v_perfil.especialidade_id <> p_especialidade then              -- RN13 (e RN12b: especialidade é de uma categoria)
    v_motivos := array_append(v_motivos, 'RN13: especialidade diferente da exigida.');
  end if;

  if exists (select 1 from public.plantao o
             where o.profissional_id = p_profissional
               and o.id is distinct from p_ignorar_plantao
               and o.inicio < p_fim and o.fim > p_inicio) then      -- RN14: sobreposição
    v_motivos := array_append(v_motivos, 'RN14: sobrepõe outro plantão do profissional.');
  elsif exists (select 1 from public.plantao o
                where o.profissional_id = p_profissional
                  and o.id is distinct from p_ignorar_plantao
                  and o.inicio < p_fim + interval '11 hours'
                  and o.fim > p_inicio - interval '11 hours') then  -- RN14: descanso mínimo
    v_motivos := array_append(v_motivos, 'RN14: descanso mínimo de 11h não respeitado.');
  end if;

  return v_motivos;
end $$;

revoke all on function app.motivos_inelegibilidade(uuid, uuid, uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: nenhum caminho grava atribuição inválida (RPC, seed, futuras trocas).
-- ---------------------------------------------------------------------------
create function app.plantao_validar() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_motivos text[];
begin
  if tg_op = 'UPDATE' then
    new.atualizado_em := now();
  end if;
  if new.profissional_id is not null then
    -- serializa atribuições concorrentes do mesmo profissional (evita furar RN14 em corrida)
    perform 1 from public.perfil where id = new.profissional_id for update;
    v_motivos := app.motivos_inelegibilidade(new.profissional_id, new.setor_id, new.especialidade_id, new.inicio, new.fim, new.id);
    if cardinality(v_motivos) > 0 then
      raise exception using errcode = 'TK422', message = array_to_string(v_motivos, ' ');
    end if;
  end if;
  return new;
end $$;

create trigger plantao_validar
  before insert or update on public.plantao
  for each row execute function app.plantao_validar();

-- ---------------------------------------------------------------------------
-- RLS: leitura do próprio setor (RN03, RN30). Escrita só pelas RPCs abaixo.
-- ---------------------------------------------------------------------------
alter table public.plantao enable row level security;
revoke all on public.plantao from anon, authenticated;
grant select on public.plantao to authenticated;

create policy plantao_select_mesmo_setor on public.plantao
  for select to authenticated
  using (hospital_id = (select app.meu_hospital()) and setor_id = (select app.meu_setor()));

-- ---------------------------------------------------------------------------
-- RPCs do gestor (RN05). Hospital/setor sempre do perfil de quem chama.
-- ---------------------------------------------------------------------------
create function app.exigir_gestor() returns public.perfil
language plpgsql stable security definer set search_path = ''
as $$
declare v public.perfil;
begin
  select * into v from public.perfil where id = (select auth.uid());
  if not found or v.papel <> 'gestor' then
    raise exception using errcode = 'TK403', message = 'RN05: só o gestor do setor gerencia plantões.';
  end if;
  return v;
end $$;

-- Plantão do setor do gestor, travado para alteração, ainda não iniciado (decisão B2/P3)
create function app.plantao_editavel(p_id uuid, p_gestor public.perfil) returns public.plantao
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
  return v;
end $$;

create function app.validar_intervalo(p_inicio timestamptz, p_fim timestamptz) returns void
language plpgsql immutable
as $$
begin
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception using errcode = 'TK422', message = 'RN04: o fim do plantão deve ser depois do início.';
  end if;
end $$;

revoke all on function app.exigir_gestor(), app.plantao_editavel(uuid, public.perfil), app.validar_intervalo(timestamptz, timestamptz)
  from public, anon, authenticated;

create function public.criar_plantao(
  p_especialidade_id uuid,
  p_inicio           timestamptz,
  p_fim              timestamptz,
  p_profissional_id  uuid default null
) returns public.plantao
language plpgsql security definer set search_path = ''
as $$
declare
  g public.perfil := app.exigir_gestor();
  v public.plantao;
begin
  perform app.validar_intervalo(p_inicio, p_fim);
  insert into public.plantao (hospital_id, setor_id, especialidade_id, inicio, fim, profissional_id, criado_por)
  values (g.hospital_id, g.setor_id, p_especialidade_id, p_inicio, p_fim, p_profissional_id, g.id)
  returning * into v;
  return v;
end $$;

-- Substitui todos os campos editáveis (inclui trocar/remover o profissional — decisão B2/P4)
create function public.editar_plantao(
  p_id               uuid,
  p_especialidade_id uuid,
  p_inicio           timestamptz,
  p_fim              timestamptz,
  p_profissional_id  uuid default null
) returns public.plantao
language plpgsql security definer set search_path = ''
as $$
declare
  g public.perfil := app.exigir_gestor();
  v public.plantao;
begin
  perform app.plantao_editavel(p_id, g);
  perform app.validar_intervalo(p_inicio, p_fim);
  update public.plantao
     set especialidade_id = p_especialidade_id, inicio = p_inicio, fim = p_fim, profissional_id = p_profissional_id
   where id = p_id
  returning * into v;
  return v;
end $$;

create function public.remover_plantao(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.perfil := app.exigir_gestor();
begin
  perform app.plantao_editavel(p_id, g);
  delete from public.plantao where id = p_id;
end $$;

revoke all on function public.criar_plantao(uuid, timestamptz, timestamptz, uuid),
                       public.editar_plantao(uuid, uuid, timestamptz, timestamptz, uuid),
                       public.remover_plantao(uuid)
  from public, anon;
grant execute on function public.criar_plantao(uuid, timestamptz, timestamptz, uuid),
                          public.editar_plantao(uuid, uuid, timestamptz, timestamptz, uuid),
                          public.remover_plantao(uuid)
  to authenticated;
