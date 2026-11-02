# TroKa — Regras de Negócio (Revisão Completa)

> Versão revisada com base nas decisões de fechamento de pendências e novas regras definidas pelo grupo. Alterações em relação ao rascunho anterior estão sinalizadas com **(REVISADA)** ou **(NOVA)**.

---

## Glossário

| Termo | Definição |
|---|---|
| Hospital | Unidade organizacional raiz do sistema; isola dados de outras unidades. |
| Setor | Subdivisão do hospital à qual plantões, profissionais e gestores estão vinculados. |
| Candidatura | Pedido de um profissional para ocupar um plantão em aberto (RN06c). |
| Profissional | Médico ou enfermeiro cadastrado pelo hospital, vinculado a setor, categoria e especialidade. |
| Gestor | Usuário responsável pela gestão de um setor específico (cria plantões, aprova trocas, define lista de confiança e adicional). |
| Coordenação | Instância responsável por aprovar ou recusar trocas (pode coincidir com o gestor do setor). |
| Plantão | Período de trabalho com hospital, setor, especialidade exigida, início e fim definidos. |
| Anúncio | Publicação de intenção de troca de um plantão já atribuído a um profissional. |
| Urgência | Classificação do anúncio em Normal ou Urgente, que define prazo de validade. |
| Motivo | Justificativa opcional do anúncio, composta por categoria e texto livre. |
| Adicional | Valor fixo em reais, opcional, oferecido pelo gestor para estimular a troca. |
| Lista de confiança | Conjunto de profissionais de um setor marcados pelo gestor como elegíveis à aprovação automática entre si. |
| Elegibilidade | Conjunto de regras (RN12 a RN15) que determinam se um profissional pode assumir um anúncio. |
| Histórico | Registro imutável de todas as mudanças relevantes do sistema. |

---

## A. Cadastro, Vínculos e Perfis

**RN01** — O hospital cadastra a equipe. Cada profissional fica vinculado a um hospital, um setor, uma categoria (médico ou enfermeiro) e uma especialidade.

**RN01b (NOVA)** — No cadastro de um profissional pelo gestor, o sistema exige:
- Para categoria **médico**: número de CRM e UF do conselho.
- Para categoria **enfermeiro**: número de COREN e UF do conselho.

O sistema valida se o registro existe e está **ativo** antes de concluir o cadastro. Se a validação falhar, o cadastro **não é concluído** e o sistema exibe o motivo do bloqueio. A validação é realizada **no momento do cadastro, pelo gestor**, nunca pelo próprio profissional.

**RN02** — O papel (profissional ou gestor) é definido pelo hospital.

---

## B. Visibilidade e Isolamento de Dados

**RN03** — Cada usuário só vê dados do próprio hospital e setor.

**RN30** — Dados de um hospital nunca aparecem para outro hospital.

---

## C. Plantões

**RN04** — Todo plantão tem hospital, setor, especialidade exigida, início e fim, e o fim deve ser depois do início.

**RN05** — Só o gestor do setor cria, edita ou remove plantões do seu setor.

**RN06** — Um plantão pode estar em aberto (sem profissional) ou atribuído.

**RN06c (NOVA — fecha P1)** — Um plantão **em aberto** passa a ter dono por **candidatura**: o profissional elegível (RN12 a RN15) se candidata e o gestor do setor aprova ou recusa (RN21). Se o profissional estiver na **lista de confiança** do setor (RN19b) no momento da candidatura, a atribuição é **automática**, com a elegibilidade revalidada (RN16). A mesma lista de confiança vale para trocas (RN19c) e para plantões em aberto.

**RN06b** — Médicos e enfermeiros podem trocar de turno, sempre por meio de anúncio; não existe troca direta sem publicação de anúncio.

---

## D. Anúncio de Troca

**RN07** — Só o profissional dono do plantão pode anunciá-lo, e só antes do plantão começar.

**RN08** — Cada plantão tem no máximo um anúncio em aberto.

**RN09 (REVISADA)** — Ao anunciar, o profissional informa obrigatoriamente o nível de **urgência** (RN09c) e pode, opcionalmente, registrar um **motivo** (RN09b).

**RN09b (NOVA — fecha Q2)** — Quando informado, o motivo é composto por:
- Uma **categoria obrigatória**: Saúde, Pessoal ou Outro;
- Um **texto livre opcional** para detalhamento.

O motivo nunca é exposto a outros profissionais (ver RN29).

**RN09c (NOVA — fecha Q3)** — O anúncio admite dois níveis de urgência: **Normal** e **Urgente**. O nível escolhido define o prazo de validade do anúncio (RN10) e sua exibição destacada no painel (RN28).

**RN10 (REVISADA — fecha Q8)** — O prazo do anúncio é:
- **24 horas**, se a urgência for **Urgente**;
- **48 horas**, se a urgência for **Normal**;
- Ou até o início do plantão, **o que ocorrer primeiro**.

**RN11** — Só profissionais elegíveis são avisados.

---

## E. Elegibilidade para Assumir

**RN12** — Mesmo hospital e setor.

**RN12b** — Mesma categoria.

**RN13 (REVISADA — fecha Q7)** — Especialidade **idêntica** à exigida pelo plantão. No MVP não há compatibilidade parcial entre especialidades distintas.

**RN14 (REVISADA — fecha Q9)** — Sem sobreposição e com descanso mínimo de **11 horas, fixo no MVP** (sem configuração por hospital). O cálculo considera também plantões **já atribuídos por troca anterior**, não apenas a escala original.

**RN15** — Ninguém assume o próprio plantão.

---

## F. Aprovação e Mudança de Titularidade

**RN16** — As regras de elegibilidade (RN12 a RN15) são revalidadas no momento da aprovação.

**RN19 (REVISADA)** — A coordenação aprova ou recusa a troca com um clique, **exceto** nos casos de aprovação automática previstos na RN19c.

**RN19b (NOVA — fecha parte da Q4)** — O gestor pode marcar profissionais específicos do seu setor como **lista de confiança**. A marcação é individual e pode ser alterada pelo gestor a qualquer momento.

**RN19c (NOVA — fecha Q4)** — Quando o profissional que anunciou **e** o profissional que deseja assumir estiverem ambos na lista de confiança do setor no momento da solicitação, **e** a troca passar em todas as regras de elegibilidade (RN12 a RN15), o sistema aprova **automaticamente**, sem clique da coordenação. Alterações na lista de confiança (inclusão ou remoção) **só valem para trocas futuras**, nunca retroagem a anúncios ou solicitações já em andamento.

**RN20** — O plantão só muda de dono após a aprovação (manual ou automática, conforme RN19c).

**RN20b (NOVA)** — Cancelamento **após a aprovação** não é permitido pelo fluxo normal. Para desfazer a troca, é necessário abrir um **novo anúncio**.

**RN21** — Só o gestor aprova trocas do próprio setor.

---

## G. Adicional Financeiro

**RN17** — Só o gestor oferece adicional.

**RN17b (NOVA — fecha Q5)** — O adicional é um **valor fixo em reais**, definido por anúncio, de oferecimento **opcional** pelo gestor.

**RN18** — O adicional aparece antes de assumir e fica registrado no histórico, mesmo após a conclusão ou expiração do anúncio.

---

## H. Cancelamento e Desistência

**RN22** — Quem anunciou pode cancelar antes da aprovação.

**RN22b (NOVA — fecha Q12)** — Quem assumiu o anúncio também pode **desistir antes da aprovação**. Nesse caso, o anúncio volta ao estado **em aberto**, disponível para outro profissional elegível.

**RN23** — Anúncio expira se ninguém assumir no prazo (RN10).

**RN24** — Anúncio expirado gera alerta de plantão em risco.

---

## I. Histórico e Auditoria

**RN25** — Toda mudança é registrada.

**RN26** — Histórico nunca é editado nem apagado.

**RN27** — Gestão pode exportar histórico em CSV.

---

## J. Painel de Gestão

**RN28** — Painel mostra plantões em aberto, anúncios urgentes, a vencer e alertas.

---

## K. Privacidade e Confidencialidade

**RN29 (REVISADA)** — O motivo do anúncio (categoria e texto livre) nunca é exposto a outros profissionais; fica restrito à coordenação/gestor quando aplicável, e permanece no histórico (RN26).

---

## L. Questões em Aberto

| Nº | Tema | Status | Decisão / Observação |
|---|---|---|---|
| Q1 | Cobertura recíproca entre profissionais | **Em aberto** | Sugestão original mantida; aguarda definição do grupo. |
| Q2 | Motivo obrigatório ou opcional | **Respondida** | Motivo é opcional, com categoria obrigatória (Saúde, Pessoal, Outro) + texto livre opcional (RN09b). |
| Q3 | Níveis de urgência | **Respondida** | Dois níveis: Normal e Urgente (RN09c). |
| Q4 | Aprovação automática | **Respondida** | Aprovação manual por padrão; lista de confiança por setor permite aprovação automática entre pares de confiança, validada pela elegibilidade (RN19b, RN19c). |
| Q5 | Valor do adicional | **Respondida** | Valor fixo em reais, por anúncio, opcional (RN17b). |
| Q6 | Profissionais em múltiplos hospitais | **Em aberto** | Sugestão original mantida; aguarda definição do grupo. |
| Q7 | Especialidade compatível (parcial x idêntica) | **Respondida** | Especialidade idêntica no MVP (RN13). |
| Q8 | Prazo do anúncio | **Respondida** | 24h se Urgente, 48h se Normal, ou até o início do plantão, o que vier primeiro (RN10). |
| Q9 | Descanso configurável | **Respondida** | Fixo em 11h no MVP, considerando também plantões já atribuídos por troca (RN14). |
| Q10 | Aprovação via assistente (IA) | **Em aberto** | Sugestão original mantida; aguarda definição do grupo. |
| Q11 | Exibir quantidade ou nomes de disponíveis | **Em aberto** | Sugestão original mantida; aguarda definição do grupo. |
| Q12 | Desistência após assumir, antes da aprovação | **Respondida** | Permitida; anúncio volta a ficar em aberto (RN22b). Cancelamento após aprovação não é permitido (RN20b). |
| Q13 | Gestor usando assistente para definir adicional e criar plantão | **Em aberto** | Sugestão original mantida; aguarda definição do grupo. |
| Q14 | Escolha entre MCP ou Edge Function | **Em aberto** | Sugestão original mantida; decisão técnica pendente. |

---

## Resumo das Mudanças desta Revisão

- **Fechada Q2**: motivo do anúncio passa a ter categoria obrigatória (Saúde, Pessoal, Outro) e texto livre opcional (RN09b).
- **Fechada Q3**: definidos dois níveis de urgência — Normal e Urgente (RN09c).
- **Fechada Q8**: prazo do anúncio ajustado para 24h (Urgente) ou 48h (Normal), limitado ao início do plantão, o que vier primeiro (RN10 revisada).
- **Fechada Q9**: descanso mínimo fixado em 11h no MVP, agora considerando explicitamente plantões já atribuídos por troca anterior (RN14 revisada).
- **Fechada Q7**: especialidade exigida deve ser idêntica à do profissional no MVP, sem compatibilidade parcial (RN13 revisada).
- **Fechada Q4**: mantida aprovação manual como padrão; criada lista de confiança por setor (RN19b) que permite aprovação automática entre profissionais de confiança, desde que a elegibilidade seja validada (RN19c); mudanças na lista só valem para trocas futuras.
- **Fechada Q5**: adicional definido como valor fixo em reais, por anúncio, de caráter opcional (RN17b).
- **Fechada Q12**: permitida desistência de quem assumiu antes da aprovação, retornando o anúncio ao estado em aberto (RN22b).
- **Nova regra**: cancelamento da troca não é permitido após aprovação; exige-se novo anúncio (RN20b).
- **Nova regra**: validação obrigatória de CRM/UF (médicos) e COREN/UF (enfermeiros) no cadastro, realizada pelo gestor, com bloqueio do cadastro em caso de falha na validação (RN01b).
- Questões **Q1, Q6, Q10, Q11, Q13 e Q14** permanecem em aberto, sem alteração em relação ao documento original.
- Seção de Glossário adicionada/expandida para refletir os novos conceitos (categoria de motivo, níveis de urgência, lista de confiança).
- Estrutura reorganizada em seções temáticas (A a L) para facilitar rastreabilidade das regras.