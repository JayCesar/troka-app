# B6 — Adicional financeiro

RNs: **RN17, RN17b, RN18**.

## Decisões (automode, revisáveis)
| # | Decisão |
|---|---|
| P1 | Gestor define/altera/remove o adicional enquanto o anúncio está `aberto`; depois de assumido, congela. |
| P2 | Valor fixo em reais, `numeric(10,2) > 0`; null = sem adicional (RN17b). |
| P3 | Só anúncios (RN17b: "por anúncio"); plantão aberto não tem adicional. |
| P4 | Ao oferecer adicional, elegíveis são avisados (mesma regra da RN11). |
| P5 | Valor/autor/data ficam no anúncio para sempre (RN18); histórico de alterações no B8. |

## Entregas
- Colunas `adicional_valor`, `adicional_definido_por`, `adicional_definido_em` em `anuncio`; RPC `definir_adicional(anuncio, valor)`.
- `ofertas_para_mim` e `pendencias_do_setor` passam a trazer o adicional (RN18: visível antes de assumir).
- Front: campo de adicional nos anúncios da gestão; chip "Adicional R$" em /assumir, /plantoes e pendências.

## Plano
- [x] Migration + seed + testes pgTAP
- [x] Tipos + front
- [x] Build + checagem via API
- [x] Inventário, audit, state, commit

## Resultado
- 123/123 testes pgTAP (B6: 12).
- Via API: Carlos vê o adicional antes de assumir; Ana altera; profissional não define.
