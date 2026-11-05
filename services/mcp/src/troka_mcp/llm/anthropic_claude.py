"""Adaptador do Claude (SDK oficial `anthropic`)."""

import re
from typing import Any

import anthropic

from .tipos import ChamadaTool, DefTool, FalhaProvedor, Mensagem, Nativo, RespostaModelo, classificar_status

# Modelos que aceitam o fallback de recusa do próprio servidor da Anthropic (`fallbacks: "default"`).
# Recusa de segurança NUNCA é repassada a outro provedor: isso seria contornar a política.
_COM_FALLBACK_DE_RECUSA = {"claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"}
_ID_VALIDO = re.compile(r"[^a-zA-Z0-9_-]")


def _id(x: str) -> str:
    return _ID_VALIDO.sub("_", x)[:64] or "id"


class Claude:
    def __init__(self, modelo: str, api_key: str, effort: str = "medium", client: anthropic.AsyncAnthropic | None = None):
        self.modelo = modelo
        self.nome = f"anthropic:{modelo}"
        self._effort = effort
        # 1 retry no SDK; acima disso quem decide é o roteador (troca de provedor)
        self._client = client or anthropic.AsyncAnthropic(api_key=api_key, max_retries=1, timeout=60.0)

    def _mensagens(self, mensagens: list[Mensagem]) -> list[dict[str, Any]]:
        saida: list[dict[str, Any]] = []
        for m in mensagens:
            if m.papel == "user":
                saida.append({"role": "user", "content": m.texto or ""})
            elif m.papel == "tool":
                saida.append({"role": "user", "content": [
                    {"type": "tool_result", "tool_use_id": _id(r.chamada_id), "content": r.conteudo, "is_error": r.erro}
                    for r in m.resultados
                ]})
            elif m.nativo and m.nativo.provedor == "anthropic":
                # Devolve intacto (inclui thinking). Se o modelo for outro, a API descarta o que não lê.
                saida.append({"role": "assistant", "content": m.nativo.conteudo})
            else:
                blocos: list[dict[str, Any]] = [{"type": "text", "text": m.texto}] if m.texto else []
                blocos += [{"type": "tool_use", "id": _id(c.id), "name": c.nome, "input": c.args} for c in m.chamadas]
                saida.append({"role": "assistant", "content": blocos or [{"type": "text", "text": "…"}]})
        return saida

    async def gerar(self, sistema: str, mensagens: list[Mensagem], tools: list[DefTool]) -> RespostaModelo:
        params: dict[str, Any] = dict(
            model=self.modelo,
            max_tokens=16000,
            system=sistema,
            messages=self._mensagens(mensagens),
            tools=[{"name": t.nome, "description": t.descricao, "input_schema": t.schema_} for t in tools],
            output_config={"effort": self._effort},
        )
        if self.modelo in _COM_FALLBACK_DE_RECUSA:
            params |= {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}
        try:
            r = await self._client.beta.messages.create(**params)
        except anthropic.APIStatusError as e:
            raise FalhaProvedor(f"{e.status_code} {type(e).__name__}", classificar_status(e.status_code), e.status_code) from e
        except anthropic.APIConnectionError as e:  # inclui timeout
            raise FalhaProvedor(type(e).__name__, True) from e

        texto = "\n".join(b.text for b in r.content if b.type == "text").strip() or None
        chamadas = [ChamadaTool(id=b.id, nome=b.name, args=dict(b.input or {})) for b in r.content if b.type == "tool_use"]
        recusada = r.stop_reason == "refusal"
        if recusada:
            texto, chamadas = "Não posso ajudar com esse pedido.", []
        conteudo = r.model_dump(mode="json", exclude_unset=True)["content"]
        return RespostaModelo(
            mensagem=Mensagem(papel="assistant", texto=texto, chamadas=chamadas, modelo=r.model,
                              nativo=None if recusada else Nativo(provedor="anthropic", modelo=r.model, conteudo=conteudo)),
            recusada=recusada,
            tokens_entrada=r.usage.input_tokens,
            tokens_saida=r.usage.output_tokens,
        )
