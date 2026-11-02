# B8 — Histórico imutável e CSV

RNs: **RN25, RN26, RN27**.

## Decisões (automode, revisáveis)
| # | Decisão |
|---|---|
| P1 | `historico` alimentado por triggers em plantao, anuncio, anuncio_motivo, candidatura, lista_confianca, alerta, perfil (RN25: nenhum caminho escapa). |
| P2 | Imutável (RN26): sem permissão de escrita via API + trigger que bloqueia UPDATE/DELETE/TRUNCATE para qualquer papel. |
| P3 | Leitura só pela gestão do setor (contém motivos; RN29 preservada). |
| P4 | Cada linha: ator (null = Sistema), entidade, ação, resumo legível, plantão de contexto, antes/depois em JSON. |
| P5 | CSV (RN27) gerado no navegador a partir do histórico do setor (`;` + BOM, para Excel pt-BR). |

## Plano
- [x] Migration + testes pgTAP
- [x] Tipos + seção "Histórico" real na gestão (substitui o mock) + CSV
- [x] Build + checagem via API
- [x] Inventário, audit, state, commit

## Resultado
- 158/158 testes pgTAP (B8: 16), suíte estável em 5 execuções seguidas.
- Corrigido teste instável do B7 (desempate por `id` aleatório com `now()` constante na transação) — não era bug de produto.
- Corrigido resumo "Plantão criado para —" (null em `app.nome`).
- Via API: profissional não lê; DELETE do gestor negado (42501); UPDATE/DELETE/TRUNCATE bloqueados até para o superusuário (TK423).
