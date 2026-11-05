"""Conversão do formato neutro e classificação de erros por provedor."""

import json
from types import SimpleNamespace

import anthropic
import httpx
import httpx2
import pytest
import respx
from anthropic.types.beta import BetaMessage

from troka_mcp.llm.anthropic_claude import Claude
from troka_mcp.llm.cadeia import montar
from troka_mcp.llm.openai_compat import OpenAICompat
from troka_mcp.llm.tipos import ChamadaTool, DefTool, FalhaProvedor, Mensagem, Nativo, ResultadoTool

pytestmark = pytest.mark.anyio
TOOLS = [DefTool(nome="meu_perfil", descricao="perfil", schema={"type": "object", "properties": {}})]
OR_URL = "https://openrouter.ai/api/v1/chat/completions"

# Conversa que começou no Claude (com thinking) e chamou uma tool
HIST = [
    Mensagem(papel="user", texto="quem sou eu?"),
    Mensagem(papel="assistant", chamadas=[ChamadaTool(id="toolu_1", nome="meu_perfil")],
             nativo=Nativo(provedor="anthropic", modelo="claude-opus-5-5", conteudo=[
                 {"type": "thinking", "thinking": "", "signature": "sig"},
                 {"type": "tool_use", "id": "toolu_1", "name": "meu_perfil", "input": {}}])),
    Mensagem(papel="tool", resultados=[ResultadoTool(chamada_id="toolu_1", conteudo='{"nome": "Ana"}')]),
]


# ---------------------------------------------------------------- OpenAI-compatível
@respx.mock
async def test_openrouter_continua_conversa_iniciada_no_claude():
    rota = respx.post(OR_URL).mock(return_value=httpx.Response(200, json={
        "model": "x/y", "usage": {"prompt_tokens": 9, "completion_tokens": 3},
        "choices": [{"finish_reason": "tool_calls", "message": {"content": None, "tool_calls": [
            {"id": "call_9", "type": "function", "function": {"name": "plantoes_periodo", "arguments": '{"somente_meus": true}'}}]}}],
    }))
    r = await OpenAICompat("openrouter", "x/y", "https://openrouter.ai/api/v1", "k").gerar("sis", HIST, TOOLS)
    corpo = json.loads(rota.calls.last.request.content)
    assert [m["role"] for m in corpo["messages"]] == ["system", "user", "assistant", "tool"]
    assert corpo["messages"][2]["tool_calls"][0]["id"] == "toolu_1"  # thinking do Claude ignorado
    assert corpo["messages"][3] == {"role": "tool", "tool_call_id": "toolu_1", "content": '{"nome": "Ana"}'}
    assert corpo["tools"][0]["function"]["name"] == "meu_perfil"
    assert corpo["max_tokens"] == 2048  # evita a reserva do máximo do modelo (402 com pouco saldo)
    assert rota.calls.last.request.headers["authorization"] == "Bearer k"
    assert r.mensagem.chamadas == [ChamadaTool(id="call_9", nome="plantoes_periodo", args={"somente_meus": True})]
    assert (r.tokens_entrada, r.tokens_saida) == (9, 3)


@respx.mock
@pytest.mark.parametrize(("resposta", "troca"), [
    (httpx.Response(429, json={"error": {"message": "rate"}}), True),
    (httpx.Response(402, json={"error": {"message": "sem crédito"}}), True),
    (httpx.Response(503), True),
    (httpx.Response(200, json={"error": {"message": "upstream"}}), True),
    (httpx.Response(400, json={"error": {"message": "schema"}}), False),
])
async def test_openrouter_classifica_erros(resposta, troca):
    respx.post(OR_URL).mock(return_value=resposta)
    with pytest.raises(FalhaProvedor) as e:
        await OpenAICompat("openrouter", "x/y", "https://openrouter.ai/api/v1", "k").gerar("s", HIST, TOOLS)
    assert e.value.pode_trocar is troca


@respx.mock
async def test_openrouter_fora_do_ar_troca():
    respx.post(OR_URL).mock(side_effect=httpx.ConnectError("x"))
    with pytest.raises(FalhaProvedor) as e:
        await OpenAICompat("openrouter", "x/y", "https://openrouter.ai/api/v1", "k").gerar("s", HIST, TOOLS)
    assert e.value.pode_trocar


# ---------------------------------------------------------------- Claude
class FakeAnthropic:
    def __init__(self, resposta=None, erro=None):
        self.params = None

        async def create(**params):
            self.params = params
            if erro:
                raise erro
            return BetaMessage.model_validate(resposta)

        self.beta = SimpleNamespace(messages=SimpleNamespace(create=create))


def msg(content, stop="end_turn"):
    return {"id": "m", "type": "message", "role": "assistant", "model": "claude-opus-5-5", "content": content,
            "stop_reason": stop, "stop_sequence": None, "usage": {"input_tokens": 10, "output_tokens": 5}}


def erro(cls, status):
    resp = httpx2.Response(status, request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages"))
    return cls("x", response=resp, body=None)


async def test_claude_devolve_thinking_intacto_e_converte_tool_result():
    fake = FakeAnthropic(msg([{"type": "text", "text": "Você é a Ana."}]))
    r = await Claude("claude-opus-5-5", "k", client=fake).gerar("sis", HIST, TOOLS)
    m = fake.params["messages"]
    assert m[1]["content"][0] == {"type": "thinking", "thinking": "", "signature": "sig"}
    assert m[2]["content"][0]["type"] == "tool_result" and m[2]["content"][0]["tool_use_id"] == "toolu_1"
    assert fake.params["fallbacks"] == "default"  # fallback de recusa da própria Anthropic
    assert fake.params["output_config"] == {"effort": "medium"}
    assert r.mensagem.texto == "Você é a Ana." and r.mensagem.nativo.provedor == "anthropic"


async def test_claude_continua_conversa_iniciada_em_outro_provedor():
    hist = [Mensagem(papel="user", texto="oi"),
            Mensagem(papel="assistant", chamadas=[ChamadaTool(id="call:9/x", nome="meu_perfil")], modelo="x/y"),
            Mensagem(papel="tool", resultados=[ResultadoTool(chamada_id="call:9/x", conteudo="{}")])]
    fake = FakeAnthropic(msg([{"type": "text", "text": "ok"}]))
    await Claude("claude-opus-5-5", "k", client=fake).gerar("s", hist, TOOLS)
    m = fake.params["messages"]
    assert m[1]["content"][0]["id"] == m[2]["content"][0]["tool_use_id"] == "call_9_x"  # id saneado dos dois lados


async def test_claude_recusa_nao_vira_troca():
    r = await Claude("claude-opus-5-5", "k", client=FakeAnthropic(msg([], stop="refusal"))).gerar("s", HIST, TOOLS)
    assert r.recusada and r.mensagem.chamadas == [] and r.mensagem.nativo is None


@pytest.mark.parametrize(("exc", "troca"), [
    (erro(anthropic.OverloadedError, 529), True),
    (erro(anthropic.RateLimitError, 429), True),
    (erro(anthropic.AuthenticationError, 401), True),
    (erro(anthropic.BadRequestError, 400), False),
])
async def test_claude_classifica_erros(exc, troca):
    with pytest.raises(FalhaProvedor) as e:
        await Claude("claude-opus-5-5", "k", client=FakeAnthropic(erro=exc)).gerar("s", HIST, TOOLS)
    assert e.value.pode_trocar is troca


# ---------------------------------------------------------------- cadeia
def test_cadeia_pula_provedor_sem_chave():
    nomes = [p.nome for p in montar({
        "LLM_CADEIA": "anthropic:claude-opus-5-5, openrouter:a/b, ollama:qwen, xpto:z",
        "OPENROUTER_API_KEY": "k",
    })]
    assert nomes == ["openrouter:a/b", "ollama:qwen"]
