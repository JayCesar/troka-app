"""Entrada: `troka-mcp stdio` (dev local, token do .env) ou `troka-mcp http` (serviço, token por requisição)."""

import logging
import sys

import uvicorn
from mcp.server.transport_security import TransportSecuritySettings
from starlette.requests import Request
from starlette.responses import JSONResponse

from .config import carregar
from .server import criar_servidor
from .supabase_rpc import SupabaseRPC


def main() -> None:
    modo = sys.argv[1] if len(sys.argv) > 1 else "stdio"
    # stdout é o canal do protocolo no modo stdio: log só no stderr. O token nunca é logado.
    logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # o log por chamada já é o supabase_ok/erro
    cfg = carregar()
    rpc = SupabaseRPC(cfg.supabase_url, cfg.anon_key)

    if modo == "stdio":
        if not cfg.stdio_token:
            raise SystemExit("Modo stdio exige TROKA_ACCESS_TOKEN (access token do usuário logado).")
        criar_servidor(rpc, token_stdio=cfg.stdio_token).run("stdio")
    elif modo == "http":
        # No HTTP não existe token padrão: cada requisição traz o JWT do próprio usuário.
        app = criar_servidor(rpc).streamable_http_app(
            stateless_http=True,
            json_response=True,
            host=cfg.host,
            transport_security=TransportSecuritySettings(allowed_hosts=cfg.allowed_hosts),
        )

        async def health(_: Request) -> JSONResponse:
            return JSONResponse({"status": "ok"})

        app.add_route("/health", health, methods=["GET"])
        uvicorn.run(app, host=cfg.host, port=cfg.port, log_level="info")
    else:
        raise SystemExit("Uso: troka-mcp [stdio|http]")


if __name__ == "__main__":
    main()
