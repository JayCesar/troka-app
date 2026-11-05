"""Cliente fino do PostgREST. Não tem regra de negócio: o banco (RPC + RLS) decide tudo com o JWT do usuário."""

import logging
import time
from typing import Any

import httpx

log = logging.getLogger("troka_mcp")


class ErroTroka(Exception):
    """Erro já em linguagem de usuário (mensagem da RPC, ex.: 'RN13: ...')."""

    def __init__(self, mensagem: str, codigo: str | None = None):
        super().__init__(mensagem)
        self.codigo = codigo


class SupabaseRPC:
    def __init__(self, base_url: str, anon_key: str, client: httpx.AsyncClient | None = None):
        self._base = f"{base_url}/rest/v1"
        self._anon = anon_key
        self._http = client or httpx.AsyncClient(timeout=15)

    def _headers(self, token: str) -> dict[str, str]:
        return {"apikey": self._anon, "Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def rpc(self, funcao: str, token: str, params: dict[str, Any] | None = None) -> Any:
        corpo = {k: v for k, v in (params or {}).items() if v is not None}
        return await self._enviar("POST", f"/rpc/{funcao}", token, funcao, json=corpo)

    async def select(self, tabela: str, token: str, query: dict[str, str]) -> Any:
        return await self._enviar("GET", f"/{tabela}", token, tabela, params=query)

    async def _enviar(self, metodo: str, caminho: str, token: str, alvo: str, **kw: Any) -> Any:
        inicio = time.perf_counter()
        try:
            r = await self._http.request(metodo, self._base + caminho, headers=self._headers(token), **kw)
        except httpx.HTTPError as e:
            log.error("supabase_indisponivel alvo=%s erro=%s", alvo, type(e).__name__)
            raise ErroTroka("Não foi possível falar com o TroKa agora. Tente de novo em instantes.") from e
        ms = round((time.perf_counter() - inicio) * 1000)

        if r.status_code < 400:
            log.info("supabase_ok alvo=%s status=%s ms=%s", alvo, r.status_code, ms)
            return r.json() if r.content else None

        corpo = _json_ou_vazio(r)
        codigo = corpo.get("code")
        log.warning("supabase_erro alvo=%s status=%s codigo=%s ms=%s", alvo, r.status_code, codigo, ms)
        if r.status_code == 401 or codigo in ("PGRST301", "PGRST303"):
            raise ErroTroka("Sessão expirada ou inválida: faça login de novo no TroKa.", codigo)
        if codigo == "42501":
            raise ErroTroka("Seu perfil não tem permissão para esta ação.", codigo)
        raise ErroTroka(corpo.get("message") or "O TroKa recusou a operação.", codigo)


def _json_ou_vazio(r: httpx.Response) -> dict[str, Any]:
    try:
        corpo = r.json()
        return corpo if isinstance(corpo, dict) else {}
    except ValueError:
        return {}
