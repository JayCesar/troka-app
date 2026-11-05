"""Fallback entre provedores e circuit breaker (sem rede)."""

import pytest

from troka_mcp.llm.roteador import Roteador, TodosFalharam
from troka_mcp.llm.tipos import FalhaProvedor, Mensagem, RespostaModelo

pytestmark = pytest.mark.anyio
MSGS = [Mensagem(papel="user", texto="oi")]


class Fake:
    def __init__(self, nome: str, falhas: list[FalhaProvedor | None]):
        self.nome = nome
        self._falhas = list(falhas)
        self.chamadas = 0

    async def gerar(self, sistema, mensagens, tools):
        self.chamadas += 1
        f = self._falhas.pop(0) if self._falhas else None
        if f:
            raise f
        return RespostaModelo(mensagem=Mensagem(papel="assistant", texto=f"resposta de {self.nome}"))


def sobrecarga():
    return FalhaProvedor("529 OverloadedError", True, 529)


async def test_primeiro_falha_e_o_segundo_responde():
    a, b = Fake("anthropic:x", [sobrecarga()]), Fake("openrouter:y", [])
    r = await Roteador([a, b]).gerar("s", MSGS, [])
    assert r.provedor == "openrouter:y"
    assert r.trocas == ["anthropic:x → 529 OverloadedError"]


async def test_erro_da_requisicao_nao_troca():
    a, b = Fake("anthropic:x", [FalhaProvedor("400 BadRequestError", False, 400)]), Fake("openrouter:y", [])
    with pytest.raises(TodosFalharam):
        await Roteador([a, b]).gerar("s", MSGS, [])
    assert b.chamadas == 0


async def test_todos_falham():
    with pytest.raises(TodosFalharam) as e:
        await Roteador([Fake("a:1", [sobrecarga()]), Fake("b:2", [sobrecarga()])]).gerar("s", MSGS, [])
    assert len(e.value.tentativas) == 2


async def test_circuito_pula_quem_esta_falhando_e_volta_depois_da_pausa():
    agora = [0.0]
    a, b = Fake("a:1", [sobrecarga()] * 3), Fake("b:2", [])
    rot = Roteador([a, b], falhas_para_abrir=3, pausa_s=60, relogio=lambda: agora[0])
    for _ in range(3):
        await rot.gerar("s", MSGS, [])
    assert a.chamadas == 3

    await rot.gerar("s", MSGS, [])  # circuito aberto: nem tenta o A
    assert a.chamadas == 3

    agora[0] = 61
    r = await rot.gerar("s", MSGS, [])  # passou a pausa: A volta e responde
    assert (a.chamadas, r.provedor) == (4, "a:1")


async def test_todos_em_pausa_tenta_assim_mesmo():
    a = Fake("a:1", [sobrecarga()] * 3)
    rot = Roteador([a], falhas_para_abrir=3, relogio=lambda: 0.0)
    for _ in range(3):
        with pytest.raises(TodosFalharam):
            await rot.gerar("s", MSGS, [])
    r = await rot.gerar("s", MSGS, [])
    assert r.provedor == "a:1"
