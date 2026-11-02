# Inventário do front (apps/web) — Fase 3

> Base: código copiado do Lovable em 2026-11-02. **Todo dado é mock em memória** (`src/lib/troka.tsx`):
> recarregar a página zera o estado. Toda regra hoje está **só no front** → nenhuma RN conta como
> "coberta" para o critério do projeto (regra no banco). A coluna "Front" indica o que já existe de UI/lógica
> reaproveitável.

## 1. Telas e rotas

| Rota | Arquivo | Papel | O que faz | Ações (store) |
|---|---|---|---|---|
| `/` | `routes/index.tsx` | todos | Login por e-mail (sem senha) + atalhos para 3 usuários seed | `login` |
| `/plantoes` | `routes/plantoes.tsx` | médico | Meus plantões (confirmado/anúncio/pendente), filtro por hospital | — |
| `/anunciar` | `routes/anunciar.tsx` | médico | Escolhe plantão confirmado, motivo, urgência; mostra nº de elegíveis e bônus | `publish` |
| `/assumir` | `routes/assumir.tsx` | médico | Lista plantões abertos + anúncios; filtro hospital/setor; mostra motivo de inelegibilidade | `takeShift`, `acceptCoverage` |
| `/gestao` | `routes/gestao.tsx` | gestor | Abertos, pendentes de aprovação, alertas (aberto sem elegível), histórico, CSV, cadastro de profissional | `decide`, `addProfessional` |
| (shell) | `components/AppShell.tsx` | todos | Header, abas por papel, notificações, logout, guarda de rota por papel | `markRead`, `logout` |

Telas de referência visual: `lovable/telas/{login,2-plantoes,3-assumir,4-anunciar,5-gestao}.png`.

## 2. Dado real × mock

| Dado | Origem hoje | Destino |
|---|---|---|
| Usuários, papéis, vínculos | **banco (B1)**; o mock ainda é espelhado por e-mail para as telas | `auth.users` + `perfil` |
| Hospitais, setores, especialidades | mock (constantes `SECTORS`, `SPECIALTIES`, `SECTOR_SPECIALTY`) | tabelas (B1) |
| Plantões | **banco (B2)** em `/plantoes` e `/gestao`; `/assumir` e `/anunciar` ainda mock | `plantao` |
| Anúncios | **banco (B3)** em `/plantoes`, `/anunciar`, `/gestao`; `/assumir` ainda mock | `anuncio` + `anuncio_motivo` |
| Elegibilidade | **banco (B4)**: `app.motivos_para` + `ofertas_para_mim` | — |
| Regras por hospital (`minRestHours`, `weeklyLimitHours`, `autoApprove`, `bonus`) | mock | **descartar**: RN fixa 11h; sem limite semanal; auto-aprovação via lista de confiança; adicional por anúncio |
| Histórico | **banco (B8)**: `historico` imutável + CSV | — |
| Notificações | **banco (B4)**: `aviso` + sino no AppShell | — |
| Login | **Supabase Auth (B1, feito)** — e-mail + senha | — |
| Logo | `/favicon.png` provisório | asset final em `public/` |

## 3. RN × onde está implementada

Legenda: **coberta** = implementada no banco; **parcial** = existe só no front ou diverge da RN; **falta** = não existe.

| RN | Regra (resumo) | Status | Onde / observação |
|---|---|---|---|
| RN01 | Profissional ↔ hospital, setor, categoria, especialidade | **coberta** (B1) | `perfil` + FKs compostas + CHECK por papel; cadastro pela gestão vem no B10. Antes: `User`: só médico (sem enfermeiro), vários hospitais/setores (Q6 = 1 hospital) |
| RN01b | CRM/COREN + UF validados no cadastro pelo gestor | falta | Form só tem campo CRM livre, sem UF, sem COREN, sem validação |
| RN02 | Papel definido pelo hospital | **coberta** (B1) | enum `papel`; escrita em `perfil` bloqueada via API. Antes: `role` fixo no seed; cadastro sempre cria "medico" |
| RN03 | Vê só dados do próprio hospital e setor | **coberta** (B1) | RLS em `hospital`/`setor`/`perfil` via `app.meu_setor()`; cada bolt novo estende às suas tabelas. Antes: Filtros de tela (`assumir`, `gestao`); sem RLS |
| RN30 | Isolamento entre hospitais | **coberta** (B1) | RLS via `app.meu_hospital()`; testado. Antes: Store global com todos os hospitais |
| RN04 | Plantão com hospital, setor, especialidade, início < fim | **coberta** (B2) | `plantao` + FKs + `check (fim > inicio)` + validação na RPC. Antes: Tipo `Shift` sem especialidade própria (deriva do setor); sem validação de fim > início |
| RN05 | Só gestor do setor cria/edita/remove plantão | **coberta** (B2) | RPCs `criar/editar/remover_plantao` (setor do perfil, só antes do início); CRUD em `/gestao`. Antes: Não há tela nem ação de CRUD de plantão |
| RN06 | Plantão aberto ou atribuído | **coberta** (B2) | coluna gerada `status`. Antes: Status `aberto/confirmado/anuncio/pendente` mistura plantão e anúncio |
| RN06b | Troca só via anúncio | **coberta** (B3) | não existe RPC de troca direta; `anunciar` é o único caminho. Antes: Anúncio existe |
| RN06c | Plantão aberto: candidatura + aprovação do gestor, ou automática p/ lista de confiança | **coberta** (B5) | candidatura + aprovação manual/automática (lista de confiança). |
| RN07 | Só o dono anuncia, antes do início | **coberta** (B3) | RPC `anunciar`. Antes: Lista só plantões do usuário; não checa início |
| RN08 | Máx. 1 anúncio aberto por plantão | **coberta** (B3) | índice único parcial (aberto+pendente). Antes: Implícito (plantão anunciado sai da lista); sem garantia |
| RN09 | Urgência obrigatória, motivo opcional | **coberta** (B3) | Antes: Motivo obrigatório; 3 urgências |
| RN09b | Motivo = categoria (Saúde/Pessoal/Outro) + texto opcional | **coberta** (B3) | `anuncio_motivo`, texto ≤ 500. Antes: Lista fixa de 5 motivos, sem texto |
| RN09c | Urgência Normal / Urgente | **coberta** (B3) | enum `urgencia`. Antes: "Hoje / Até 3 dias / Mais de 3 dias" |
| RN10 | Prazo 24h/48h ou início, o que vier primeiro | **coberta** (B3) | `expira_em` calculado na RPC. Antes: Sem prazo |
| RN11 | Só elegíveis são avisados | **coberta** (B4) | `anunciar` avisa só elegíveis (`aviso`). |
| RN12 | Mesmo hospital e setor | **coberta** (B4) | `app.motivos_para`. |
| RN12b | Mesma categoria | **coberta** (B4) | especialidade pertence a uma categoria (FK composta). |
| RN13 | Especialidade idêntica | **coberta** (B4) | `app.motivos_para`. |
| RN14 | Sem sobreposição + 11h de descanso, incluindo trocas | **coberta** (B4) | inclui compromissos pendentes (P2). |
| RN15 | Ninguém assume o próprio plantão | **coberta** (B4) | `app.motivos_para`. |
| RN16 | Revalidar elegibilidade na aprovação | **coberta** (B5) | `app.efetivar_*` revalida RN12–RN15; gestão vê a revalidação prévia. |
| RN19 | Coordenação aprova/recusa com um clique | **coberta** (B5) | `aprovar_troca`/`recusar_troca` com um clique. |
| RN19b | Lista de confiança por setor | **coberta** (B5) | `lista_confianca` + `definir_confianca`; seção Equipe. |
| RN19c | Auto-aprovação se ambos na lista + elegível; sem retroagir | **coberta** (B5) | avaliada no ato da solicitação; não retroage (testado). |
| RN20 | Dono muda só após aprovação | **coberta** (B5) | dono só muda em `efetivar_troca`/`efetivar_candidatura`. |
| RN20b | Sem cancelamento após aprovação | **coberta** (B5) | não há RPC de desfazer; desistir/recusar exigem pendente (testado). |
| RN21 | Só gestor do setor aprova | **coberta** (B5) | `app.anuncio_do_meu_setor`/`candidatura_do_meu_setor`. |
| RN17 | Só gestor oferece adicional | **coberta** (B6) | RPC `definir_adicional` só para gestor do setor. |
| RN17b | Valor fixo por anúncio, opcional | **coberta** (B6) | `numeric(10,2) > 0`, opcional, por anúncio. |
| RN18 | Adicional visível antes de assumir e no histórico | **coberta** (B6) | em `ofertas_para_mim`/pendências; fica no anúncio após conclusão (histórico de alterações no B8). |
| RN22 | Anunciante cancela antes da aprovação | **coberta** (B7) | RPC `cancelar_anuncio` (aberto ou pendente). |
| RN22b | Quem assumiu desiste antes da aprovação | **coberta** (B4) | RPC `desistir_anuncio` (+ `desistir_candidatura`). |
| RN23 | Anúncio expira sem interessado | **coberta** (B7) | job pg_cron `troka-expirar-vencidos` a cada minuto + expiração preguiçosa. |
| RN24 | Expirado gera alerta de plantão em risco | **coberta** (B7) | trigger cria `alerta` em toda expiração; seção "Plantões em risco" na gestão. |
| RN25 | Toda mudança registrada | **coberta** (B8) | triggers em 7 tabelas gravam `historico` (inclui ações do pg_cron como "Sistema"). |
| RN26 | Histórico imutável | **coberta** (B8) | sem escrita via API + trigger bloqueia UPDATE/DELETE/TRUNCATE para qualquer papel. |
| RN27 | Exportar CSV | **coberta** (B8) | `historico_do_setor` + CSV (`;` + BOM) na gestão. |
| RN28 | Painel: abertos, urgentes, a vencer, alertas | parcial | Abertos e alertas; falta urgentes e a vencer |
| RN29 | Motivo nunca exposto a outros profissionais | **coberta** (B3) | tabela separada com RLS (gestor + anunciante). Antes: Só aparece em `/gestao`, mas o dado está no store de todos |

**Totais (41 RNs):** coberta 39 · parcial 1 · falta 1 (após B8).

## 4. Divergências do mock a remover
- Limite semanal de horas (`weeklyLimitHours`) — não existe nas RN.
- Descanso configurável por hospital — RN14 fixa 11h.
- `autoApprove` por hospital e bônus automático por urgência — substituídos por RN19b/c e RN17/RN17b.
- Multi-hospital por usuário — Q6 decidido provisoriamente como 1 hospital.

## 5. Perguntas resolvidas
- **P1 — Plantão aberto:** candidatura + aprovação do gestor; automática se o profissional estiver na lista de confiança do setor (mesma lista da RN19b). Registrado como **RN06c**.
