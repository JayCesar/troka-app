# AI-DLC — Regras do projeto

Este projeto segue o AI-Driven Development Life Cycle (AI-DLC): a IA conduz o
planejamento e a execução, os humanos validam cada etapa ("mob elaboration" e
"mob construction"). Nada avança de fase sem aprovação explícita.

## Fases

1. **Inception** (`aidlc-docs/inception/`) — transformar uma *Intent* em
   requisitos, user stories e *Units* de trabalho.
2. **Construction** (`aidlc-docs/construction/`) — para cada Unit: design de
   domínio, design lógico, código e testes.
3. **Operations** (`aidlc-docs/operations/`) — deploy, observabilidade,
   incidentes e aprendizados.

## Regras de trabalho

- Antes de qualquer fase, leia `aidlc-docs/audit.md` e o estado em
  `aidlc-docs/state.md`.
- Para cada fase: gere um plano em markdown com checkboxes, peça aprovação,
  só então execute marcando os itens.
- Faça perguntas de esclarecimento em arquivo (`*-questions.md`) com opções
  A/B/C e um campo `[Resposta]:`; não assuma respostas.
- Registre toda interação relevante em `aidlc-docs/audit.md` (timestamp ISO,
  entrada do usuário, decisão, aprovação).
- Código de aplicação vai na raiz do projeto (`src/`, `tests/`), nunca dentro
  de `aidlc-docs/`.
- Uma Unit por vez; cada Unit deve ser entregável e testável de forma
  independente.

## Fluxo de início

Ao receber uma nova intent: crie `aidlc-docs/inception/intent.md` a partir do
template em `aidlc-docs/templates/intent.md` e comece pela etapa de requisitos.
