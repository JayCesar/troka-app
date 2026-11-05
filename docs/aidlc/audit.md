# Audit log

## 2026-10-29T02:46:12Z — Inicialização
- Entrada do usuário: "quero criar um projeto ai-dlc"
- Decisão: estrutura AI-DLC agnóstica de stack
- Aprovação: n/a

## 2026-11-02T17:30:00Z — Fase 0 (Reconhecimento)
- Entrada do usuário: prompt TroKa (monorepo React + Supabase, fases 0–3).
- Decisão: rastreio AI-DLC em `docs/aidlc`; Supabase CLI como devDependency.
- Achados: front Lovable = TanStack Start com estado 100% mock (`src/lib/troka.tsx`); sem Supabase/Lovable Cloud.
- Aprovação: aprovado.

## 2026-11-02T17:45:00Z — Fase 1 (Plano)
- Decisões do usuário: SPA + Vercel; remover tudo do Lovable do app; RN01b com validação real no MVP **e** modo de teste sem validação; 1 hospital por profissional (Q6, provisório); ordem de bolts B1–B11 mantida.
- Aprovação: aprovado.

## 2026-11-02T18:05:00Z — Fase 2 (Estrutura e ambiente local)
- Front copiado para `apps/web`, convertido para Vite SPA (sem `@lovable.dev/*`, `@tanstack/react-start`, `nitro`, error-reporting, logo no CDN do Lovable).
- `aidlc-docs/` → `docs/aidlc/`; `regras.md` → `regras-de-negocio.md`.
- Supabase local iniciado (`supabase init` + `start`); `apps/web/.env.local` com URL/anon locais.
- Observação: npm 10.9 falha (`edgesOut`); usar `npx -y npm@11`.
- Aprovação: aprovado.

## 2026-11-02T18:30:00Z — Fase 3 (Inventário)
- Gerado `docs/aidlc/inventario-front.md`: 5 telas, tudo mock; RN coberta 0 · parcial 23 · falta 17.
- Pergunta aberta P1: como plantão aberto (RN06) passa a ter dono.
- Aprovação: pendente.
- Resposta P1 (2026-11-02T18:40:00Z): profissional elegível se candidata a plantão aberto e o gestor aprova; automático se o profissional estiver na lista de confiança do setor (a mesma da RN19b). Nova regra **RN06c** em `regras-de-negocio.md`. Bolts: candidatura no B4 (com elegibilidade), auto-aprovação no B5 (com a lista de confiança).
- Aprovação: aprovado (Fase 3).

## 2026-11-02T19:00:00Z — B1 (Base, Auth e isolamento) — plano
- Plano: `docs/aidlc/construction/b1-base-auth/plano.md`.
- Respostas: P1 A (e-mail+senha), P2 A (gestor só administrativo), P3 A (especialidades globais via migration), P4 A (seed com e-mails do mock + enfermeiros, senha `troka123`).
- Aprovação: aprovado; execução iniciada.
- Execução B1 (2026-11-02T19:40:00Z): migration `20261102183603_b1_base.sql` (hospital, setor, especialidade, perfil, schema `app`, RLS), `seed.sql` (2 hospitais, 6 setores, 15 usuários, senha `troka123`), `supabase/tests/b1_isolamento.test.sql` 16/16. Front: `lib/auth.tsx`, login real, AppShell por `perfil`; mock espelhado por e-mail até B2–B9.
- Aprovação: aprovado pelo usuário (testes manuais ok) em 2026-11-02T19:55:00Z.

## 2026-11-02T20:00:00Z — B2 (Plantões) — plano
- B1 commitado (`246ee54`). Plano B2: `docs/aidlc/construction/b2-plantoes/plano.md`; perguntas em `perguntas.md`.
- Respostas: A em tudo (P1 escala atribuída; P2 RN12–RN15 já no B2; P3 só antes do início; P4 gestor corrige dono; P5 sem limite).
- Aprovação: aprovado; execução iniciada.
- Execução B2 (2026-11-02T20:40:00Z): migration `20261102185142_b2_plantoes.sql` (tabela `plantao`, `app.motivos_inelegibilidade`, trigger de atribuição, RLS, RPCs `criar/editar/remover_plantao`), seed com 20 plantões, `b2_plantoes.test.sql` 20/20 (total 36/36). Front: `/plantoes` real, seção "Plantões do setor" em `/gestao`, `MockOnly` nas telas ainda mock.
- Ajuste pós-feedback: formulário de plantão com data + turno (Diurno/Noturno/Personalizado), resumo, especialidades do setor primeiro.
- Aprovação: aprovado pelo usuário (teste manual ok) em 2026-11-02T21:00:00Z.

## 2026-11-02T21:05:00Z — B3 (Anúncio) — plano
- B2 commitado (`a7691da`). Plano: `docs/aidlc/construction/b3-anuncio/plano.md`; perguntas em `perguntas.md`.
- Respostas: A em tudo (P1 aberto+pendente; P2 500 chars; P3 sem edição; P4 gestor+anunciante; P5 sem antecedência mínima).
- Aprovação: aprovado; execução iniciada.
- Execução B3 (2026-11-02T21:50:00Z): migration `20261102191506_b3_anuncio.sql` (enums, `anuncio`, `anuncio_motivo`, índice RN08, RLS RN29, RPC `anunciar`, bloqueio de edição/remoção de plantão anunciado), seed com 3 anúncios, `b3_anuncio.test.sql` 22/22 (total 58/58). Front: `/anunciar` real, "Pedir cobertura" em `/plantoes`, seção "Anúncios do setor" em `/gestao`.
- Aprovação: aprovado pelo usuário em 2026-11-02T22:00:00Z.

## 2026-11-02T22:00:00Z — Automode autorizado
- Entrada do usuário: "pode comitar e assumir o automode".
- Decisão: seguir B4→B10 sem parar a cada fase; perguntas de plano resolvidas pela opção recomendada e registradas como "decidido em automode (revisável)"; um commit por bolt após `db:test` + build + checagem via API verdes.
- Limites: parar antes do B11 (Q10/Q13/Q14 em aberto) e de qualquer comando de nuvem; parar se surgir decisão sem opção claramente recomendada ou que contrarie uma RN.

## 2026-11-02T22:40:00Z — B4 (Elegibilidade, candidatura, assumir, desistir) — automode
- Decisões automode (revisáveis) P1–P6 em `docs/aidlc/construction/b4-elegibilidade/plano.md`.
- Execução: migration `20261102192424_b4_elegibilidade.sql` (assumidor no anúncio, `candidatura`, `aviso`, RN14 com pendências, RPCs assumir/desistir/candidatar/ofertas/solicitações, RN11 no `anunciar`), seed com troca pendente + candidatura, `b4_elegibilidade.test.sql` 26/26 (total 84/84). Front: `/assumir` real, sino de avisos real.
- Aprovação: automode (commit após testes + build + API verdes).

## 2026-11-02T23:20:00Z — B5 (Aprovação e lista de confiança) — automode
- Decisões automode (revisáveis) P1–P5 em `docs/aidlc/construction/b5-aprovacao/plano.md`.
- Execução: migration `20261102193201_b5_aprovacao.sql` (`lista_confianca`, efetivação com revalidação RN16, auto-aprovação RN19c/RN06c, RPCs aprovar/recusar troca e candidatura, pendências e equipe), seed com lista de confiança, `b5_aprovacao.test.sql` 27/27 (total 111/111). Front: "Aguardando aprovação" real e "Equipe do setor" com lista de confiança.
- Aprovação: automode (commit após testes + build + API verdes).

## 2026-11-02T23:45:00Z — B6 (Adicional) — automode
- Decisões automode (revisáveis) P1–P5 em `docs/aidlc/construction/b6-adicional/plano.md`.
- Execução: migration `20261102193949_b6_adicional.sql` (colunas de adicional, RPC `definir_adicional`, ofertas/pendências com adicional), seed com R$ 250 no anúncio da Juliana, `b6_adicional.test.sql` 12/12 (total 123/123). Front: editor de adicional na gestão, chips em /assumir, /plantoes e pendências.
- Aprovação: automode.

## 2026-11-02T23:55:00Z — B7 (Cancelamento, expiração, alertas) — automode
- Decisões automode (revisáveis) P1–P5 em `docs/aidlc/construction/b7-expiracao/plano.md`.
- Execução: migration `20261102194246_b7_expiracao.sql` (`alerta` + trigger de expiração, auto-resolução ao trocar dono, `cancelar_anuncio`, `resolver_alerta`, `app.expirar_vencidos` + job pg_cron por minuto), `b7_expiracao.test.sql` 19/19 (total 142/142). Front: "Cancelar anúncio" em /plantoes, "Plantões em risco" na gestão.
- Aprovação: automode.
- Validação real do pg_cron (2026-11-02T19:46:00Z): anúncio do Pedro vencido → job expirou, alerta criado, avisos à gestão e ao anunciante, sem chamada manual.

## 2026-11-03T00:15:00Z — B8 (Histórico imutável e CSV) — automode
- Decisões automode (revisáveis) P1–P5 em `docs/aidlc/construction/b8-historico/plano.md`.
- Execução: migration `20261102194614_b8_historico.sql` (`historico`, trigger genérico em 7 tabelas, imutabilidade por trigger, `historico_do_setor`), `b8_historico.test.sql` 16/16 (total 158/158). Front: histórico real + CSV completo na gestão (mock removido).
- Aprovação: automode.

## 2026-11-03T00:30:00Z — B9 (Painel de gestão) — automode
- Decisões automode (revisáveis) P1–P3 em `docs/aidlc/construction/b9-painel/plano.md` ("a vencer" = ≤ 6h).
- Execução: migration `20261102195146_b9_painel.sql` (`painel_do_setor`), `b9_painel.test.sql` 6/6 (total 164/164). Front: indicadores no topo da gestão; painel mock removido.
- Aprovação: automode.

## 2026-11-03T01:10:00Z — B10 (Cadastro com validação CRM/COREN) — automode
- Decisões automode (revisáveis) P1–P6 em `docs/aidlc/construction/b10-cadastro/plano.md`.
- Execução: migration `20261102195503_b10_cadastro.sql` (status de validação, conselho único, UF válida, `cadastrar_profissional_interno` e `cadastro_verificar` só para service_role), Edge Function `cadastrar-profissional` (modos desligada/simulada/real), template de convite pt-BR, `enable_signup=false`, rota `/definir-senha`, remoção do store mock. `b10_cadastro.test.sql` 14/14 (total 178/178).
- Bugs encontrados no teste ponta a ponta e corrigidos (ver plano). Fixtures antigos ajustados para conselho único.
- Pendente de decisão do usuário: provedor real de consulta ao conselho (modo `real` bloqueia até lá).
- Automode encerrado aqui (limite: B11 depende de Q10/Q13/Q14; nuvem só a pedido).

## 2026-11-03T01:30:00Z — M1 (Melhorias de UI) — plano
- Entrada do usuário: calendário com arrastar e soltar, botão flutuante do assistente de IA (só UI), botão cadastrar/redesign com base em `exemplos/login.png`.
- Decisões do usuário: D1 só gestor arrasta (médico visualiza); D2 serviço isolado + RPC real `editar_plantao`; D3 redesenhar login + cadastro do gestor.
- Plano: `docs/aidlc/construction/m1-melhorias-ui/plano.md`. Aprovação: respostas do usuário; execução iniciada.
- Execução M1 (2026-11-03T02:10:00Z): `/calendario` com @dnd-kit (gestor arrasta, médico visualiza, otimista com reversão), botão/painel do assistente (sem backend), login redesenhado (mostrar senha, manter conectado, esqueci a senha → /definir-senha), cadastro do gestor com rótulos e tela cheia no celular; serviços isolados em `lib/services/`; templates de e-mail pt-BR (convite e recuperação).
- Aprovação: pendente (teste manual do usuário).

## 2026-11-02T22:10:00Z — M2 (Ajustes de UX: cadastro, início com IA, paleta, áudio, calendário, menu) — plano aprovado
- Entrada do usuário: `exemplos/promtp-.md` (6 pontos + página inicial).
- Decisões do usuário:
  - D1: botão "Cadastre-se" → `/cadastro` só no front ("solicitar acesso" por e-mail para `VITE_CONTATO_EMAIL`). A RN01/RN01b fica preservada: a conta continua sendo criada pelo gestor.
  - D2: áudio híbrido. A Web Speech API transcreve no navegador; como fallback, o MediaRecorder envia o áudio para `transcreverAudio` (ponto de integração, ainda sem backend, B11).
  - D3: nova home `/inicio` (só logado), com o assistente em destaque e as ações do papel. `homeFor` passa a devolver `/inicio`. O logo leva a `/inicio` quando logado e a `/` quando não.
  - D4: paleta a partir do favicon: navy `#031334` + branco. O destaque verde-água `#14A9A0` foi mantido por suposição, já que o favicon não tem cor de destaque. Tokens `--brand-*` em `styles.css`.
- Execução:
  - calendário com visões 3 dias / semana / 15 dias / mês (padrão: mês) e clique na data abrindo a visão de 3 dias;
  - menu fixo no topo no desktop (rodapé só no celular);
  - cursor pointer e hover globais.
- Sem migration nem mudança de backend.
- Verificação:
  - `tsc` limpo, `vitest` 4/4, `vite build` ok;
  - Lint: nenhum erro de regra, só formatação Prettier (existente no projeto) e avisos de fast-refresh.
- Aprovação: pendente (teste manual do usuário).

## 2026-11-02T23:30:00Z — M3 (Gestão em cards, plantões lista/tabela, pedido de acesso no banco)
- Entrada do usuário:
  - gestão dividida em cards: aprovações, anúncios, plantões, equipe e histórico;
  - plantões em lista e tabela, com filtro por nome e por CRM/COREN;
  - "coloquei um e-mail válido e não recebi nada".
- Diagnóstico do e-mail:
  - `/cadastro` só abria um `mailto:`, sem enviar nada;
  - os convites do Supabase local vão para o Mailpit (http://localhost:54324), sem SMTP real e com limite de 2 e-mails/hora.
- Decisões do usuário:
  - D1: o pedido vira pendência no banco, sem depender de SMTP;
  - D2: cards escuros com brilho em qualquer tema.
- Execução:
  - migration `20261102221000_m2_pedido_acesso.sql`:
    - tabela `pedido_acesso` + RLS por hospital (RN30);
    - `hospitais_para_cadastro` (anon);
    - `solicitar_acesso` (anon, idempotente, não revela se o e-mail já tem conta, limite de 20/h por hospital);
    - `resolver_pedido_acesso` (gestão).
  - `m2_pedido_acesso.test.sql` 14/14 (total 192/192). Aplicada com `supabase migration up`, sem reset.
  - Front:
    - `/gestao` virou hub (Painel + Alertas + 5 cards `card-glow`) com subrotas `/gestao/{aprovacoes,anuncios,plantoes,equipe,historico}`;
    - "Pedidos de acesso" ficam em Aprovações; Aprovar abre o cadastro pré-preenchido (convite RN01/RN01b) e marca o pedido como aprovado;
    - Plantões ganharam Lista/Tabela (preferência lembrada no navegador) e filtros por nome e CRM/COREN;
    - `/cadastro` grava pelo RPC; a variável `VITE_CONTATO_EMAIL` foi removida.
- Verificação:
  - `tsc` limpo, vitest 10/10, build ok;
  - smoke test via REST: anon envia (204) e não lê a tabela (42501).
- Pendente: SMTP real para convites fora do ambiente local (decisão de provedor).

## 2026-11-03T20:40:00Z — M4 (Notificações sobrepostas, ficha do profissional, visão Dia, IA no Início, fundo do chat) — plano aprovado
- Decisões:
  - Notificações viraram popover sobreposto ao sino (`z-50`), que fecha com clique fora ou Esc; o cabeçalho não cresce mais.
  - Ficha do profissional (calendário, só gestor) sem RPC nova: usa `equipe_do_setor` + plantões já carregados. A RLS `perfil_select_mesmo_setor` (RN03/RN30) limita ao setor.
    - Abre com clique simples (o arraste só ativa após 6px) ou Enter.
    - Espaço continua pegando o plantão para arrastar.
    - Cliques até 300ms após um arraste são ignorados.
  - Visão "Dia" (`1d`) no calendário em lista de cards por turno, alternativa à régua de horas. Clicar numa data continua abrindo 3 dias.
  - Início: a prévia do chat virou `ConversaDemo`, com conversa roteirizada em loop (3 trocas por papel).
    - Efeitos: pensando com brilho, resposta digitada, cartões de resultado e borda com gradiente girando.
    - Decorativa (`aria-hidden`); respeita `prefers-reduced-motion`.
  - Fundo do chat (5 opções) só na área de mensagens, salvo em `localStorage` com try/catch. Migration no `perfil` descartada: o recurso é cosmético.
- Sem migration: nenhuma regra de negócio nova.
- Verificação: `tsc` limpo, vitest 10/10, build ok. Ainda não visto no navegador.
- Dúvida respondida: e-mail local vai para o Mailpit, porque `[auth.email.smtp]` está desativado. Na nuvem é preciso SMTP próprio, pois o SMTP padrão do Supabase só envia para membros do time e tem limite baixo.
- Ajuste M4 (feedback visual): a prévia ganhou espaço e efeitos.
  - Espaço: grade do hero `1fr / 1.15fr` e altura de 26–30rem.
  - Efeitos: halo pulsando, selos flutuantes, inclinação 3D com holofote, status "pensando/digitando/online" no cabeçalho, progresso do roteiro, varredura sob o cabeçalho e mensagens surgindo com desfoque.
  - Continua decorativa e respeita `prefers-reduced-motion`.
- Ajuste M4: novo card "Lista de confiança" no hub da gestão, com a subpágina `/gestao/confianca` (RN19b).
  - Mostra a contagem, uma busca por nome, especialidade ou CRM/COREN e dois grupos, "Na lista" e "Demais", com Adicionar/Remover.
  - Usa a RPC `definir_confianca`, que já existia e já tem teste pgTAP; nenhuma RPC nova.
  - O aviso da RN19c fica explícito na tela: a mudança vale só para solicitações futuras.
  - O checkbox em Equipe continua.
- Ajuste M4:
  - "Confiança" (`/gestao/confianca`) entrou no menu principal do gestor (topo no desktop, abas no celular, atalhos do Início).
  - No fundo "Noite" do chat, o aviso do sistema passou a usar texto branco, porque estava ilegível.
- Ajuste M4 (prévia do Início e chat):
  - Os selos da prévia saíram de fora do card e entraram nele, abaixo do cabeçalho, sem sobrepor as mensagens.
  - O campo da prévia virou input real: Enter ou o botão abre o assistente com o texto digitado. Só a conversa animada continua `aria-hidden`.
  - O chat ganhou o fundo "Aurora TroKa", igual ao da prévia (navy com brilhos verde-água).
  - Nos fundos escuros (Aurora e Noite), os balões passam a ser translúcidos com texto branco.
- Ajuste M4 (chat e cabeçalho):
  - O cabeçalho do chat ganhou o avatar com indicador pulsante e uma linha de status que mostra "digitando…" com brilho, igual à prévia.
  - Com fundo escuro (Aurora/Noite), o fundo passa a cobrir o painel inteiro: cabeçalho, mensagens e campo de texto, com bordas e textos claros e o X e os botões em branco (`.chat-escuro`).
  - O texto do cabeçalho do app (nome · setor · hospital + título) agora também leva ao `/inicio`, como o logo.
- Ajuste M4 (responsividade): verificado com capturas headless em 360, 768 e 1024px (gestor e profissional, 22 telas por largura) e medição de estouro horizontal.
  - Menu do topo só a partir de `lg` (1024px); abaixo disso ficam as abas no rodapé. Em 768px o título era espremido e, no profissional, a página estourava para 832px.
  - Rodapé com rótulo curto ("Plantões"), em uma linha só.
  - `pb-40` no mobile, para o FAB não cobrir o fim do conteúdo.
  - Calendário: o título vai para uma linha própria no celular, e o "De" maiúsculo foi corrigido (`first-letter` no lugar de `capitalize`). Filtro de visões com rolagem se faltar espaço.
  - Lista de confiança: o banner virou grade, as colunas ganharam `min-w-0` (no celular iam até 487px) e os botões mostram só o ícone no celular.
  - Prévia da IA no Início só a partir de `xl`. Chat: placeholder curto e padding do cabeçalho ajustado.
  - Resultado: 0 estouros horizontais em 66 capturas. `tsc` e build ok.
- **Tema Aurora (4º tema)**: visual da prévia de IA (navy com brilhos verde-água e vidro) aplicado ao site inteiro, ao lado de TroKa, Branco e Escuro. A escolha foi manter o Escuro, que é mais sóbrio, e oferecer o Aurora como opção.
  - `lib/tema.ts`, `index.html` (aplica o tema antes do React), `SeletorTema` (ícone ✨).
  - `styles.css`: bloco `[data-theme="aurora"]` com tokens próprios. O fundo é um `body::before` fixo, porque `background-attachment` não funciona no iOS. `card`, `card-escuro` e `btn-primary` leem as variáveis opcionais `--superficie-card`, `--sombra-card`, `--superficie-escura` e `--fundo-primario`, com fallback, então os outros temas não mudam. A variante `dark:` também passa a valer no Aurora.
  - Contraste: texto principal sólido e secundário com 68% de branco. Desfoque só em cabeçalho, barra de abas, modais e menus; os cards são só translúcidos, para poupar desempenho no celular.
  - Chat: com o Aurora ativo, o fundo "Padrão" da conversa vira Aurora (`useTemaAtivo`, via MutationObserver). Uma escolha explícita no seletor continua valendo.
  - Só front, sem regra de negócio. Verificado com 66 capturas em 360, 768 e 1024px e mais 44 em 360 e 1280px. `tsc`, vitest e build ok.
  - Ajustes após teste:
    - Painel de notificações sólido (`bg-popover` com desfoque) no lugar do `card` translúcido.
    - O desfoque do cabeçalho foi para um `::before`, porque `backdrop-filter` no `header` virava containing block dos filhos `fixed` e o painel saía da tela no celular.
    - `<select>` e `<option>` com fundo sólido no Aurora, já que a lista nativa não aceita fundo translúcido.
    - Cabeçalho: o título da página deixou de ser link, porque clicar em "Anunciar plantão" levava ao Início. No lugar, um link visível "← Início" aparece fora do Início.
  - `<select>` nativo trocado por `Selecao` (Radix Select) em anunciar, plantões do setor, cadastro do profissional e cadastro público. A lista nativa é desenhada pelo navegador: no desktop e no DevTools ela sai da tela e ignora o tema. A nova lista fica na viewport (`collisionPadding` 16) e o texto longo é truncado no campo, que antes alargava a página para 372px.

## Subida para a nuvem (2026-11-03)
- **Supabase** `troKa` (`vgstaycqpvoiafxqltfp`), sa-east-1 (São Paulo, pensando em LGPD e dados de saúde), plano Free, **sem** integração GitHub: migrations só por `db push` manual com `--dry-run` antes. 11/11 migrations aplicadas (`migration list --remote`). Seed local não sobe.
- **Auth**: `[remotes.production]` no `config.toml` define `site_url` e redirect `/definir-senha` da Vercel. Mantém da nuvem `max_frequency` 1m, MFA TOTP ligado, pooler 15/200 e vector off. `enable_signup = false` (RN01: entrada só por convite ou pedido aprovado). `config push` aplicado e o diff ficou em 0.
- **SMTP**: Brevo (`smtp-relay.brevo.com:587`), remetente `jaycesar.dev@proton.me`, configurado **só no painel**, então a chave não fica no repositório. Exigido pelo Supabase Free para templates próprios e para enviar a qualquer destinatário. **A chave SMTP expira em 04/11/2027.** Remetente freemail sem DKIM/DMARC pode cair no spam; o próximo passo é um domínio próprio autenticado.
- **Front**: Vercel, projeto `troka-app` a partir de `JayCesar/troka-app` (privado, remote `meu`; `origin` continua sendo o do colega), branch de produção `develop`, root `apps/web`, install `npx -y npm@11 install` (bug `edgesOut` do npm 10.9). URL: https://troka-app-neon.vercel.app. Só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Integração Supabase↔Vercel recusada, porque injetaria a service_role.
- **Dados iniciais**: `supabase/producao/primeiro-gestor.sql`, só dados e idempotente, testado localmente com rollback. Roda no SQL Editor depois de criar o usuário no Auth.
- Pendente: secrets (`SITE_URL`, `CONSELHO_VALIDACAO=simulada`, RN01b) e `functions deploy cadastrar-profissional`, rodados pelo usuário porque o modo automático bloqueou a escrita na nuvem. Depois, smoke test.
- **M3: aviso de novo pedido de acesso** (2026-11-03). Pedido do usuário: o gestor só via o pedido entrando em Gestão.
  - Trigger `after insert` em `pedido_acesso` chama `app.avisar` para todos os gestores do hospital do pedido (RN30), com link para `/gestao/aprovacoes`.
  - O e-mail fica fora do texto do aviso. Reenvio pendente e e-mail já cadastrado não geram aviso: não há insert, e a M2 segue sem revelar quem tem conta.
  - pgTAP `m3_aviso_pedido.test.sql` (6 testes). Suíte 198/198. E2E local ok (tela /cadastro, depois o sininho da gestora).
  - Nuvem: `db push --remote` rodado pelo usuário.
- **SMTP na nuvem**: o primeiro convite deu 504 (`/invite` com `context deadline exceeded` em 10s), porque a conexão com o Brevo na porta 587 travava. Resolvido trocando a porta no painel (Authentication → Emails → SMTP Settings). O cadastro de profissional pela nuvem foi validado ponta a ponta.
- **M4: editar profissional** (2026-11-04). Pedido do usuário: corrigir um nome cadastrado errado.
  - RPC `editar_profissional(p_id, p_nome, p_especialidade_id)`: só gestor, só profissional do próprio setor (RN03/RN30; fora dele responde "não encontrado"). Nome com 3 a 120 caracteres. A FK composta garante especialidade da categoria (RN01).
  - **RN13:** a troca de especialidade é bloqueada com plantão futuro, candidatura pendente ou troca assumida em andamento. O nome pode ser corrigido sempre.
  - Categoria e CRM/COREN ficam **fora**, porque exigiriam nova validação do conselho (RN01b, Edge Function). O histórico (B8) já registra a alteração pelo trigger de `perfil`.
  - pgTAP `m4_editar_profissional.test.sql` (12 testes). Suíte 210/210.
  - Front: botão Editar na Equipe e na ficha do profissional (calendário), modal com `Selecao`. E2E local ok: nome salvo e RN13 bloqueando com mensagem clara.
  - Nuvem: `db push --remote` rodado pelo usuário (M3 e M4).
- **P1: PWA** (2026-11-04). Pedido do usuário: tornar o site instalável.
  - `vite-plugin-pwa` (generateSW). Manifest com `start_url /inicio`, standalone e ícones 192, 512 e maskable 512 gerados de `troka-icone.svg`.
  - Cache só do shell estático. `*.supabase.co` fica em **NetworkOnly**: dado de plantão e token nunca vão para o cache. Offline fora do escopo, porque a escala depende de dado fresco.
  - `registerType: prompt`: o toast "Atualizar" (`AvisoAtualizacao`) evita trocar a versão no meio de uma ação. `vercel.json` serve o `sw.js` com `no-cache`.
  - No Vitest, o módulo virtual `virtual:pwa-register/react` tem um stub. `tsc`, vitest 10/10, lint e build ok.
- **I1: IA via MCP, decisão de arquitetura** (2026-11-04).
  - O MCP é um **serviço separado** do Supabase, pedido do usuário. Será implementado depois.
  - O MCP é um adaptador fino: repassa o **JWT do usuário** para as RPCs, e as RN continuam no banco (RPC, RLS e constraints). Nunca usa service_role.
  - Tools de **leitura e escrita** desde a primeira versão. As de escrita exigem confirmação explícita do usuário antes de executar.
  - Inventário das chamadas em `docs/aidlc/mcp-inventario.md`. O chat do app (B11) vira cliente do mesmo MCP.
- **I2: leituras para o MCP** (2026-11-04). Migration `20261104220000_i2_leituras_mcp.sql`.
  - Novas RPCs: `meu_perfil`, `plantoes_periodo` (período de no máximo 93 dias), `anuncios_do_setor` e `buscar_profissional` (com `unaccent`).
  - Todas são **security invoker**: a RLS existente aplica RN03/RN29/RN30, sem duplicar regra. RN29 já era garantida pela tabela `anuncio_motivo`, que tem RLS própria.
  - pgTAP `i2_leituras_mcp.test.sql` (17 testes). Suíte 227/227.
  - Nuvem: pendente, o `db push` fica com o usuário.
- **I3: serviço MCP em Python** (2026-11-04). Fica em `services/mcp`, no mesmo repositório.
  - **Mesmo repositório**: o contrato das tools acompanha as RPCs das migrations, e um único PR muda os dois. O deploy continua independente, com Dockerfile próprio.
  - SDK `mcp` 2.x (`MCPServer`) + httpx direto no PostgREST, sem o supabase-py, que é uma dependência pesada e não necessária aqui.
  - Dois modos: `stdio`, para dev, com o token do `.env`; e `http`, stateless, com o JWT em cada requisição, pronto para ECS. Tem `/health` e proteção contra DNS rebinding via `MCP_ALLOWED_HOSTS`.
  - 30 tools: 11 de leitura e 19 de escrita, com anotações `readOnlyHint`/`destructiveHint` para o cliente pedir confirmação.
  - `resolver_pedido_acesso` vira só `recusar_pedido_acesso`: aprovar pela RPC marcaria o pedido sem o cadastro com convite (RN01b).
  - Observabilidade: um log por chamada (`alvo`, `status`, `codigo`, `ms`), sem token. O erro da RPC chega ao modelo como veio, citando a RN.
  - Verificado:
    - pytest 8/8;
    - E2E local com gestora e médico (papéis corretos; TK403/RN05 e RN04 retornados);
    - HTTP com e sem token e com token inválido;
    - nenhum token no log.
  - Próximo: OAuth 2.1 para clientes externos, tool de cadastro e B11 como cliente do MCP.
- **I5: chat do app com troca automática de modelo** (2026-11-04). Pedido do usuário: "quando um modelo não der certo, puxo outro".
  - O `POST /chat` fica no próprio `services/mcp`: o loop modelo ↔ tools chama as 30 tools no mesmo processo, então há um catálogo só.
  - Histórico em formato **neutro**, mantido stateless pelo front. Adaptadores:
    - `anthropic` (SDK oficial);
    - `openai_compat` (OpenRouter, Ollama e outros);
    - o conteúdo nativo do Claude (thinking) volta intacto quando o próximo modelo também é o Claude.
  - Roteador com cadeia `LLM_CADEIA`:
    - **troca** com timeout, rede, 401, 402, 403, 404, 408, 409, 429, 5xx e 529;
    - **não troca** com 400, 413 e 422 (bug nosso);
    - circuit breaker: 3 falhas tiram o modelo por 60 s.
  - Recusa de segurança: tratada pelo fallback **da própria Anthropic** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). **Nunca** é repassada a outro provedor, porque isso seria contornar a política.
  - Modelo padrão: `claude-opus-5-5`, com effort `medium`.
  - **Escrita pausa sempre**, qualquer que seja o modelo: o front mostra um cartão Confirmar/Cancelar. Uma mensagem nova cancela a ação pendente. Reenviar a mesma aprovação esbarra na RN do banco (testado: RN08).
  - O JWT é validado (`meu_perfil`) antes de chamar o modelo, para um token falso não gastar créditos.
  - Front: `conversar()` em `lib/services/assistente.ts`, `VITE_ASSISTENTE_URL` (URL pública, sem segredo) e o modelo que respondeu aparece no rodapé da mensagem.
  - Verificado:
    - pytest 36/36 (roteador, adaptadores e loop);
    - E2E local via HTTP com o Supabase real e um modelo roteirizado: Claude 529 → próximo assume, circuito abre na 3ª falha, anúncio criado só após a aprovação;
    - pgTAP 227/227 após `db reset`;
    - front: `tsc`, vitest 10/10 e build.
  - **Não testado** com modelos reais (o usuário ainda não tem chaves) nem a tela do chat no navegador.
- **I5: ajustes depois do primeiro uso real** (2026-11-04).
  - `max_tokens` explícito (`LLM_MAX_TOKENS`, padrão 2048) no formato OpenAI. Sem ele, o OpenRouter reservava o máximo do modelo (16.384) e devolvia 402 com saldo baixo.
  - Quando todos os modelos falham com 402, o chat diz "sem crédito no provedor".
  - **Fuso:** o banco devolve timestamptz em UTC, e um modelo grátis disse "10h às 22h" para um plantão das 07h às 19h. O `Prefer: timezone` do PostgREST não teve efeito, então o serviço converte todo timestamp da resposta para America/Sao_Paulo (`para_local`), o que vale também para clientes MCP externos. pytest 38/38.
  - **Decisão do usuário:** modelos **grátis** do OpenRouter por enquanto, e Claude quando o projeto for profissional.
    - Testados com a mesma pergunta, pelo `/chat` real:

      | Modelo | Resultado |
      |---|---|
      | `nvidia/nemotron-3.5-super-vl:free` | Acertou leitura e escrita em ~15 s |
      | `nemotron-3-ultra` | Timeout de 60 s |
      | `gemma-4-31b-it:free` | 429 (limite do plano grátis) |

    - Cadeia local: nemotron-super → nemotron-lightning → gemma.
    - Risco aceito: prompts podem ser registrados pelo provedor grátis. Os dados de teste são fictícios; a troca para pago e privado vem antes de dado real sensível (LGPD).
- **I7: publicação do serviço do assistente, preparo** (2026-11-04).
  - **Host escolhido: Render, plano grátis.**
    - 512 MB, dorme após 15 min sem uso e leva ~1 min para voltar.
    - 750 h/mês por workspace, o que basta para 1 serviço 24/7.
    - O próprio Render diz que o plano grátis não é para produção. Ok para a fase de teste.
  - **Koyeb descartado:** acorda mais rápido, mas o plano grátis passou a exigir cartão (pré-autorização) segundo fontes de 2026, e só tem região Frankfurt/Washington.
  - `render.yaml` versionado na raiz, com segredos `sync: false`. A porta vem de `PORT`, o Dockerfile não fixa porta e o healthcheck usa a mesma variável.
  - O front chama `/health` ao abrir o app (`despertarAssistente`) para esconder a partida a frio.
  - Validado localmente: imagem Docker de 177 MB, usuário sem root, healthcheck `healthy` com `PORT=10000`.
  - Pendências que dependem do usuário:
    - `db push` do I2;
    - push do commit;
    - criar o Blueprint no Render e informar os segredos;
    - `VITE_ASSISTENTE_URL` na Vercel.
