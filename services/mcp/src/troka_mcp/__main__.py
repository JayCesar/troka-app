"""Entrada: `troka-mcp stdio` (dev local, token do .env) ou `troka-mcp http` (serviço: /mcp, /chat, /health)."""

import logging
import sys

import uvicorn
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import ValidationError
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .chat import Assistente, EntradaChat, SessaoInvalida
from .config import carregar
from .llm.cadeia import montar
from .llm.roteador import Roteador
from .server import criar_servidor
from .supabase_rpc import SupabaseRPC


def main() -> None:
    modo = sys.argv[1] if len(sys.argv) > 1 else "stdio"
    # stdout é o canal do protocolo no modo stdio: log só no stderr. Token e chaves nunca são logados.
    logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # o log por chamada já é o supabase_ok/erro
    cfg = carregar()
    rpc = SupabaseRPC(cfg.supabase_url, cfg.anon_key)

    if modo == "stdio":
        if not cfg.stdio_token:
            raise SystemExit("Modo stdio exige TROKA_ACCESS_TOKEN (access token do usuário logado).")
        criar_servidor(rpc, token_fixo=cfg.stdio_token).run("stdio")
    elif modo == "http":
        # No HTTP não existe token padrão: cada requisição traz o JWT do próprio usuário.
        app = criar_servidor(rpc).streamable_http_app(
            stateless_http=True,
            json_response=True,
            host=cfg.host,
            transport_security=TransportSecuritySettings(allowed_hosts=cfg.allowed_hosts),
        )
        provedores = montar()
        assistente = Assistente(Roteador(provedores), rpc) if provedores else None

        async def health(_: Request) -> JSONResponse:
            return JSONResponse({"status": "ok", "modelos": [p.nome for p in provedores]})

        async def chat(req: Request) -> JSONResponse:
            if assistente is None:
                return JSONResponse({"erro": "Assistente sem modelo configurado (veja LLM_CADEIA e as chaves no .env)."}, 503)
            auth = req.headers.get("authorization", "")
            if not auth.lower().startswith("bearer "):
                return JSONResponse({"erro": "Sem sessão."}, 401)
            try:
                entrada = EntradaChat.model_validate_json(await req.body())
            except ValidationError as e:
                return JSONResponse({"erro": "Requisição inválida.", "detalhes": e.errors(include_url=False)[:5]}, 422)
            try:
                resp = await assistente.conversar(auth[7:].strip(), entrada)
            except SessaoInvalida as e:
                return JSONResponse({"erro": str(e)}, 401)
            return JSONResponse(resp.model_dump(mode="json", by_alias=True))

        app.add_route("/health", health, methods=["GET"])
        app.add_route("/chat", chat, methods=["POST"])
        app.add_middleware(CORSMiddleware, allow_origins=cfg.cors_origins, allow_methods=["GET", "POST"],
                           allow_headers=["authorization", "content-type"])
        uvicorn.run(app, host=cfg.host, port=cfg.port, log_level="info")
    else:
        raise SystemExit("Uso: troka-mcp [stdio|http]")


if __name__ == "__main__":
    main()
