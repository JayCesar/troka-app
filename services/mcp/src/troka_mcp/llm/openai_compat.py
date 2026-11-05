"""Adaptador para APIs no formato OpenAI Chat Completions: OpenRouter, OpenAI, Groq, Ollama local..."""

import json
from typing import Any

import httpx

from .tipos import ChamadaTool, DefTool, FalhaProvedor, Mensagem, RespostaModelo, classificar_status


class OpenAICompat:
    def __init__(self, prefixo: str, modelo: str, base_url: str, api_key: str | None,
                 client: httpx.AsyncClient | None = None, timeout: float = 60.0, max_tokens: int = 2048):
        self.modelo = modelo
        self.nome = f"{prefixo}:{modelo}"
        self._url = base_url.rstrip("/") + "/chat/completions"
        self._headers = {"Content-Type": "application/json", "X-Title": "TroKa"}
        if api_key:
            self._headers["Authorization"] = f"Bearer {api_key}"
        self._http = client or httpx.AsyncClient(timeout=timeout)
        # Explícito: sem ele o OpenRouter reserva o máximo do modelo e recusa (402) contas com pouco saldo
        self._max_tokens = max_tokens

    @staticmethod
    def _mensagens(sistema: str, mensagens: list[Mensagem]) -> list[dict[str, Any]]:
        saida: list[dict[str, Any]] = [{"role": "system", "content": sistema}]
        for m in mensagens:
            if m.papel == "user":
                saida.append({"role": "user", "content": m.texto or ""})
            elif m.papel == "tool":
                saida += [{"role": "tool", "tool_call_id": r.chamada_id,
                           "content": ("ERRO: " if r.erro else "") + r.conteudo} for r in m.resultados]
            else:  # assistant (o conteúdo nativo de outro provedor é ignorado)
                msg: dict[str, Any] = {"role": "assistant", "content": m.texto or ""}
                if m.chamadas:
                    msg["tool_calls"] = [{"id": c.id, "type": "function",
                                          "function": {"name": c.nome, "arguments": json.dumps(c.args, ensure_ascii=False)}}
                                         for c in m.chamadas]
                saida.append(msg)
        return saida

    async def gerar(self, sistema: str, mensagens: list[Mensagem], tools: list[DefTool]) -> RespostaModelo:
        corpo = {
            "model": self.modelo,
            "max_tokens": self._max_tokens,
            "messages": self._mensagens(sistema, mensagens),
            "tools": [{"type": "function", "function": {"name": t.nome, "description": t.descricao, "parameters": t.schema_}}
                      for t in tools],
        }
        try:
            r = await self._http.post(self._url, headers=self._headers, json=corpo)
        except httpx.HTTPError as e:
            raise FalhaProvedor(type(e).__name__, True) from e
        if r.status_code >= 400:
            raise FalhaProvedor(f"{r.status_code} {_erro(r)}", classificar_status(r.status_code), r.status_code)

        dados = r.json()
        if "error" in dados or not dados.get("choices"):  # OpenRouter às vezes responde 200 com erro do provedor de baixo
            raise FalhaProvedor(f"erro no corpo: {str(dados.get('error'))[:120]}", True)
        escolha = dados["choices"][0]
        msg = escolha.get("message") or {}
        chamadas = [ChamadaTool(id=tc["id"], nome=tc["function"]["name"], args=_args(tc["function"].get("arguments")))
                    for tc in msg.get("tool_calls") or []]
        recusada = escolha.get("finish_reason") == "content_filter"
        texto = (msg.get("content") or "").strip() or None
        if recusada:
            texto, chamadas = "Não posso ajudar com esse pedido.", []
        uso = dados.get("usage") or {}
        return RespostaModelo(
            mensagem=Mensagem(papel="assistant", texto=texto, chamadas=chamadas, modelo=dados.get("model") or self.modelo),
            recusada=recusada,
            tokens_entrada=uso.get("prompt_tokens", 0),
            tokens_saida=uso.get("completion_tokens", 0),
        )


def _args(bruto: Any) -> dict[str, Any]:
    if isinstance(bruto, dict):
        return bruto
    try:
        v = json.loads(bruto or "{}")
        return v if isinstance(v, dict) else {}
    except json.JSONDecodeError:
        return {}  # a tool valida os argumentos e devolve o erro ao modelo


def _erro(r: httpx.Response) -> str:
    try:
        e = r.json().get("error")
        return (e.get("message") if isinstance(e, dict) else str(e))[:120]
    except ValueError:
        return r.reason_phrase
