# Audit log

## 2026-10-29T02:46:12Z — Inicialização
- Entrada do usuário: "quero criar um projeto ai-dlc"
- Decisão: estrutura AI-DLC agnóstica de stack
- Aprovação: n/a

## 2026-11-02T17:30:00Z — Fase 0 (Reconhecimento)
- Entrada do usuário: prompt TroKa (monorepo React + Supabase, fases 0–3).
- Decisão: rastreio AI-DLC em `docs/aidlc`; Supabase CLI como devDependency.
- Achados: front Lovable = TanStack Start com estado 100% mock (`src/lib/troka.tsx`); sem Supabase/Lovable Cloud.
- Aprovação: aprovado.

## 2026-11-02T17:45:00Z — Fase 1 (Plano)
- Decisões do usuário: SPA + Vercel; remover tudo do Lovable do app; RN01b com validação real no MVP **e** modo de teste sem validação; 1 hospital por profissional (Q6, provisório); ordem de bolts B1–B11 mantida.
- Aprovação: aprovado.

## 2026-11-02T18:05:00Z — Fase 2 (Estrutura e ambiente local)
- Front copiado para `apps/web`, convertido para Vite SPA (sem `@lovable.dev/*`, `@tanstack/react-start`, `nitro`, error-reporting, logo no CDN do Lovable).
- `aidlc-docs/` → `docs/aidlc/`; `regras.md` → `regras-de-negocio.md`.
- Supabase local iniciado (`supabase init` + `start`); `apps/web/.env.local` com URL/anon locais.
- Observação: npm 10.9 falha (`edgesOut`); usar `npx -y npm@11`.
- Aprovação: aprovado.

## 2026-11-02T18:30:00Z — Fase 3 (Inventário)
- Gerado `docs/aidlc/inventario-front.md`: 5 telas, tudo mock; RN coberta 0 · parcial 23 · falta 17.
- Pergunta aberta P1: como plantão aberto (RN06) passa a ter dono.
- Aprovação: pendente.
- Resposta P1 (2026-11-02T18:40:00Z): profissional elegível se candidata a plantão aberto e o gestor aprova; automático se o profissional estiver na lista de confiança do setor (a mesma da RN19b). Nova regra **RN06c** em `regras-de-negocio.md`. Bolts: candidatura no B4 (com elegibilidade), auto-aprovação no B5 (com a lista de confiança).
- Aprovação: aprovado (Fase 3).

## 2026-11-02T19:00:00Z — B1 (Base, Auth e isolamento) — plano
- Plano: `docs/aidlc/construction/b1-base-auth/plano.md`.
- Respostas: P1 A (e-mail+senha), P2 A (gestor só administrativo), P3 A (especialidades globais via migration), P4 A (seed com e-mails do mock + enfermeiros, senha `troka123`).
- Aprovação: aprovado; execução iniciada.
- Execução B1 (2026-11-02T19:40:00Z): migration `20261102183603_b1_base.sql` (hospital, setor, especialidade, perfil, schema `app`, RLS), `seed.sql` (2 hospitais, 6 setores, 15 usuários, senha `troka123`), `supabase/tests/b1_isolamento.test.sql` 16/16. Front: `lib/auth.tsx`, login real, AppShell por `perfil`; mock espelhado por e-mail até B2–B9.
- Aprovação: aprovado pelo usuário (testes manuais ok) em 2026-11-02T19:55:00Z.

## 2026-11-02T20:00:00Z — B2 (Plantões) — plano
- B1 commitado (`246ee54`). Plano B2: `docs/aidlc/construction/b2-plantoes/plano.md`; perguntas em `perguntas.md`.
- Respostas: A em tudo (P1 escala atribuída; P2 RN12–RN15 já no B2; P3 só antes do início; P4 gestor corrige dono; P5 sem limite).
- Aprovação: aprovado; execução iniciada.
- Execução B2 (2026-11-02T20:40:00Z): migration `20261102185142_b2_plantoes.sql` (tabela `plantao`, `app.motivos_inelegibilidade`, trigger de atribuição, RLS, RPCs `criar/editar/remover_plantao`), seed com 20 plantões, `b2_plantoes.test.sql` 20/20 (total 36/36). Front: `/plantoes` real, seção "Plantões do setor" em `/gestao`, `MockOnly` nas telas ainda mock.
- Ajuste pós-feedback: formulário de plantão com data + turno (Diurno/Noturno/Personalizado), resumo, especialidades do setor primeiro.
- Aprovação: aprovado pelo usuário (teste manual ok) em 2026-11-02T21:00:00Z.

## 2026-11-02T21:05:00Z — B3 (Anúncio) — plano
- B2 commitado (`a7691da`). Plano: `docs/aidlc/construction/b3-anuncio/plano.md`; perguntas em `perguntas.md`.
- Respostas: A em tudo (P1 aberto+pendente; P2 500 chars; P3 sem edição; P4 gestor+anunciante; P5 sem antecedência mínima).
- Aprovação: aprovado; execução iniciada.
- Execução B3 (2026-11-02T21:50:00Z): migration `20261102191506_b3_anuncio.sql` (enums, `anuncio`, `anuncio_motivo`, índice RN08, RLS RN29, RPC `anunciar`, bloqueio de edição/remoção de plantão anunciado), seed com 3 anúncios, `b3_anuncio.test.sql` 22/22 (total 58/58). Front: `/anunciar` real, "Pedir cobertura" em `/plantoes`, seção "Anúncios do setor" em `/gestao`.
- Aprovação: aprovado pelo usuário em 2026-11-02T22:00:00Z.

## 2026-11-02T22:00:00Z — Automode autorizado
- Entrada do usuário: "pode comitar e assumir o automode".
- Decisão: seguir B4→B10 sem parar a cada fase; perguntas de plano resolvidas pela opção recomendada e registradas como "decidido em automode (revisável)"; um commit por bolt após `db:test` + build + checagem via API verdes.
- Limites: parar antes do B11 (Q10/Q13/Q14 em aberto) e de qualquer comando de nuvem; parar se surgir decisão sem opção claramente recomendada ou que contrarie uma RN.

## 2026-11-02T22:40:00Z — B4 (Elegibilidade, candidatura, assumir, desistir) — automode
- Decisões automode (revisáveis) P1–P6 em `docs/aidlc/construction/b4-elegibilidade/plano.md`.
- Execução: migration `20261102192424_b4_elegibilidade.sql` (assumidor no anúncio, `candidatura`, `aviso`, RN14 com pendências, RPCs assumir/desistir/candidatar/ofertas/solicitações, RN11 no `anunciar`), seed com troca pendente + candidatura, `b4_elegibilidade.test.sql` 26/26 (total 84/84). Front: `/assumir` real, sino de avisos real.
- Aprovação: automode (commit após testes + build + API verdes).

## 2026-11-02T23:20:00Z — B5 (Aprovação e lista de confiança) — automode
- Decisões automode (revisáveis) P1–P5 em `docs/aidlc/construction/b5-aprovacao/plano.md`.
- Execução: migration `20261102193201_b5_aprovacao.sql` (`lista_confianca`, efetivação com revalidação RN16, auto-aprovação RN19c/RN06c, RPCs aprovar/recusar troca e candidatura, pendências e equipe), seed com lista de confiança, `b5_aprovacao.test.sql` 27/27 (total 111/111). Front: "Aguardando aprovação" real e "Equipe do setor" com lista de confiança.
- Aprovação: automode (commit após testes + build + API verdes).

## 2026-11-02T23:45:00Z — B6 (Adicional) — automode
- Decisões automode (revisáveis) P1–P5 em `docs/aidlc/construction/b6-adicional/plano.md`.
- Execução: migration `20261102193949_b6_adicional.sql` (colunas de adicional, RPC `definir_adicional`, ofertas/pendências com adicional), seed com R$ 250 no anúncio da Juliana, `b6_adicional.test.sql` 12/12 (total 123/123). Front: editor de adicional na gestão, chips em /assumir, /plantoes e pendências.
- Aprovação: automode.

## 2026-11-02T23:55:00Z — B7 (Cancelamento, expiração, alertas) — automode
- Decisões automode (revisáveis) P1–P5 em `docs/aidlc/construction/b7-expiracao/plano.md`.
- Execução: migration `20261102194246_b7_expiracao.sql` (`alerta` + trigger de expiração, auto-resolução ao trocar dono, `cancelar_anuncio`, `resolver_alerta`, `app.expirar_vencidos` + job pg_cron por minuto), `b7_expiracao.test.sql` 19/19 (total 142/142). Front: "Cancelar anúncio" em /plantoes, "Plantões em risco" na gestão.
- Aprovação: automode.
- Validação real do pg_cron (2026-11-02T19:46:00Z): anúncio do Pedro vencido → job expirou, alerta criado, avisos à gestão e ao anunciante, sem chamada manual.
