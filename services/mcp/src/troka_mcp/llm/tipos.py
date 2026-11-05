"""Formato neutro da conversa. Cada adaptador converte de/para o formato do seu provedor,
então o histórico continua válido quando o roteador troca de modelo no meio da conversa."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChamadaTool(BaseModel):
    id: str
    nome: str
    args: dict[str, Any] = Field(default_factory=dict)


class ResultadoTool(BaseModel):
    chamada_id: str
    conteudo: str
    erro: bool = False


class Nativo(BaseModel):
    """Conteúdo original do provedor (ex.: blocos de thinking do Claude), devolvido intacto
    quando o mesmo provedor gera a próxima resposta. Outros provedores ignoram."""

    provedor: str
    modelo: str
    conteudo: Any


class Mensagem(BaseModel):
    papel: Literal["user", "assistant", "tool"]
    texto: str | None = None
    chamadas: list[ChamadaTool] = Field(default_factory=list)  # assistant
    resultados: list[ResultadoTool] = Field(default_factory=list)  # tool
    nativo: Nativo | None = None  # assistant
    modelo: str | None = None  # quem gerou (assistant), para exibir e auditar


class DefTool(BaseModel):
    nome: str
    descricao: str
    schema_: dict[str, Any] = Field(alias="schema")

    model_config = {"populate_by_name": True}


class RespostaModelo(BaseModel):
    mensagem: Mensagem
    recusada: bool = False  # recusa de segurança: não troca de provedor
    tokens_entrada: int = 0
    tokens_saida: int = 0


class FalhaProvedor(Exception):
    """Falha de um provedor. `pode_trocar` diz se o roteador deve tentar o próximo."""

    def __init__(self, motivo: str, pode_trocar: bool, status: int | None = None):
        super().__init__(motivo)
        self.motivo = motivo
        self.pode_trocar = pode_trocar
        self.status = status


def classificar_status(status: int) -> bool:
    """True = vale tentar outro provedor. 400/413/422 são erro da nossa requisição: trocar só esconderia o bug."""
    return status not in (400, 413, 422)
