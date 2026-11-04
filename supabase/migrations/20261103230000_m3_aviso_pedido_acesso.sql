-- M3 — Aviso (sininho) para a gestão quando chega um pedido de acesso da tela pública /cadastro.
-- RN30: só os gestores do hospital do pedido são avisados. O e-mail não vai no texto do aviso
-- (só aparece em Gestão → Aprovações, protegido pela RLS de pedido_acesso).
-- Sem duplicidade: o reenvio pendente cai no `on conflict do nothing` de solicitar_acesso (não há insert),
-- e e-mail já cadastrado nem chega a inserir.

create function app.avisar_pedido_acesso() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.avisar(
    array(select p.id from public.perfil p where p.hospital_id = new.hospital_id and p.papel = 'gestor'),
    'Novo pedido de acesso: ' || new.nome || ' (' ||
      case new.funcao when 'medico' then 'Médico' when 'enfermeiro' then 'Enfermeiro' else 'Gestor' end || ')',
    '/gestao/aprovacoes'
  );
  return null;
end;
$$;
revoke all on function app.avisar_pedido_acesso() from public, anon, authenticated;

create trigger pedido_acesso_avisar_gestao
  after insert on public.pedido_acesso
  for each row execute function app.avisar_pedido_acesso();
