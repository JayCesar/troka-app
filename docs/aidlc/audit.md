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
