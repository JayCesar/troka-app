"""Testes do adaptador (sem banco): repasse do JWT, mapeamento de erro e marcação de leitura/escrita."""

import json

import httpx
import pytest
import respx
from mcp import Client

from troka_mcp.server import criar_servidor
from troka_mcp.supabase_rpc import SupabaseRPC

URL = "http://supabase.test"
pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


def servidor(token: str | None = "jwt-do-usuario"):
    return criar_servidor(SupabaseRPC(URL, "anon-key"), token_stdio=token)


def payload(resultado) -> object:
    return json.loads(resultado.content[0].text)


@respx.mock
async def test_repassa_jwt_do_usuario_e_parametros():
    rota = respx.post(f"{URL}/rest/v1/rpc/plantoes_periodo").mock(return_value=httpx.Response(200, json=[{"id": "p1"}]))
    async with Client(servidor()) as c:
        r = await c.call_tool("plantoes_periodo", {"somente_meus": True})
    assert not r.is_error
    req = rota.calls.last.request
    assert req.headers["authorization"] == "Bearer jwt-do-usuario"
    assert req.headers["apikey"] == "anon-key"
    # None não é enviado: o default da RPC vale
    assert json.loads(req.content) == {"p_somente_meus": True}


@respx.mock
async def test_mensagem_da_regra_chega_ao_modelo():
    respx.post(f"{URL}/rest/v1/rpc/assumir_anuncio").mock(
        return_value=httpx.Response(400, json={"code": "TK409", "message": "RN14: descanso mínimo de 11 horas."})
    )
    async with Client(servidor()) as c:
        r = await c.call_tool("assumir_anuncio", {"anuncio_id": "a1"})
    assert r.is_error
    assert "RN14" in r.content[0].text


@respx.mock
async def test_jwt_expirado_vira_mensagem_de_login():
    respx.post(f"{URL}/rest/v1/rpc/meu_perfil").mock(return_value=httpx.Response(401, json={"code": "PGRST303"}))
    async with Client(servidor()) as c:
        r = await c.call_tool("meu_perfil", {})
    assert r.is_error and "login" in r.content[0].text


@respx.mock
async def test_supabase_fora_do_ar():
    respx.post(f"{URL}/rest/v1/rpc/painel_do_setor").mock(side_effect=httpx.ConnectError("boom"))
    async with Client(servidor()) as c:
        r = await c.call_tool("painel_do_setor", {})
    assert r.is_error and "Tente de novo" in r.content[0].text


async def test_sem_token_nao_chama_o_banco():
    async with Client(servidor(token=None)) as c:
        r = await c.call_tool("meu_perfil", {})
    assert r.is_error and "Authorization" in r.content[0].text


@respx.mock
async def test_recusar_pedido_nunca_aprova():
    rota = respx.post(f"{URL}/rest/v1/rpc/resolver_pedido_acesso").mock(return_value=httpx.Response(200, json={}))
    async with Client(servidor()) as c:
        await c.call_tool("recusar_pedido_acesso", {"pedido_id": "x"})
    assert json.loads(rota.calls.last.request.content)["p_aprovar"] is False


async def test_validacao_de_entrada_antes_do_banco():
    async with Client(servidor()) as c:
        r = await c.call_tool("anunciar", {"plantao_id": "p", "urgencia": "altissima"})
    assert r.is_error


async def test_leitura_e_escrita_marcadas():
    async with Client(servidor()) as c:
        tools = {t.name: t for t in (await c.list_tools()).tools}
    assert tools["plantoes_periodo"].annotations.read_only_hint is True
    assert tools["anunciar"].annotations.read_only_hint is False
    assert tools["remover_plantao"].annotations.destructive_hint is True
    assert "resolver_pedido_acesso" not in tools  # aprovação exige o cadastro com convite (RN01b)
