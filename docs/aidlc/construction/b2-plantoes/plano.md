# B2 — Plantões

RNs: **RN04, RN05, RN06**. Fora do escopo: anúncio (B3), candidatura a plantão aberto (B4, RN06c), elegibilidade completa (B4), histórico (B8).

## Entregável
Gestor cria, edita e remove plantões do próprio setor pelo app; profissional vê os seus plantões vindos do banco.
Toda regra no banco (RPC + constraints); RLS estende o isolamento do B1 à nova tabela.

## Modelo (migration `..._b2_plantoes.sql`)
| Campo | Regra |
|---|---|
| `plantao.id`, `hospital_id`, `setor_id` | FK composta `(setor_id, hospital_id)` → setor do hospital (RN04) |
| `especialidade_id` | obrigatória (RN04); a categoria vem da especialidade |
| `inicio`, `fim` (`timestamptz`) | `check (fim > inicio)` (RN04) |
| `profissional_id` (nullable) | null = **aberto**, preenchido = **atribuído** (RN06); coluna gerada `status` |
| `criado_por`, `criado_em`, `atualizado_em` | rastreio básico (histórico completo no B8) |

Trigger de integridade ao atribuir: profissional do **mesmo setor**, papel `profissional`, **especialidade idêntica** (RN12, RN12b, RN13) + o que for decidido em P2.

## RPCs (escrita só por função; RLS sem INSERT/UPDATE/DELETE direto)
| Função | Quem | RN |
|---|---|---|
| `criar_plantao(especialidade, inicio, fim, profissional?)` | gestor do setor | RN04, RN05, RN06 |
| `editar_plantao(id, ...)` | gestor do setor | RN05 |
| `remover_plantao(id)` | gestor do setor | RN05 |

Setor/hospital vêm sempre do perfil do gestor (nunca do front). Erros com mensagem legível (`raise exception` com código próprio).

## RLS (leitura)
- Profissional e gestor veem plantões do **próprio setor** (RN03/RN30) — abertos e atribuídos.

## Seed
~20 plantões nas próximas 2 semanas (datas relativas ao `db reset`), abertos e atribuídos, em 2 setores de cada hospital.

## Front
- `/plantoes`: meus plantões vindos do banco (React Query).
- `/gestao`: nova seção **Plantões do setor** com lista, criar, editar e remover (formulário com especialidade, início, fim, profissional opcional).
- `/assumir` e `/anunciar` continuam mock até B3/B4.
- Novo `PlantaoCard` para plantões do banco (`ShiftCard` fica só para as telas mock).

## Plano
- [x] Responder `perguntas.md`
- [x] Migration: tabela, constraints, trigger de atribuição, RLS, RPCs
- [x] Seed de plantões
- [x] Testes pgTAP `b2_plantoes.test.sql`: fim ≤ início falha (RN04); profissional não cria (RN05); gestor de outro setor não cria/edita/remove (RN05); atribuição a profissional de outro setor/especialidade falha; leitura isolada por setor
- [x] `db reset` + `test db` verdes (inclui B1)
- [x] Tipos + `/plantoes` real + CRUD em `/gestao`
- [x] Build + teste via API — teste manual no navegador: com o usuário
- [x] Atualizar inventário, audit, state

## Como você vai conferir
- Studio > Table Editor > `plantao`: plantões do seed, coluna `status` aberto/atribuido.
- App como Ana (gestora Clínica Médica VN): criar, editar e remover; tentar fim antes do início → erro.
- App como Carlos: os plantões dele aparecem em Meus plantões.

## Resultado
- 36/36 testes pgTAP (B1 16 + B2 20).
- Bugs achados pelos testes/API e corrigidos na própria migration (ainda só local):
  - `text[] || 'literal'` tratava o literal como array → validação quebrava; trocado por `array_append`.
  - faltava FK `plantao.hospital_id → hospital` (embed `hospital(nome)` falhava na API).
- Script novo: `npm run db:types` (gera + formata tipos) e `npm run db:test`.
