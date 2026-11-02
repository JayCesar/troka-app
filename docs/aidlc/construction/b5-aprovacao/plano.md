# B5 — Aprovação manual/automática e lista de confiança

RNs: **RN06c (fecha), RN16, RN19, RN19b, RN19c, RN20, RN20b, RN21**.

## Decisões (automode, revisáveis)
| # | Decisão |
|---|---|
| P1 | Auto-aprovação (RN19c/RN06c) avaliada no momento da solicitação; mudanças na lista não afetam pendentes. |
| P2 | Recusa do gestor devolve o anúncio a `aberto` (se no prazo) para outro assumir; encerrar é cancelamento do anunciante (B7). |
| P3 | Aprovar uma candidatura recusa as demais pendentes do mesmo plantão, com aviso. |
| P4 | Não aprova após o início do plantão; elegibilidade revalidada na aprovação (RN16). |
| P5 | Lista de confiança visível só à gestão do setor. |

## Modelo / RPCs
- `lista_confianca (profissional_id PK, setor_id, incluido_por, incluido_em)`; RPC `definir_confianca(profissional, bool)` (RN19b).
- `assumir_anuncio` / `candidatar`: auto-aprovação quando aplicável (RN19c, RN06c).
- `aprovar_troca`, `recusar_troca`, `aprovar_candidatura`, `recusar_candidatura` (RN16, RN19, RN20, RN21).
- `pendencias_do_setor()` (com revalidação prévia), `equipe_do_setor()`.
- RN20b: não existe RPC para desfazer troca aprovada; desistir/cancelar exigem `pendente`/`aberto`.

## Front
- Gestão: **Aguardando aprovação** real (trocas + candidaturas, com aviso se a revalidação já falha) e **Equipe do setor** com chave "Lista de confiança". Remove o "Aguardando aprovação" mock.
- Profissional: toast informa aprovação automática.

## Plano
- [x] Migration + seed + testes pgTAP
- [x] Tipos + front
- [x] Build + checagem via API
- [x] Inventário, audit, state, commit

## Resultado
- 111/111 testes pgTAP (B5: 27).
- Via API: Paulo aprova a troca Rafael→Marina; Carlos (confiável) assume o anúncio da Juliana (confiável) → aprovado na hora; não-gestor não aprova.
- `app.exigir_gestor` com mensagem genérica (RN05, RN21).
