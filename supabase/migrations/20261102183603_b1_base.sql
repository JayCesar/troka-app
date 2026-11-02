-- B1 — Base, Auth e isolamento (RN01, RN02, RN03, RN30)

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.papel as enum ('profissional', 'gestor');                 -- RN02
create type public.categoria_profissional as enum ('medico', 'enfermeiro');  -- RN01

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.hospital (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique check (length(trim(nome)) > 0),
  criado_em  timestamptz not null default now()
);

create table public.setor (
  id          uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospital (id) on delete restrict,
  nome        text not null check (length(trim(nome)) > 0),
  criado_em   timestamptz not null default now(),
  unique (hospital_id, nome),
  unique (id, hospital_id) -- alvo da FK composta em perfil
);

-- Catálogo global (decisão B1/P3). Especialidade é de uma categoria só.
create table public.especialidade (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (length(trim(nome)) > 0),
  categoria public.categoria_profissional not null,
  unique (nome, categoria),
  unique (id, categoria) -- alvo da FK composta em perfil
);

-- Um perfil por usuário do Auth. 1 hospital por pessoa (Q6, provisório).
create table public.perfil (
  id               uuid primary key references auth.users (id) on delete cascade,
  hospital_id      uuid not null references public.hospital (id) on delete restrict,
  setor_id         uuid not null,
  papel            public.papel not null,
  nome             text not null check (length(trim(nome)) > 0),
  categoria        public.categoria_profissional,
  especialidade_id uuid,
  conselho_numero  text,
  conselho_uf      char(2),
  criado_em        timestamptz not null default now(),
  -- setor pertence ao hospital do perfil (RN01)
  foreign key (setor_id, hospital_id) references public.setor (id, hospital_id),
  -- especialidade é da mesma categoria do profissional (RN01)
  foreign key (especialidade_id, categoria) references public.especialidade (id, categoria),
  -- gestor é só papel administrativo (decisão B1/P2); profissional exige vínculo completo (RN01)
  -- coalesce: CHECK que avalia NULL é aceito pelo Postgres, então forçamos true/false
  constraint perfil_vinculo_por_papel check (coalesce(
    (papel = 'gestor'
      and categoria is null and especialidade_id is null
      and conselho_numero is null and conselho_uf is null)
    or
    (papel = 'profissional'
      and categoria is not null and especialidade_id is not null
      and length(trim(conselho_numero)) > 0 and conselho_uf ~ '^[A-Z]{2}$'),
    false))
);

create index perfil_hospital_setor_idx on public.perfil (hospital_id, setor_id);

-- ---------------------------------------------------------------------------
-- Funções auxiliares de contexto (schema privado, fora da API REST)
-- security definer: leem perfil sem passar pela RLS (evita recursão nas policies).
-- ---------------------------------------------------------------------------
create schema if not exists app;
grant usage on schema app to authenticated;

create function app.meu_hospital() returns uuid
language sql stable security definer set search_path = ''
as $$ select hospital_id from public.perfil where id = (select auth.uid()) $$;

create function app.meu_setor() returns uuid
language sql stable security definer set search_path = ''
as $$ select setor_id from public.perfil where id = (select auth.uid()) $$;

create function app.sou_gestor() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select papel = 'gestor' from public.perfil where id = (select auth.uid())), false) $$;

revoke all on function app.meu_hospital(), app.meu_setor(), app.sou_gestor() from public, anon;
grant execute on function app.meu_hospital(), app.meu_setor(), app.sou_gestor() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: nega tudo por padrão; só leitura do que a RN permite.
-- Escrita via API bloqueada em todas: papel/vínculo definidos pelo hospital (RN02),
-- cadastro pelo gestor chega no B10 via RPC.
-- ---------------------------------------------------------------------------
alter table public.hospital      enable row level security;
alter table public.setor         enable row level security;
alter table public.especialidade enable row level security;
alter table public.perfil        enable row level security;

revoke all on public.hospital, public.setor, public.especialidade, public.perfil from anon, authenticated;
grant select on public.hospital, public.setor, public.especialidade, public.perfil to authenticated;

-- RN30: só o próprio hospital
create policy hospital_select_proprio on public.hospital
  for select to authenticated
  using (id = (select app.meu_hospital()));

-- RN03: só o próprio setor
create policy setor_select_proprio on public.setor
  for select to authenticated
  using (id = (select app.meu_setor()));

-- Catálogo: visível a qualquer autenticado
create policy especialidade_select_autenticado on public.especialidade
  for select to authenticated
  using (true);

-- RN03 + RN30: perfis do mesmo hospital E setor
create policy perfil_select_mesmo_setor on public.perfil
  for select to authenticated
  using (
    hospital_id = (select app.meu_hospital())
    and setor_id = (select app.meu_setor())
  );

-- ---------------------------------------------------------------------------
-- Catálogo de especialidades (decisão B1/P3)
-- ---------------------------------------------------------------------------
insert into public.especialidade (nome, categoria) values
  ('Intensivista', 'medico'),
  ('Emergencista', 'medico'),
  ('Clínico', 'medico'),
  ('Enfermagem em Terapia Intensiva', 'enfermeiro'),
  ('Enfermagem em Emergência', 'enfermeiro'),
  ('Enfermagem Clínica', 'enfermeiro');
