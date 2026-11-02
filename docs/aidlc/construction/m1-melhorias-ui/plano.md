# M1 — Melhorias de interface (calendário, assistente, login/cadastro)

Pedido do usuário em 2026-11-03 (3 melhorias + diretrizes). Referências visuais: `exemplos/` (só layout; sem copiar marca de terceiros).

## Decisões (usuário, 2026-11-03)
| # | Decisão |
|---|---|
| D1 | Calendário: **gestor arrasta**; médico só visualiza (RN05, RN06b). |
| D2 | Arraste chama um **serviço isolado** (`moverPlantao`) que já usa a RPC real `editar_plantao`; erro do banco reverte o card. |
| D3 | Item 3 = **redesenhar o login** (visual de `exemplos/login.png`, mobile first) **e o formulário de cadastro do gestor**, mantendo a integração real (Edge Function) isolada num serviço. |

## Decisões técnicas
- `@dnd-kit/core`: arraste por toque, mouse e teclado (acessível); HTML5 nativo não funciona em toque.
- Soltar em **dia + turno** (Diurno 07h / Noturno 19h): muda data e horário, mantém a duração.
- Atualização otimista com reversão; feedback: card fantasma, alvo destacado, card de origem esmaecido, toast com a regra violada.
- Chat: `Sheet` (Radix) existente → foco, Esc e rótulos; resposta da IA via `assistente.ts` (ponto de integração, sem lógica).

## Plano
- [x] Calendário (`/calendario`) + serviço `moverPlantao`
- [x] Botão flutuante + painel do assistente + serviço `assistente`
- [x] Login redesenhado (+ "Esqueceu a senha?" e "Manter-me conectado") e formulário de cadastro com rótulos + serviço `cadastroProfissional`
- [x] tsc + build + testes + checagem via API do arraste
- [x] Audit, state, lista de arquivos e pontos de integração

## Resultado
- tsc, build e teste do front verdes; 178/178 pgTAP inalterados (nenhuma migration nova).
- Via API: mover plantão aberto (ok), sobreposição (RN14, reverte), plantão anunciado (bloqueado, reverte), médico (RN05).
- E-mails de convite e de recuperação de senha em pt-BR (templates em `supabase/templates/`).

## Pontos de integração
| Arquivo | Função | Estado |
|---|---|---|
| `apps/web/src/lib/services/agenda.ts` | `moverPlantao` | ligado à RPC `editar_plantao` |
| `apps/web/src/lib/services/assistente.ts` | `enviarAoAssistente` | **não conectado** (lança `AssistenteNaoConectadoError`; B11) |
| `apps/web/src/lib/services/cadastroProfissional.ts` | `cadastrarProfissional` | ligado à Edge Function `cadastrar-profissional` |
