"""Monta a cadeia de modelos a partir de LLM_CADEIA, ex.:
LLM_CADEIA=anthropic:claude-opus-5-5,openrouter:<id-do-modelo>,ollama:<modelo-local>
Provedor sem chave configurada é pulado com aviso no log (nunca derruba o serviço)."""

import logging
import os

from .anthropic_claude import Claude
from .openai_compat import OpenAICompat
from .roteador import Provedor

log = logging.getLogger("troka_mcp.llm")

PADRAO = "anthropic:claude-opus-5-5"


def montar(env: dict[str, str] | None = None) -> list[Provedor]:
    env = dict(os.environ) if env is None else env
    provedores: list[Provedor] = []
    max_tokens = int(env.get("LLM_MAX_TOKENS", "2048"))  # teto de resposta nos provedores formato OpenAI
    for item in [x.strip() for x in env.get("LLM_CADEIA", PADRAO).split(",") if x.strip()]:
        tipo, _, modelo = item.partition(":")
        if not modelo:
            log.warning("llm_cadeia_item_invalido item=%s (use provedor:modelo)", item)
            continue
        if tipo == "anthropic":
            if chave := env.get("ANTHROPIC_API_KEY"):
                provedores.append(Claude(modelo, chave, effort=env.get("LLM_EFFORT", "medium")))
            else:
                log.warning("llm_sem_chave provedor=anthropic (defina ANTHROPIC_API_KEY)")
        elif tipo == "openrouter":
            if chave := env.get("OPENROUTER_API_KEY"):
                provedores.append(OpenAICompat("openrouter", modelo, "https://openrouter.ai/api/v1", chave,
                                               max_tokens=max_tokens))
            else:
                log.warning("llm_sem_chave provedor=openrouter (defina OPENROUTER_API_KEY)")
        elif tipo == "ollama":  # local, sem chave
            provedores.append(OpenAICompat("ollama", modelo, env.get("OLLAMA_URL", "http://127.0.0.1:11434/v1"), None,
                                           timeout=120.0, max_tokens=max_tokens))
        else:
            log.warning("llm_provedor_desconhecido tipo=%s", tipo)
    log.info("llm_cadeia ativos=%s", [p.nome for p in provedores])
    return provedores
