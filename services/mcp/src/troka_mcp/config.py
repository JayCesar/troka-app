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
        allowed_hosts=[h.strip() for h in os.environ.get("MCP_ALLOWED_HOSTS", "127.0.0.1:*,localhost:*").split(",") if h.strip()],
    )
