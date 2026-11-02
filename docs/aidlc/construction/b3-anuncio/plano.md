# B3 — Anúncio de troca

RNs: **RN06b, RN07, RN08, RN09, RN09b, RN09c, RN10, RN29**. Completa a B2/P3 (bloquear edição/remoção de plantão com anúncio em aberto).
Fora do escopo: assumir/elegíveis/avisos (B4, RN11), aprovação (B5), adicional (B6), cancelar/expirar com pg_cron (B7).

## Entregável
Profissional anuncia o próprio plantão futuro, com urgência obrigatória e motivo opcional; o prazo é calculado pelo banco.
O motivo nunca chega a outro profissional (RN29): fica em tabela separada, legível só pelo gestor do setor (e pelo próprio anunciante, conforme P4).

## Modelo (migration `..._b3_anuncio.sql`)
| Tabela / tipo | Campos | RN |
|---|---|---|
| enum `urgencia` | `normal`, `urgente` | RN09c |
| enum `status_anuncio` | `aberto`, `pendente`, `aprovado`, `recusado`, `cancelado`, `expirado` (transições entram bolt a bolt) | — |
| `anuncio` | `id`, `plantao_id`, `anunciante_id`, `urgencia`, `expira_em`, `status`, `criado_em` | RN07–RN10 |
| enum `motivo_categoria` | `saude`, `pessoal`, `outro` | RN09b |
| `anuncio_motivo` | `anuncio_id` (PK), `categoria` (obrigatória), `texto` (opcional, limite P2) | RN09b, RN29 |

- **RN08**: índice único parcial em `anuncio(plantao_id)` para status "em aberto" (definição na P1).
- **RN10**: `expira_em = least(agora + 24h se urgente | 48h se normal, plantao.inicio)`, calculado na RPC. A virada para `expirado` é do B7 (pg_cron); até lá, telas e RPCs tratam `expira_em <= now()` como vencido.
- **B2/P3**: `editar_plantao`/`remover_plantao` passam a recusar plantão com anúncio em aberto.

## RPC
`anunciar(plantao_id, urgencia, motivo_categoria?, motivo_texto?)`
- só o dono do plantão (`profissional_id = auth.uid()`) e só antes do início (RN07);
- urgência obrigatória (RN09, RN09c); texto sem categoria → erro (RN09b);
- RN08 garantido pelo índice (erro legível).
- **RN06b**: anúncio é o único caminho de troca para profissionais (não existe RPC de troca direta; o ajuste de escala do gestor é a exceção decidida no B2/P4).

## RLS
| Tabela | SELECT | Escrita |
|---|---|---|
| `anuncio` | quem vê o plantão (mesmo setor, RN03) | só RPC |
| `anuncio_motivo` | gestor do setor (+ anunciante, P4) | só RPC |

## Front
- `/plantoes`: botão **Pedir cobertura** volta; plantão anunciado mostra "Anúncio aberto · vence …" e a urgência.
- `/anunciar`: real — escolhe plantão, urgência (Normal 48h / Urgente 24h), motivo opcional (categoria + texto); mostra o prazo calculado antes de publicar.
- `/gestao`: nova seção **Anúncios do setor** (com motivo — prova da RN29 do lado do gestor).
- `/assumir` segue mock até o B4.

## Plano
- [x] Responder `perguntas.md`
- [x] Migration: enums, tabelas, índice RN08, RLS, RPC `anunciar`, bloqueio no editar/remover plantão
- [x] Seed: 2–3 anúncios (normal e urgente, com e sem motivo)
- [x] Testes pgTAP `b3_anuncio.test.sql`: não-dono não anuncia (RN07); plantão iniciado não anuncia (RN07); segundo anúncio falha (RN08); prazo 24h/48h e corte no início (RN10); texto sem categoria falha (RN09b); outro profissional não lê o motivo, gestor lê (RN29); gestor não edita/remove plantão anunciado
- [x] `db reset` + `db:test` verdes
- [x] Tipos + `/plantoes`, `/anunciar`, seção em `/gestao`
- [x] Build + teste via API + roteiro de teste manual
- [x] Atualizar inventário, audit, state

## Resultado
- 58/58 testes pgTAP (B1 16 + B2 20 + B3 22).
- RN29 conferida via API: colega recebe `anuncio_motivo: null`; anunciante e gestor veem.
- Expiração preguiçosa: anúncio vencido vira `expirado` ao anunciar de novo (RN23 completa com pg_cron no B7).
- Nova trava: plantão com histórico de anúncios não é removido (RN26).
- O próprio trigger da RN14 barrou um fixture de teste mal montado (sobreposição) — corrigido o fixture.
