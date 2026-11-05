import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    supabase_url: str
    anon_key: str
    stdio_token: str | None
    host: str
    port: int
    allowed_hosts: list[str]
    cors_origins: list[str]


def carregar() -> Config:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    anon = os.environ.get("SUPABASE_ANON_KEY", "")
    if not url or not anon:
        raise SystemExit("Defina SUPABASE_URL e SUPABASE_ANON_KEY (veja .env.example).")
    return Config(
        supabase_url=url,
        anon_key=anon,
        stdio_token=os.environ.get("TROKA_ACCESS_TOKEN") or None,
        host=os.environ.get("MCP_HOST", "127.0.0.1"),
        port=int(os.environ.get("MCP_PORT", "8765")),
        # Proteção contra DNS rebinding: hosts aceitos no header Host (ex.: "mcp.troka.app,127.0.0.1:*")
        allowed_hosts=_lista("MCP_ALLOWED_HOSTS", "127.0.0.1:*,localhost:*"),
        # Origens do front que podem chamar /chat pelo navegador
        cors_origins=_lista("CHAT_CORS_ORIGINS", "http://localhost:5173"),
    )


def _lista(nome: str, padrao: str) -> list[str]:
    return [x.strip() for x in os.environ.get(nome, padrao).split(",") if x.strip()]
