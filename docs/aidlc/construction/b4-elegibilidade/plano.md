# B4 — Elegibilidade, candidatura, assumir e desistir

RNs: **RN06c (candidatura; auto-aprovação no B5), RN11, RN12, RN12b, RN13, RN14, RN15, RN22b**.

## Decisões (automode, revisáveis)
| # | Decisão |
|---|---|
| P1 | Plantão aberto aceita várias candidaturas simultâneas; gestor escolhe no B5. Anúncio tem 1 assumidor por vez (RN22b). |
| P2 | RN14 conta também compromissos pendentes (anúncios assumidos pendentes + candidaturas pendentes). |
| P3 | Desistência (RN22b) mantém o prazo original do anúncio; se já venceu, vira `expirado`. |
| P4 | Avisos (RN11): elegíveis ao publicar anúncio; gestão em pendências; anunciante quando assumem/desistem. |
| P5 | Candidaturas visíveis só ao candidato e à gestão do setor (Q11 em aberto). |
| P6 | Plantão com candidatura pendente não é editado/removido. |

## Modelo
- `anuncio` + `assumido_por`, `assumido_em` (aberto ⇒ sem assumidor; pendente ⇒ com assumidor).
- `candidatura` (`plantao_id`, `profissional_id`, `status`: pendente/aprovada/recusada/desistida/cancelada), 1 pendente por profissional/plantão.
- `aviso` (`perfil_id`, `texto`, `link`, `lido_em`) — RLS: só o dono.
- `app.motivos_inelegibilidade` passa a considerar compromissos pendentes (P2).

## RPCs
`assumir_anuncio`, `desistir_anuncio` (RN22b), `candidatar`, `desistir_candidatura`, `ofertas_para_mim` (lista para /assumir com motivos de inelegibilidade), `marcar_avisos_lidos`; `anunciar` passa a avisar elegíveis (RN11).

## Front
- `/assumir` real: ofertas do setor (anúncios + plantões abertos), motivos quando inelegível, assumir/candidatar, "Minhas solicitações" com desistir.
- Sino de notificações real (`aviso`).
- Gestão: anúncio pendente mostra quem assumiu.

## Plano
- [x] Migration + seed + testes pgTAP
- [x] Tipos + front
- [x] Build + checagem via API
- [x] Inventário, audit, state, commit

## Resultado
- 84/84 testes pgTAP (B4: 26), todos verdes de primeira.
- Fluxo via API: ofertas com motivos, assumir → pendente, desistir → aberto, avisos ao anunciante.
- Seed: Marina assumiu o anúncio urgente do Rafael (pendente); Carlos candidato ao plantão Clínico aberto do dia 8.
