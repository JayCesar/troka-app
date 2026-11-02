# TroKa — regras do projeto

## Estrutura
- `apps/web` front (Vite SPA, Vercel) · `supabase/migrations` banco · `supabase/functions` Edge Functions · `docs/aidlc` regras, requisitos, unidades, decisões, `audit.md`, `state.md`.
- Fonte da verdade: `docs/aidlc/regras-de-negocio.md`. **Cite regras por ID** (RN01, RN14...).

## Regras
- **Plano antes de código**: proponha plano com checkboxes, espere aprovação, depois execute. Um bolt por vez; registre decisões em `docs/aidlc/audit.md`.
- **Regra de negócio no banco** (funções RPC + RLS + constraints), nunca só no front. O front só exibe e chama RPC.
- **Banco só via migration** em `supabase/migrations`, aplicada local com `npx supabase db reset`. Nunca alterar schema pelo Studio/painel.
- **Primeiro local, depois nuvem**. Nunca rodar `supabase link`, `db push` ou `functions deploy` sem pedido explícito.
- **Nunca service_role no front** nem no chat; front usa só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Nenhum `.env*` commitado.
- Antes de comando Supabase, explique em 1–2 linhas o que faz.
- Ao fim de cada etapa, diga como conferir no Studio local (http://localhost:54323).
- `lovable/` é só origem de referência: não alterar.
- Validação CRM/COREN (RN01b): secret `CONSELHO_VALIDACAO` da Edge Function (`desligada` | `simulada` | `real`), nunca flag no front.
- Testes de regra: pgTAP em `supabase/tests` (`npm run db:test`); toda RPC nova ganha teste.

## Economia de tokens
- Não ler `node_modules`, `dist`, `.git`, lockfiles, assets.
- Ler por amostragem: estrutura primeiro, conteúdo só do necessário.
- Respostas curtas, tabelas/listas; mostrar só trechos alterados.
- npm: usar `npx -y npm@11` (npm 10.9 quebra com `edgesOut`).
