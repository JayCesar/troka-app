-- M4 — Gestor corrige nome e especialidade de um profissional do próprio setor (RN01, RN03, RN13).
-- Categoria e CRM/COREN ficam de fora: mudar o conselho exige nova validação (RN01b, Edge Function).
-- O histórico (B8) registra a alteração automaticamente (trigger perfil_historico, ator = gestor).

create function public.editar_profissional(p_id uuid, p_nome text, p_especialidade_id uuid)
returns public.perfil
language plpgsql security definer set search_path = ''
as $$
declare
  g    public.perfil := app.exigir_gestor();
  v    public.perfil;
  v_nome text := trim(coalesce(p_nome, ''));
begin
  -- RN03/RN30: só profissional do setor do gestor (fora dele = "não encontrado", sem revelar)
  select * into v from public.perfil
   where id = p_id and setor_id = g.setor_id and papel = 'profissional'
   for update;
  if not found then
    raise exception using errcode = 'TK404', message = 'Profissional não encontrado no seu setor.';
  end if;

  if char_length(v_nome) < 3 or char_length(v_nome) > 120 then
    raise exception using errcode = 'TK422', message = 'Informe o nome completo (3 a 120 caracteres).';
  end if;
  if p_especialidade_id is null then
    raise exception using errcode = 'TK422', message = 'Escolha a especialidade.';
  end if;

  -- RN13: especialidade idêntica à do plantão. Não troca com compromissos pendentes na especialidade antiga.
  if p_especialidade_id <> v.especialidade_id then
    if exists (select 1 from public.plantao where profissional_id = v.id and fim > now()) then
      raise exception using errcode = 'TK409',
        message = 'RN13: há plantões futuros na especialidade atual. Reatribua-os antes de trocar a especialidade.';
    end if;
    if exists (select 1 from public.candidatura where profissional_id = v.id and status = 'pendente')
       or exists (select 1 from public.anuncio where assumido_por = v.id and status in ('aberto', 'pendente')) then
      raise exception using errcode = 'TK409',
        message = 'RN13: há candidaturas ou trocas em andamento. Resolva-as antes de trocar a especialidade.';
    end if;
  end if;

  update public.perfil
     set nome = v_nome, especialidade_id = p_especialidade_id
   where id = v.id
  returning * into v;
  return v;
exception
  when foreign_key_violation then -- FK composta (especialidade_id, categoria) do RN01
    raise exception using errcode = 'TK422', message = 'RN01: especialidade inválida para a categoria do profissional.';
end $$;

revoke all on function public.editar_profissional(uuid, text, uuid) from public, anon;
grant execute on function public.editar_profissional(uuid, text, uuid) to authenticated;
