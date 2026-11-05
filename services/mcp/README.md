# troka-mcp

Servidor MCP do TroKa. Expõe as RPCs do Supabase como **30 tools**: 11 de leitura e 19 de escrita. O catálogo completo está em `docs/aidlc/mcp-inventario.md`.

## Princípios
- **Nenhuma regra de negócio aqui.** As RN ficam no banco (RPC, RLS e constraints). Este serviço só traduz tool → RPC.
- **Sempre o JWT do usuário.** Nunca a service_role. O Supabase valida o token; o serviço não interpreta nem guarda o token, e nunca o registra em log.
- **Escrita com confirmação.** Tools de escrita têm `readOnlyHint=false`, e as destrutivas também `destructiveHint=true`. O cliente MCP pede confirmação antes de executar.
- Aprovar pedido de acesso fica **fora** (só existe `recusar_pedido_acesso`): aprovar depende do cadastro com convite (RN01b, Edge Function).

## Rodar local
```bash
cd services/mcp
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp .env.example .env    # preencha SUPABASE_ANON_KEY (npx supabase status)
```

**stdio** (Claude Code / Claude Desktop): o token do usuário vem do `.env`.
```bash
# access token de um usuário de teste
curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"carlos@troka.app","password":"troka123"}' | jq -r .access_token
# coloque em TROKA_ACCESS_TOKEN no .env (expira em 1h)
set -a; . ./.env; set +a
claude mcp add troka -- "$PWD/.venv/bin/troka-mcp" stdio
```

**HTTP** (serviço): cada requisição traz `Authorization: Bearer <access token do usuário>`.
```bash
set -a; . ./.env; set +a; .venv/bin/troka-mcp http    # http://127.0.0.1:8765/mcp, /health
```

## Assistente (`POST /chat`) com troca de modelo
O chat do app chama `/chat` com o JWT do usuário. O serviço roda o loop modelo ↔ tools aqui mesmo, usando as mesmas 30 tools.

```
LLM_CADEIA=anthropic:claude-opus-5-5,openrouter:<id-do-modelo>,ollama:<modelo-local>
```
- **Ordem = preferência.** Se um modelo falha, o próximo assume com o mesmo histórico, inclusive no meio de uma conversa.
- **Quando troca:** timeout, falha de rede, 401, 402, 403, 404, 408, 409, 429, 5xx e 529.
- **Quando não troca:** 400, 413 e 422, que indicam bug na nossa requisição.
- **Circuit breaker:** depois de 3 falhas seguidas, o modelo é pulado por 60 s.
- **Recusa de segurança do Claude não vai para outro provedor.** Quem trata é o fallback da própria Anthropic (`fallbacks: "default"`); se a recusa continuar, ela é respondida ao usuário.
- **Escrita sempre pausa.** A resposta vem como `tipo: "confirmacao"` e só executa quando o front reenviar com `aprovar: true`. Uma mensagem nova no lugar da confirmação cancela a ação.
- **O JWT é validado antes de chamar o modelo**, para um token falso não gastar créditos.
- **Provedor sem chave é pulado.** Sem nenhum modelo, `/chat` responde 503, e `/health` lista os modelos ativos.
- **Log por resposta:** `llm_ok` / `llm_falha` / `llm_circuito_aberto` (provedor, ms, tokens, trocas) e `chat_confirmacao`.

Front: defina `VITE_ASSISTENTE_URL=http://127.0.0.1:8765` em `apps/web/.env.local`.

## Testes
```bash
.venv/bin/pytest -q    # tools, roteador, adaptadores e loop do chat (sem rede nem chaves)
```

## Deploy
`Dockerfile` pronto para ECS/Fargate (porta 8765, `GET /health`, usuário sem root). Em produção:
- `MCP_ALLOWED_HOSTS` deve ter o domínio do serviço.
- Coloque um ALB com HTTPS na frente.

## Próximos passos
- **OAuth 2.1** (Supabase como authorization server) para clientes externos (Claude.ai, Claude Desktop) obterem o token sem copiar e colar.
- `cadastrar_profissional`, chamando a Edge Function com o JWT do gestor.
