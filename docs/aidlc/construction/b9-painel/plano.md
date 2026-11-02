# B9 — Painel de gestão

RN: **RN28** (painel: plantões em aberto, anúncios urgentes, a vencer e alertas).

## Decisões (automode, revisáveis)
| # | Decisão |
|---|---|
| P1 | "A vencer" = anúncio aberto que expira nas próximas 6h. |
| P2 | "Em aberto" = plantões futuros do setor sem dono. |
| P3 | Painel com 5 indicadores (abertos, urgentes, a vencer, alertas, pendências) via RPC única; listas destacam urgente/a vencer; painel mock removido. |

## Plano
- [x] Migration `painel_do_setor()` + testes pgTAP
- [x] Front: indicadores no topo da gestão, destaque "vence em Xh" nos anúncios
- [x] Build + checagem via API
- [x] Inventário, audit, state, commit

## Resultado
- 164/164 testes pgTAP (B9: 6).
- Via API: painéis de Ana, Paulo e Helena coerentes com o seed.
