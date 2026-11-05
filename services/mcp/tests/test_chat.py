"""Loop do assistente: leitura direta, pausa para escrita, cancelamento, sessão inválida e troca de modelo no meio."""

import httpx
import pytest
import respx

from troka_mcp.chat import CANCELADA, Assistente, EntradaChat, SessaoInvalida
from troka_mcp.llm.roteador import Roteador
from troka_mcp.llm.tipos import ChamadaTool, FalhaProvedor, Mensagem, RespostaModelo
from troka_mcp.supabase_rpc import SupabaseRPC

pytestmark = pytest.mark.anyio
URL = "http://supabase.test"
PERFIL = [{"nome": "Dr. Carlos", "papel": "profissional", "setor": "UTI", "hospital": "Vila Nova"}]


class Roteiro:
    """Provedor falso que devolve respostas pré-definidas (ou falha) em ordem."""

    def __init__(self, nome, passos):
        self.nome, self._passos, self.vistos = nome, list(passos), []

    async def gerar(self, sistema, mensagens, tools):
        self.vistos.append(list(mensagens))
        p = self._passos.pop(0)
        if isinstance(p, FalhaProvedor):
            raise p
        return RespostaModelo(mensagem=p)


def fala(texto):
    return Mensagem(papel="assistant", texto=texto)


def chama(nome, **args):
    return Mensagem(papel="assistant", chamadas=[ChamadaTool(id=f"c_{nome}", nome=nome, args=args)])


def assistente(*provedores):
    return Assistente(Roteador(list(provedores)), SupabaseRPC(URL, "anon"))


def supabase(**rotas):
    respx.post(f"{URL}/rest/v1/rpc/meu_perfil").mock(return_value=httpx.Response(200, json=PERFIL))
    return {n: respx.post(f"{URL}/rest/v1/rpc/{n}").mock(return_value=httpx.Response(200, json=v)) for n, v in rotas.items()}


@respx.mock
async def test_leitura_executa_direto_e_responde():
    r = supabase(plantoes_periodo=[{"id": "p1", "inicio": "2026-11-06T07:00:00-03:00"}])
    m = Roteiro("a:1", [chama("plantoes_periodo", somente_meus=True), fala("Você tem 1 plantão na sexta.")])
    resp = await assistente(m).conversar("jwt", EntradaChat(mensagem="meus plantões?"))
    assert resp.tipo == "texto" and resp.texto == "Você tem 1 plantão na sexta." and resp.modelo == "a:1"
    assert r["plantoes_periodo"].called
    assert r["plantoes_periodo"].calls.last.request.headers["authorization"] == "Bearer jwt"
    assert [x.papel for x in resp.historico] == ["user", "assistant", "tool", "assistant"]


@respx.mock
async def test_escrita_pausa_e_so_executa_apos_aprovar():
    r = supabase(anunciar={"id": "an1"})
    m = Roteiro("a:1", [chama("anunciar", plantao_id="p1", urgencia="urgente"), fala("Anúncio criado.")])
    a = assistente(m)

    passo1 = await a.conversar("jwt", EntradaChat(mensagem="anuncie meu plantão de sexta"))
    assert passo1.tipo == "confirmacao"
    assert passo1.pendentes[0].nome == "anunciar" and passo1.pendentes[0].args["urgencia"] == "urgente"
    assert not r["anunciar"].called

    passo2 = await a.conversar("jwt", EntradaChat(historico=passo1.historico, aprovar=True))
    assert r["anunciar"].called
    assert passo2.tipo == "texto" and passo2.texto == "Anúncio criado."


@respx.mock
async def test_cancelar_nao_executa_e_avisa_o_modelo():
    r = supabase(remover_plantao={})
    m = Roteiro("a:1", [chama("remover_plantao", id="p1"), fala("Tudo bem, não removi.")])
    a = assistente(m)
    p1 = await a.conversar("jwt", EntradaChat(mensagem="remova o plantão"))
    p2 = await a.conversar("jwt", EntradaChat(historico=p1.historico, aprovar=False))
    assert not r["remover_plantao"].called
    resultado = p2.historico[-2].resultados[0]
    assert resultado.erro and resultado.conteudo == CANCELADA


@respx.mock
async def test_mensagem_nova_no_lugar_da_confirmacao_cancela():
    r = supabase(anunciar={})
    m = Roteiro("a:1", [chama("anunciar", plantao_id="p1", urgencia="normal"), fala("Ok, outra coisa então.")])
    a = assistente(m)
    p1 = await a.conversar("jwt", EntradaChat(mensagem="anuncie"))
    p2 = await a.conversar("jwt", EntradaChat(historico=p1.historico, mensagem="esquece, mostra meus plantões"))
    assert not r["anunciar"].called and p2.tipo == "texto"


@respx.mock
async def test_jwt_invalido_nao_gasta_modelo():
    respx.post(f"{URL}/rest/v1/rpc/meu_perfil").mock(return_value=httpx.Response(401, json={"code": "PGRST303"}))
    m = Roteiro("a:1", [fala("não deveria")])
    with pytest.raises(SessaoInvalida):
        await assistente(m).conversar("lixo", EntradaChat(mensagem="oi"))
    assert m.vistos == []


@respx.mock
async def test_modelo_cai_no_meio_e_o_proximo_continua():
    supabase(ofertas_para_mim=[{"plantao_id": "p9"}])
    a = Roteiro("anthropic:x", [chama("ofertas_para_mim"), FalhaProvedor("529 OverloadedError", True, 529)])
    b = Roteiro("openrouter:y", [fala("Há 1 plantão disponível.")])
    resp = await assistente(a, b).conversar("jwt", EntradaChat(mensagem="tem plantão pra mim?"))
    assert resp.tipo == "texto" and resp.modelo == "openrouter:y"
    assert resp.trocas == ["anthropic:x → 529 OverloadedError"]
    assert [x.papel for x in b.vistos[0]] == ["user", "assistant", "tool"]  # B recebeu a conversa inteira


@respx.mock
async def test_todos_os_modelos_fora():
    supabase()
    resp = await assistente(Roteiro("a:1", [FalhaProvedor("503", True, 503)])).conversar("jwt", EntradaChat(mensagem="oi"))
    assert resp.tipo == "erro" and "indisponível" in resp.texto


@respx.mock
async def test_tool_inexistente_volta_como_erro_para_o_modelo():
    supabase()
    m = Roteiro("a:1", [chama("apagar_tudo"), fala("Não existe essa ação.")])
    resp = await assistente(m).conversar("jwt", EntradaChat(mensagem="apague tudo"))
    resultado = resp.historico[2].resultados[0]
    assert resultado.erro and "apagar_tudo" in resultado.conteudo
    assert resp.texto == "Não existe essa ação."


@respx.mock
async def test_sem_credito_avisa_com_clareza():
    supabase()
    sem = Roteiro("openrouter:x", [FalhaProvedor("402 sem crédito", True, 402)])
    resp = await assistente(sem).conversar("jwt", EntradaChat(mensagem="oi"))
    assert resp.tipo == "erro" and "sem crédito" in resp.texto


@respx.mock
async def test_funcao_ausente_no_banco_nao_vira_sessao_expirada():
    from troka_mcp.chat import ServicoIndisponivel
    respx.post(f"{URL}/rest/v1/rpc/meu_perfil").mock(return_value=httpx.Response(
        404, json={"code": "PGRST202", "message": "Could not find the function public.meu_perfil"}))
    with pytest.raises(ServicoIndisponivel):
        await assistente(Roteiro("a:1", [])).conversar("jwt", EntradaChat(mensagem="oi"))
