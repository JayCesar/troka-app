# B1 — Base, Auth e isolamento

RNs: **RN01, RN02, RN03, RN30**. Fora do escopo: RN01b (validação CRM/COREN → B10), cadastro pelo gestor (B10), plantões (B2).

## Entregável
Login real no Supabase Auth; cada usuário só enxerga o próprio hospital e setor, garantido pelo banco (RLS) e provado por teste.
As telas continuam com dados mock (trocadas bolt a bolt), mas o **usuário logado** passa a vir do banco.

## Modelo (migration `..._b1_base.sql`)
| Tabela | Campos principais | RN |
|---|---|---|
| `hospital` | `id`, `nome` | RN01, RN30 |
| `setor` | `id`, `hospital_id`, `nome` (único por hospital) | RN01 |
| `especialidade` | `id`, `nome`, `categoria` | RN01 |
| `perfil` | `id` (= `auth.users.id`), `hospital_id`, `setor_id`, `papel` (`profissional`/`gestor`), `categoria` (`medico`/`enfermeiro`), `especialidade_id`, `nome`, `conselho_numero`, `conselho_uf` | RN01, RN02 |

- Constraints: setor pertence ao hospital do perfil (FK composta `(setor_id, hospital_id)`); especialidade da mesma categoria do perfil; profissional exige categoria + especialidade + conselho.
- Funções auxiliares (`security definer`, `stable`): `meu_hospital()`, `meu_setor()`, `sou_gestor()` — usadas por todas as policies dos próximos bolts.

## RLS (deny by default)
| Tabela | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `hospital` | só o próprio (RN30) | ninguém via API |
| `setor` | só o próprio (RN03) | ninguém via API |
| `especialidade` | todos autenticados (catálogo) | ninguém via API |
| `perfil` | mesmo hospital **e** setor (RN03, RN30) | ninguém via API (papel definido pelo hospital, RN02; cadastro vem no B10) |

## Seed (`supabase/seed.sql`, só local)
2 hospitais × 2–3 setores; por setor: 1 gestor, médicos e enfermeiros. Usuários com senha de teste fixa.
Mesmos e-mails do mock (`ana@vilanova.com.br`, `carlos@troka.app`...) para as telas mock continuarem funcionando.

## Front
- `src/lib/auth.tsx`: sessão (`supabase.auth`) + carga do `perfil`.
- `/` (login): e-mail + senha real; erros exibidos.
- `AppShell`: guarda de rota e papel a partir do `perfil`; logout real.
- Tipos gerados: `npx supabase gen types typescript --local > apps/web/src/lib/database.types.ts`.

## Plano
- [x] Responder `perguntas.md`
- [x] Migration do schema + funções auxiliares + RLS
- [x] `seed.sql` com hospitais, setores, especialidades e usuários de teste
- [x] Testes pgTAP (`supabase/tests/b1_isolamento.test.sql`): usuário do hospital A não vê hospital/setor/perfis de B (RN30); profissional não vê perfis de outro setor (RN03); `anon` não vê nada; UPDATE em `papel` bloqueado (RN02)
- [x] `npx supabase db reset` + `npx supabase test db` verdes
- [x] Gerar tipos; login real + AppShell lendo `perfil`
- [x] `npm run build` + teste via API (login/RLS) — teste manual no navegador: com o usuário
- [x] Atualizar `inventario-front.md` (RN01, RN02, RN03, RN30), `audit.md`, `state.md`

## Como você vai conferir
- Studio > Table Editor: `hospital`, `setor`, `perfil` com dados do seed; ícone de cadeado (RLS ativa) em todas.
- Studio > Authentication > Users: usuários de teste.
- App: login com usuário do Santa Clara não mostra nada do Vila Nova.

## Resultado
- 16/16 testes pgTAP verdes. Bug achado pelo teste: CHECK com NULL passava (corrigido com `coalesce(..., false)`).
- Login real e RLS confirmados via API REST com a chave anon.
