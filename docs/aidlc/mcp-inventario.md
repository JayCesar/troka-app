# Inventário de chamadas do front: base para o MCP (I1)

Este inventário lista tudo o que `apps/web` chama no Supabase (levantado em 2026-11-04). Cada RPC vira uma **tool** do MCP.

O MCP é um **serviço à parte** e não tem regra própria: repassa o **JWT do usuário**, e as RPCs, a RLS e as constraints aplicam as RN. A decisão está no `audit.md`, item I1.

Legenda:
- **Papel**: `anon` (sem login), `prof` (profissional), `gestor`, `todos` (qualquer usuário autenticado).
- **Tipo**: `L` para leitura e `E` para escrita. Toda tool de escrita pede confirmação do usuário antes de executar.

## Auth (supabase-js, não vira tool)
| Chamada | Uso no front |
|---|---|
| `signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange` | Sessão (`lib/auth.tsx`) |
| `resetPasswordForEmail` | "Esqueci a senha" (`routes/index.tsx`) |
| `updateUser` | Definir senha pelo convite (`routes/definir-senha.tsx`) |

O MCP **não** faz login por conta própria: recebe o access token do usuário, via OAuth ou pelo próprio app.

## RPCs, que viram tools

### Cadastro e acesso
| RPC | Parâmetros | Papel | Tipo | RN |
|---|---|---|---|---|
| `hospitais_para_cadastro` | — | anon | L | RN01 |
| `solicitar_acesso` | `p_hospital_id uuid, p_nome, p_email, p_funcao, p_conselho?` | anon | E | RN01, RN01b |
| `resolver_pedido_acesso` | `p_pedido_id uuid, p_aprovar bool` | gestor | E | RN01, RN30 |

### Plantões
| RPC | Parâmetros | Papel | Tipo | RN |
|---|---|---|---|---|
| `criar_plantao` | `p_especialidade_id, p_inicio, p_fim, p_profissional_id?` | gestor | E | RN04, RN05, RN13, RN14 |
| `editar_plantao` | `p_id, p_especialidade_id, p_inicio, p_fim, p_profissional_id?` | gestor | E | RN04, RN05, RN13, RN14 |
| `remover_plantao` | `p_id` | gestor | E | RN05, RN25 |

### Anúncios (troca)
| RPC | Parâmetros | Papel | Tipo | RN |
|---|---|---|---|---|
| `anunciar` | `p_plantao_id, p_urgencia ('normal'\|'urgente'), p_motivo_categoria? ('saude'\|'pessoal'\|'outro'), p_motivo_texto?` | prof | E | RN07–RN10, RN29 |
| `cancelar_anuncio` | `p_anuncio_id` | prof (dono) | E | RN22 |
| `definir_adicional` | `p_anuncio_id, p_valor numeric` | gestor | E | RN17, RN17b, RN18 |

### Ofertas e candidaturas (profissional)
| RPC | Parâmetros | Papel | Tipo | RN |
|---|---|---|---|---|
| `ofertas_para_mim` | — | prof | L | RN11–RN15 |
| `minhas_solicitacoes` | — | prof | L | RN03 |
| `assumir_anuncio` | `p_anuncio_id` | prof | E | RN12–RN15, RN19c |
| `desistir_anuncio` | `p_anuncio_id` | prof | E | RN22b |
| `candidatar` | `p_plantao_id` | prof | E | RN06c, RN12–RN14 |
| `desistir_candidatura` | `p_candidatura_id` | prof | E | RN06c |

### Gestão
| RPC | Parâmetros | Papel | Tipo | RN |
|---|---|---|---|---|
| `painel_do_setor` | — | gestor | L | RN28 |
| `pendencias_do_setor` | — | gestor | L | RN19, RN21 |
| `equipe_do_setor` | — | gestor | L | RN03 |
| `historico_do_setor` | `p_limite int = 200` | gestor | L | RN25–RN27 |
| `aprovar_troca` / `recusar_troca` | `p_anuncio_id` | gestor | E | RN16, RN19, RN20, RN21 |
| `aprovar_candidatura` / `recusar_candidatura` | `p_candidatura_id` | gestor | E | RN06c, RN16 |
| `definir_confianca` | `p_profissional_id, p_confiavel bool` | gestor | E | RN19b |
| `editar_profissional` | `p_id, p_nome, p_especialidade_id` | gestor | E | RN03, RN13, RN30 |
| `resolver_alerta` | `p_alerta_id` | gestor | E | RN24 |

### Avisos
| RPC | Parâmetros | Papel | Tipo | RN |
|---|---|---|---|---|
| `marcar_avisos_lidos` | — | todos | E | — |

## Leituras diretas por RLS (`.from`)
| Tabela | Onde no front | Observação para o MCP |
|---|---|---|
| `plantao` | `useMeusPlantoes`, `usePlantoesSetor` | Viram as tools `meus_plantoes` e `plantoes_do_setor`, com filtro de período |
| `anuncio` | `useAnunciosSetor` | **RN29**: o motivo nunca vai para terceiros. Preferir uma RPC/view que já exclua o motivo, em vez do `select *` |
| `especialidade`, `perfil` | selects do formulário | Lookup para resolver nome → uuid |
| `aviso` | `useAvisos` | Notificações do usuário |
| `alerta` | `useAlertas` | Gestor (RN24) |
| `pedido_acesso` | `usePedidosAcesso` | Gestor |

## Edge Functions
| Função | Papel | Observação |
|---|---|---|
| `cadastrar-profissional` | gestor | Envia o convite e valida o conselho (RN01b, secret `CONSELHO_VALIDACAO`). Pode virar tool chamando a função com o JWT do usuário |

## RPCs criadas para o MCP (I2, migration `20261104220000_i2_leituras_mcp.sql`)
Todas são `security invoker`: a RLS existente filtra (RN03, RN29, RN30). Testes em `supabase/tests/i2_leituras_mcp.test.sql` (17).

| RPC | Parâmetros | Papel | Substitui |
|---|---|---|---|
| `meu_perfil` | — | todos | `.from("perfil")` do `auth.tsx` |
| `plantoes_periodo` | `p_de?, p_ate? (≤ 93 dias), p_somente_meus?, p_profissional_id?` | todos | `useMeusPlantoes`, `usePlantoesSetor` |
| `anuncios_do_setor` | — | todos (motivo só para o gestor e o anunciante) | `useAnunciosSetor` |
| `buscar_profissional` | `p_termo` (≥ 2 letras, sem acento) | todos | busca por nome → uuid |

## Fora do MCP por enquanto
- `hospitais_para_cadastro` e `solicitar_acesso`: são fluxos de quem não está logado (anon).
- Aprovar pedido de acesso: depende do cadastro com convite (Edge Function, RN01b). No MCP só existe a recusa.
- `cadastrar-profissional`: fica para depois, como tool que chama a Edge Function com o JWT do gestor.
- O chat do app (B11: `enviarAoAssistente`, `transcreverAudio`) passa a ser cliente do mesmo MCP.
