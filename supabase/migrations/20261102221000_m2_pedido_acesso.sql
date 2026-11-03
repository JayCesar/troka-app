-- M2 — Pedido de acesso pela tela pública /cadastro (RN01: a conta continua sendo criada pelo gestor).
-- Quem não tem conta deixa um pedido para um hospital; a gestão desse hospital vê e decide.
-- Não depende de e-mail: o pedido fica no banco e aparece na gestão.

create table public.pedido_acesso (
  id            uuid primary key default gen_random_uuid(),
  hospital_id   uuid not null references public.hospital (id) on delete cascade,
  nome          text not null check (char_length(nome) between 3 and 120),
  email         text not null check (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  funcao        text not null check (funcao in ('medico', 'enfermeiro', 'gestor')),
  conselho      text check (conselho is null or char_length(conselho) <= 20),
  status        text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  criado_em     timestamptz not null default now(),
  resolvido_em  timestamptz,
  resolvido_por uuid references public.perfil (id)
);
-- Um pedido pendente por e-mail e hospital (reenviar não duplica)
create unique index pedido_acesso_pendente_unico on public.pedido_acesso (hospital_id, lower(email)) where status = 'pendente';
create index pedido_acesso_hospital_idx on public.pedido_acesso (hospital_id, status, criado_em desc);

-- RN30: só a gestão do próprio hospital lê; escrita só pelas RPCs abaixo
alter table public.pedido_acesso enable row level security;
revoke all on public.pedido_acesso from anon, authenticated;
grant select on public.pedido_acesso to authenticated;
create policy pedido_acesso_select_gestor on public.pedido_acesso
  for select to authenticated
  using ((select app.sou_gestor()) and hospital_id = (select app.meu_hospital()));

-- ---------------------------------------------------------------------------
-- Lista pública de hospitais para o formulário (só id e nome; o resto continua protegido pela RLS)
-- ---------------------------------------------------------------------------
create function public.hospitais_para_cadastro()
returns table (id uuid, nome text)
language sql stable security definer set search_path = ''
as $$ select h.id, h.nome from public.hospital h order by h.nome $$;

-- ---------------------------------------------------------------------------
-- Envio do pedido (anônimo). Respostas iguais para e-mail já cadastrado ou pedido repetido,
-- para não revelar quem tem conta. Limite anti-spam: 20 pedidos/hora por hospital.
-- ---------------------------------------------------------------------------
create function public.solicitar_acesso(
  p_hospital_id uuid,
  p_nome        text,
  p_email       text,
  p_funcao      text,
  p_conselho    text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nome  text := trim(coalesce(p_nome, ''));
begin
  if not exists (select 1 from public.hospital where id = p_hospital_id) then
    raise exception using errcode = 'TK422', message = 'Escolha um hospital da lista.';
  end if;
  if char_length(v_nome) < 3 then
    raise exception using errcode = 'TK422', message = 'Informe seu nome completo.';
  end if;
  if v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = 'TK422', message = 'Informe um e-mail válido.';
  end if;
  if p_funcao not in ('medico', 'enfermeiro', 'gestor') then
    raise exception using errcode = 'TK422', message = 'Função inválida.';
  end if;
  if (select count(*) from public.pedido_acesso where hospital_id = p_hospital_id and criado_em > now() - interval '1 hour') >= 20 then
    raise exception using errcode = 'TK429', message = 'Muitos pedidos agora. Tente de novo em alguns minutos.';
  end if;

  -- Já tem conta: não cria pedido (e não revela)
  if exists (select 1 from auth.users where lower(email) = v_email) then
    return;
  end if;

  insert into public.pedido_acesso (hospital_id, nome, email, funcao, conselho)
  values (p_hospital_id, v_nome, v_email, p_funcao, nullif(left(trim(coalesce(p_conselho, '')), 20), ''))
  on conflict (hospital_id, lower(email)) where status = 'pendente' do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gestão decide. Aprovar = o gestor já cadastrou a pessoa (convite RN01/RN01b pela Edge Function).
-- ---------------------------------------------------------------------------
create function public.resolver_pedido_acesso(p_pedido_id uuid, p_aprovar boolean)
returns public.pedido_acesso
language plpgsql security definer set search_path = ''
as $$
declare
  v public.pedido_acesso;
begin
  if not app.sou_gestor() then
    raise exception using errcode = 'TK403', message = 'RN01: só a gestão decide pedidos de acesso.';
  end if;
  update public.pedido_acesso
     set status = case when p_aprovar then 'aprovado' else 'recusado' end,
         resolvido_em = now(),
         resolvido_por = auth.uid()
   where id = p_pedido_id and hospital_id = app.meu_hospital() and status = 'pendente'
  returning * into v;
  if not found then
    raise exception using errcode = 'TK404', message = 'Pedido não encontrado (ou já resolvido) no seu hospital.';
  end if;
  return v;
end;
$$;

revoke all on function public.hospitais_para_cadastro(), public.solicitar_acesso(uuid, text, text, text, text),
  public.resolver_pedido_acesso(uuid, boolean) from public;
grant execute on function public.hospitais_para_cadastro(), public.solicitar_acesso(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.resolver_pedido_acesso(uuid, boolean) to authenticated;
