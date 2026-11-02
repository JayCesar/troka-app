# TroKa

Troca de plantão hospitalar (médicos e enfermeiros). Monorepo:

| Pasta | O quê |
|---|---|
| `apps/web` | Front: Vite + React + TanStack Router (deploy Vercel) |
| `supabase/migrations` | Banco: única forma de mudar o schema |
| `supabase/functions` | Edge Functions (validação de conselho, assistente IA) |
| `docs/aidlc` | Regras de negócio (RN), requisitos, unidades, decisões, audit |

## Rodar local

Pré-requisitos: Node 22, Docker rodando (`sudo systemctl start docker`).

```bash
npx -y npm@11 install            # npm 10.9 tem bug com estas deps; use npm 11
npm run db:start                 # sobe o Supabase local (Docker)
cp apps/web/.env.example apps/web/.env.local
npm run db:status                # copie API_URL e ANON_KEY para apps/web/.env.local
npm run dev                      # http://localhost:5173
```

| Serviço local | URL |
|---|---|
| Studio (painel do banco) | http://localhost:54323 |
| API | http://127.0.0.1:54321 |
| Mailpit (e-mails de auth) | http://localhost:54324 |

Mudou o banco? Crie migration (`npx supabase migration new <nome>`) e aplique com `npm run db:reset`.
