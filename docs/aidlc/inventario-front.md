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
| Usuários, papéis, vínculos | mock (`users`) | `auth.users` + `profissional` (B1) |
| Hospitais, setores, especialidades | mock (constantes `SECTORS`, `SPECIALTIES`, `SECTOR_SPECIALTY`) | tabelas (B1) |
| Plantões | mock (`shifts`) | `plantao` (B2) |
| Anúncios | mock (`coverages`) | `anuncio` (B3–B7) |
| Elegibilidade | `checkEligibility()` no front | função SQL `elegivel()` (B4) |
| Regras por hospital (`minRestHours`, `weeklyLimitHours`, `autoApprove`, `bonus`) | mock | **descartar**: RN fixa 11h; sem limite semanal; auto-aprovação via lista de confiança; adicional por anúncio |
| Histórico | mock (`audit`), mutável | `historico` append-only via trigger (B8) |
| Notificações | mock (`notices`) | tabela/realtime (B4/B5) |
| Login | e-mail sem senha | Supabase Auth (B1) |
| Logo | `/favicon.png` provisório | asset final em `public/` |

## 3. RN × onde está implementada

Legenda: **coberta** = implementada no banco; **parcial** = existe só no front ou diverge da RN; **falta** = não existe.

| RN | Regra (resumo) | Status | Onde / observação |
|---|---|---|---|
| RN01 | Profissional ↔ hospital, setor, categoria, especialidade | parcial | `User`: só médico (sem enfermeiro), vários hospitais/setores (Q6 = 1 hospital) |
| RN01b | CRM/COREN + UF validados no cadastro pelo gestor | falta | Form só tem campo CRM livre, sem UF, sem COREN, sem validação |
| RN02 | Papel definido pelo hospital | parcial | `role` fixo no seed; cadastro sempre cria "medico" |
| RN03 | Vê só dados do próprio hospital e setor | parcial | Filtros de tela (`assumir`, `gestao`); sem RLS |
| RN30 | Isolamento entre hospitais | falta | Store global com todos os hospitais |
| RN04 | Plantão com hospital, setor, especialidade, início < fim | parcial | Tipo `Shift` sem especialidade própria (deriva do setor); sem validação de fim > início |
| RN05 | Só gestor do setor cria/edita/remove plantão | falta | Não há tela nem ação de CRUD de plantão |
| RN06 | Plantão aberto ou atribuído | parcial | Status `aberto/confirmado/anuncio/pendente` mistura plantão e anúncio |
| RN06b | Troca só via anúncio | parcial | Anúncio existe |
| RN06c | Plantão aberto: candidatura + aprovação do gestor, ou automática p/ lista de confiança | falta | `takeShift` atribui direto, sem aprovação |
| RN07 | Só o dono anuncia, antes do início | parcial | Lista só plantões do usuário; não checa início |
| RN08 | Máx. 1 anúncio aberto por plantão | parcial | Implícito (plantão anunciado sai da lista); sem garantia |
| RN09 | Urgência obrigatória, motivo opcional | parcial | Motivo obrigatório; 3 urgências |
| RN09b | Motivo = categoria (Saúde/Pessoal/Outro) + texto opcional | falta | Lista fixa de 5 motivos, sem texto |
| RN09c | Urgência Normal / Urgente | falta | "Hoje / Até 3 dias / Mais de 3 dias" |
| RN10 | Prazo 24h/48h ou início, o que vier primeiro | falta | Sem prazo |
| RN11 | Só elegíveis são avisados | parcial | `publish` notifica `eligibleDoctors` (só front) |
| RN12 | Mesmo hospital e setor | parcial | `checkEligibility` |
| RN12b | Mesma categoria | falta | Não há categoria |
| RN13 | Especialidade idêntica | parcial | `checkEligibility` (via setor→especialidade) |
| RN14 | Sem sobreposição + 11h de descanso, incluindo trocas | parcial | `checkEligibility` (11h configurável por hospital + limite semanal extra, fora das RN) |
| RN15 | Ninguém assume o próprio plantão | parcial | Filtra `requesterId !== user`; não revalida |
| RN16 | Revalidar elegibilidade na aprovação | falta | `decide` não revalida |
| RN19 | Coordenação aprova/recusa com um clique | parcial | `decide` em `/gestao` |
| RN19b | Lista de confiança por setor | falta | — |
| RN19c | Auto-aprovação se ambos na lista + elegível; sem retroagir | falta | Hoje `autoApprove` por hospital |
| RN20 | Dono muda só após aprovação | parcial | `decide`/auto em `acceptCoverage`; `takeShift` atribui direto |
| RN20b | Sem cancelamento após aprovação | falta | Não há cancelamento algum (ok por omissão, mas sem bloqueio) |
| RN21 | Só gestor do setor aprova | parcial | Guarda por papel na rota; não checa setor |
| RN17 | Só gestor oferece adicional | falta | Bônus vem de regra do hospital, automático |
| RN17b | Valor fixo por anúncio, opcional | falta | Bônus por urgência |
| RN18 | Adicional visível antes de assumir e no histórico | parcial | Exibido em `/assumir` e `/anunciar`; não vai para histórico |
| RN22 | Anunciante cancela antes da aprovação | falta | — |
| RN22b | Quem assumiu desiste antes da aprovação | falta | — |
| RN23 | Anúncio expira sem interessado | falta | — |
| RN24 | Expirado gera alerta de plantão em risco | parcial | "Alertas" = plantão aberto sem elegível (critério diferente) |
| RN25 | Toda mudança registrada | parcial | `log()` em parte das ações, no front |
| RN26 | Histórico imutável | falta | Array em memória |
| RN27 | Exportar CSV | parcial | Botão em `/gestao` gera CSV do mock (reaproveitável) |
| RN28 | Painel: abertos, urgentes, a vencer, alertas | parcial | Abertos e alertas; falta urgentes e a vencer |
| RN29 | Motivo nunca exposto a outros profissionais | parcial | Só aparece em `/gestao`, mas o dado está no store de todos |

**Totais (41 RNs):** coberta 0 · parcial 23 · falta 18.

## 4. Divergências do mock a remover
- Limite semanal de horas (`weeklyLimitHours`) — não existe nas RN.
- Descanso configurável por hospital — RN14 fixa 11h.
- `autoApprove` por hospital e bônus automático por urgência — substituídos por RN19b/c e RN17/RN17b.
- Multi-hospital por usuário — Q6 decidido provisoriamente como 1 hospital.

## 5. Perguntas resolvidas
- **P1 — Plantão aberto:** candidatura + aprovação do gestor; automática se o profissional estiver na lista de confiança do setor (mesma lista da RN19b). Registrado como **RN06c**.
