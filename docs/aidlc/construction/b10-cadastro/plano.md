# B10 — Cadastro de profissional com validação CRM/COREN

RN: **RN01b** (+ RN01, RN02 no cadastro pelo gestor).

## Decisões (automode, revisáveis)
| # | Decisão |
|---|---|
| P1 | Gestor cadastra no próprio setor; profissional recebe convite por e-mail e define a senha (local: Mailpit). |
| P2 | Validação por modo (secret `CONSELHO_VALIDACAO` da Edge Function): `desligada` (teste do usuário: aceita, marca não verificado), `simulada` (regras falsas determinísticas), `real` (provedor). |
| P3 | Padrão `real`; provedor não configurado → cadastro bloqueado (RN01b: sem validação não conclui). |
| P4 | Perfil guarda `conselho_validacao` (`verificado` / `simulado` / `nao_verificado`) e `conselho_validado_em`. |
| P5 | Conselho único por categoria + UF + número. |
| P6 | Remoção do store mock (`troka.tsx`, `ShiftCard`, `MockOnly`): app 100% banco. |

## Pendente de decisão do usuário
- Provedor real de consulta CRM (CFM) / COREN (Cofen/Corens): escolha, credenciais e custo. A interface `validarConselho()` já existe; o modo `real` falha fechado até lá.

## Entregas
- Edge Function `cadastrar-profissional` (auth do gestor, validação, convite, perfil, compensação em falha).
- RPC `cadastrar_profissional_interno` executável só pela service_role (regras no banco; histórico com o gestor como ator).
- Front: formulário real de cadastro, rota `/definir-senha`, status de validação na equipe; mock removido.

## Plano
- [x] Migration + testes pgTAP
- [x] Edge Function + config local (site_url, `.env` de funções)
- [x] Front + limpeza do mock
- [x] Teste ponta a ponta local (modos desligada/simulada/real) via API + Mailpit
- [x] Inventário, audit, state, commit

## Resultado
- 178/178 testes pgTAP (B10: 14).
- Edge Function testada local nos 3 modos; fluxo de convite completo (cadastro → e-mail pt-BR no Mailpit → link → senha → login).
- Bugs achados no teste ponta a ponta e corrigidos:
  - re-cadastro de e-mail com convite pendente reenviava o convite e a compensação APAGAVA o usuário existente → checagem prévia (`cadastro_verificar`) antes de qualquer efeito + compensação só para usuário criado na própria chamada;
  - convite enviado antes de recusar especialidade de outra categoria → especialidade validada na checagem prévia;
  - banco aceitava UF inexistente (`XX`) → CHECK com as 27 UFs.
- Segurança: `enable_signup = false` (RN01: o hospital cadastra; não há cadastro aberto).
- Mock removido: `troka.tsx`, `ShiftCard`, `MockOnly`, `TrokaProvider`.
