# B7 — Cancelamento, expiração (pg_cron) e alertas

RNs: **RN22, RN23, RN24**.

## Decisões (automode, revisáveis)
| # | Decisão |
|---|---|
| P1 | Anunciante cancela anúncio aberto ou pendente (RN22); se pendente, avisa assumidor e gestão. |
| P2 | Job pg_cron a cada minuto: expira anúncios abertos vencidos (RN23); pendente sem decisão até o início do plantão também expira; candidaturas pendentes de plantão iniciado viram canceladas. |
| P3 | Alerta "plantão em risco" (RN24) criado por trigger em qualquer transição para `expirado`; avisa gestão e anunciante. |
| P4 | Alerta resolvido pelo gestor ou automaticamente quando o plantão muda de dono. |
| P5 | Alertas visíveis só à gestão do setor. |

## Entregas
- RPC `cancelar_anuncio`; `app.expirar_vencidos()` + job `troka-expirar-vencidos` (pg_cron, `* * * * *`).
- Tabela `alerta` + trigger em `anuncio`; trigger em `plantao` resolve alertas ao trocar de dono; RPC `resolver_alerta`.
- Front: "Cancelar anúncio" em /plantoes; seção "Plantões em risco" na gestão.

## Plano
- [x] Migration + testes pgTAP
- [x] Tipos + front
- [x] Build + checagem via API
- [x] Inventário, audit, state, commit

## Resultado
- 142/142 testes pgTAP (B7: 19).
- pg_cron validado no ambiente local: anúncio vencido expirado pelo job, sem chamada manual (ver audit).
