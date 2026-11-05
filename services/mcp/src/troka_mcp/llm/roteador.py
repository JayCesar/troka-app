"""Tenta os provedores em ordem; pula os que estão falhando (circuit breaker) e registra cada troca."""

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Protocol

from .tipos import DefTool, FalhaProvedor, Mensagem, RespostaModelo

log = logging.getLogger("troka_mcp.llm")


class Provedor(Protocol):
    nome: str  # ex.: "anthropic:claude-opus-5-5"

    async def gerar(self, sistema: str, mensagens: list[Mensagem], tools: list[DefTool]) -> RespostaModelo: ...


class TodosFalharam(Exception):
    def __init__(self, tentativas: list[str]):
        super().__init__("Nenhum modelo respondeu: " + "; ".join(tentativas))
        self.tentativas = tentativas


@dataclass
class _Estado:
    falhas_seguidas: int = 0
    aberto_ate: float = 0.0


@dataclass
class Resultado:
    resposta: RespostaModelo
    provedor: str
    trocas: list[str] = field(default_factory=list)  # "anthropic:x → 529 overloaded"


class Roteador:
    def __init__(
        self,
        provedores: list[Provedor],
        falhas_para_abrir: int = 3,
        pausa_s: float = 60.0,
        relogio: Callable[[], float] = time.monotonic,
    ):
        if not provedores:
            raise ValueError("Cadeia de modelos vazia.")
        self.provedores = provedores
        self._falhas_para_abrir = falhas_para_abrir
        self._pausa_s = pausa_s
        self._relogio = relogio
        self._estado = {p.nome: _Estado() for p in provedores}

    def _disponiveis(self) -> list[Provedor]:
        agora = self._relogio()
        livres = [p for p in self.provedores if self._estado[p.nome].aberto_ate <= agora]
        # Todos em pausa: tenta assim mesmo (melhor uma tentativa do que recusar o usuário)
        return livres or list(self.provedores)

    async def gerar(self, sistema: str, mensagens: list[Mensagem], tools: list[DefTool]) -> Resultado:
        trocas: list[str] = []
        for p in self._disponiveis():
            inicio = time.perf_counter()
            try:
                r = await p.gerar(sistema, mensagens, tools)
            except FalhaProvedor as e:
                ms = round((time.perf_counter() - inicio) * 1000)
                self._falhou(p.nome)
                log.warning("llm_falha provedor=%s status=%s motivo=%s ms=%s troca=%s",
                            p.nome, e.status, e.motivo, ms, e.pode_trocar)
                trocas.append(f"{p.nome} → {e.motivo}")
                if not e.pode_trocar:
                    raise TodosFalharam(trocas) from e
                continue
            ms = round((time.perf_counter() - inicio) * 1000)
            self._estado[p.nome] = _Estado()
            log.info("llm_ok provedor=%s ms=%s tokens_in=%s tokens_out=%s recusa=%s trocas=%s",
                     p.nome, ms, r.tokens_entrada, r.tokens_saida, r.recusada, len(trocas))
            return Resultado(resposta=r, provedor=p.nome, trocas=trocas)
        raise TodosFalharam(trocas)

    def _falhou(self, nome: str) -> None:
        e = self._estado[nome]
        e.falhas_seguidas += 1
        if e.falhas_seguidas >= self._falhas_para_abrir:
            e.aberto_ate = self._relogio() + self._pausa_s
            log.warning("llm_circuito_aberto provedor=%s pausa_s=%s", nome, self._pausa_s)
