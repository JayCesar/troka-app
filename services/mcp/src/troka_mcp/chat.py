"""Loop do assistente: modelo (via roteador) ↔ tools do MCP, com pausa para confirmar ações de escrita.

Stateless: o front manda o histórico (formato neutro) e recebe o histórico atualizado.
Forjar o histórico não dá poder extra: toda tool roda com o JWT do próprio usuário e o banco aplica as RN.
"""

import json
import logging
from datetime import datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo

from mcp import Client
from pydantic import BaseModel, Field

from .llm.roteador import Roteador, TodosFalharam
from .llm.tipos import ChamadaTool, DefTool, Mensagem, ResultadoTool
from .server import INSTRUCOES, criar_servidor
from .supabase_rpc import CODIGOS_SESSAO, ErroTroka, SupabaseRPC

log = logging.getLogger("troka_mcp.chat")

MAX_HISTORICO = 80
CANCELADA = "O usuário cancelou esta ação. Não tente de novo, a não ser que ele peça."


class EntradaChat(BaseModel):
    historico: list[Mensagem] = Field(default_factory=list, max_length=MAX_HISTORICO)
    mensagem: str | None = Field(default=None, max_length=4000)
    aprovar: bool | None = None  # resposta à confirmação pendente


class Pendente(BaseModel):
    id: str
    nome: str
    descricao: str
    args: dict[str, Any]


class RespostaChat(BaseModel):
    historico: list[Mensagem]
    tipo: Literal["texto", "confirmacao", "erro"]
    texto: str | None = None
    pendentes: list[Pendente] = Field(default_factory=list)
    modelo: str | None = None
    trocas: list[str] = Field(default_factory=list)  # provedores que falharam nesta resposta


class SessaoInvalida(Exception):
    pass


class ServicoIndisponivel(Exception):
    pass


def _sistema(perfil: dict[str, Any]) -> str:
    hoje = datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%A, %d/%m/%Y %H:%M")
    return (
        f"{INSTRUCOES}\n"
        "Você é o assistente do TroKa. Responda em português do Brasil, curto e direto.\n"
        "Neste app, a confirmação de ações de escrita é feita por botões: NÃO pergunte 'posso?' em texto. "
        "Quando tiver os dados, chame a tool de escrita direto, junto com UMA frase dizendo o que vai fazer "
        "(com datas e nomes, sem ids). O usuário confirma ou cancela pelos botões.\n"
        "Nunca mostre uuids ao usuário.\n"
        "Datas para as tools: ISO 8601 com fuso -03:00.\n"
        f"Usuário: {perfil.get('nome')} ({perfil.get('papel')}), setor {perfil.get('setor')}, "
        f"hospital {perfil.get('hospital')}.\n"
        f"Agora: {hoje} (America/Sao_Paulo)."
    )


def _pendente(hist: list[Mensagem]) -> Mensagem | None:
    """Última mensagem do assistente com chamadas ainda sem resultado (confirmação em aberto)."""
    if hist and hist[-1].papel == "assistant" and hist[-1].chamadas:
        return hist[-1]
    return None


class Assistente:
    def __init__(self, roteador: Roteador, rpc: SupabaseRPC, max_passos: int = 8):
        self._roteador = roteador
        self._rpc = rpc
        self._max_passos = max_passos

    async def conversar(self, token: str, entrada: EntradaChat) -> RespostaChat:
        # Valida o JWT antes de gastar com o modelo
        try:
            linhas = await self._rpc.rpc("meu_perfil", token)
        except ErroTroka as e:
            if e.codigo in CODIGOS_SESSAO:
                raise SessaoInvalida(str(e)) from e
            raise ServicoIndisponivel(str(e)) from e  # ex.: banco sem a migration do I2
        if not linhas:
            raise SessaoInvalida("Perfil não encontrado.")
        sistema = _sistema(linhas[0])

        hist = list(entrada.historico)
        async with Client(criar_servidor(self._rpc, token_fixo=token)) as mcp:
            tools = (await mcp.list_tools()).tools
            defs = [DefTool(nome=t.name, descricao=t.description or "", schema=t.input_schema) for t in tools]
            escrita = {t.name for t in tools if not (t.annotations and t.annotations.read_only_hint)}
            descricoes = {t.name: (t.description or t.name).split("\n")[0] for t in tools}

            pendente = _pendente(hist)
            if pendente:
                # Mensagem nova sem responder à confirmação = cancelar
                aprovado = bool(entrada.aprovar)
                resultados = [
                    await self._executar(mcp, c) if (c.nome not in escrita or aprovado)
                    else ResultadoTool(chamada_id=c.id, conteudo=CANCELADA, erro=True)
                    for c in pendente.chamadas
                ]
                log.info("chat_confirmacao aprovado=%s tools=%s", aprovado, [c.nome for c in pendente.chamadas])
                hist.append(Mensagem(papel="tool", resultados=resultados))
            elif entrada.aprovar is not None:
                return RespostaChat(historico=hist, tipo="erro", texto="Não há ação aguardando confirmação.")

            if entrada.mensagem:
                hist.append(Mensagem(papel="user", texto=entrada.mensagem))
            if not hist or hist[-1].papel == "assistant":
                return RespostaChat(historico=hist, tipo="erro", texto="Envie uma mensagem.")

            trocas: list[str] = []
            for _ in range(self._max_passos):
                try:
                    res = await self._roteador.gerar(sistema, hist, defs)
                except TodosFalharam as e:
                    sem_credito = e.tentativas and all(" → 402" in t for t in e.tentativas)
                    return RespostaChat(historico=hist, tipo="erro", trocas=trocas + e.tentativas, texto=(
                        "O assistente está sem crédito no provedor de IA. Avise a gestão do TroKa." if sem_credito
                        else "O assistente está indisponível agora. Tente de novo em instantes."))
                trocas += res.trocas
                msg = res.resposta.mensagem
                hist.append(msg)

                if not msg.chamadas:
                    return RespostaChat(historico=hist, tipo="texto", texto=msg.texto, modelo=res.provedor, trocas=trocas)

                if any(c.nome in escrita for c in msg.chamadas):
                    # Pausa: nada desta rodada executa até o usuário confirmar (leituras incluídas, por simplicidade)
                    return RespostaChat(
                        historico=hist, tipo="confirmacao", texto=msg.texto, modelo=res.provedor, trocas=trocas,
                        pendentes=[Pendente(id=c.id, nome=c.nome, args=c.args, descricao=descricoes.get(c.nome, c.nome))
                                   for c in msg.chamadas if c.nome in escrita],
                    )

                hist.append(Mensagem(papel="tool", resultados=[await self._executar(mcp, c) for c in msg.chamadas]))

        return RespostaChat(historico=hist, tipo="erro", trocas=trocas,
                            texto="Não consegui concluir em poucos passos. Reformule o pedido.")

    @staticmethod
    async def _executar(mcp: Client, c: ChamadaTool) -> ResultadoTool:
        try:
            r = await mcp.call_tool(c.nome, c.args)
        except Exception as e:  # tool inexistente, args inválidos etc.: o modelo recebe o erro e corrige
            return ResultadoTool(chamada_id=c.id, conteudo=f"Falha ao chamar {c.nome}: {e}", erro=True)
        partes = [b.text for b in r.content if getattr(b, "type", "") == "text"]
        if not partes and r.structured_content is not None:
            partes = [json.dumps(r.structured_content, ensure_ascii=False)]
        return ResultadoTool(chamada_id=c.id, conteudo="\n".join(partes) or "ok", erro=bool(r.is_error))
