"""Tools do TroKa. Cada tool é um adaptador 1:1 de uma RPC (docs/aidlc/mcp-inventario.md).

Regras:
- Nenhuma regra de negócio aqui: as RN estão no banco (RPC, RLS e constraints).
- Toda chamada usa o JWT do usuário. Nunca a service_role.
- Tools de escrita são marcadas com readOnlyHint=False, então o cliente MCP pede confirmação antes de executar.
"""

from typing import Annotated, Any, Literal

from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations
from pydantic import Field

from .supabase_rpc import ErroTroka, SupabaseRPC

LEITURA = ToolAnnotations(readOnlyHint=True, openWorldHint=False)
ESCRITA = ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
DESTRUTIVA = ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=False)

Uuid = Annotated[str, Field(description="UUID do registro (obtenha com as tools de leitura/busca)")]
DataHora = Annotated[str, Field(description="Data e hora ISO 8601 com fuso, ex.: 2026-11-10T07:00:00-03:00")]

INSTRUCOES = """\
TroKa: troca e cobertura de plantões hospitalares.
- Comece com `meu_perfil` para saber se o usuário é profissional ou gestor.
- Para achar uuids, use `buscar_profissional`, `plantoes_periodo` e `anuncios_do_setor`; nunca invente ids.
- As regras (RN) são aplicadas pelo servidor. Se uma ação for recusada, mostre a mensagem ao usuário como veio
  (ela cita a RN) e não tente contornar.
- Antes de qualquer ação de escrita, resuma o que vai fazer e peça a confirmação do usuário.
- Nunca exponha o motivo de um anúncio a quem não é o anunciante nem o gestor (RN29); o servidor já omite.
"""


def _token(ctx: Context, token_fixo: str | None) -> str:
    # O header não é prova de identidade aqui: só repassamos o JWT, e quem o valida é o Supabase.
    try:
        headers = ctx.headers or {}
    except ValueError:  # fora de uma requisição (ex.: chamada direta em teste)
        headers = {}
    auth = headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    if token_fixo:
        return token_fixo
    raise ToolError("Sem sessão: envie o access token do TroKa no header Authorization: Bearer <token>.")


def criar_servidor(rpc: SupabaseRPC, token_fixo: str | None = None) -> MCPServer:
    mcp = MCPServer(name="troka", title="TroKa", instructions=INSTRUCOES, version="0.1.0")

    async def chamar(ctx: Context, funcao: str, **params: Any) -> Any:
        try:
            return await rpc.rpc(funcao, _token(ctx, token_fixo), params)
        except ErroTroka as e:
            raise ToolError(str(e)) from e

    # ------------------------------------------------------------------ leitura
    @mcp.tool(annotations=LEITURA)
    async def meu_perfil(ctx: Context) -> Any:
        """Quem é o usuário logado: nome, papel (profissional/gestor), categoria, especialidade, hospital e setor."""
        linhas = await chamar(ctx, "meu_perfil")
        return linhas[0] if linhas else None

    @mcp.tool(annotations=LEITURA)
    async def plantoes_periodo(
        ctx: Context,
        de: DataHora | None = None,
        ate: DataHora | None = None,
        somente_meus: bool = False,
        profissional_id: Uuid | None = None,
    ) -> Any:
        """Plantões do setor num período (padrão: agora até +30 dias; máximo 93 dias), com o anúncio vigente.
        `somente_meus` traz só os do usuário; `profissional_id` filtra por um colega do setor (RN03)."""
        return await chamar(ctx, "plantoes_periodo", p_de=de, p_ate=ate, p_somente_meus=somente_meus,
                            p_profissional_id=profissional_id)

    @mcp.tool(annotations=LEITURA)
    async def anuncios_do_setor(ctx: Context) -> Any:
        """Anúncios de troca vigentes no setor (abertos no prazo e pendentes de aprovação).
        O motivo só vem para o gestor e para quem anunciou (RN29)."""
        return await chamar(ctx, "anuncios_do_setor")

    @mcp.tool(annotations=LEITURA)
    async def buscar_profissional(ctx: Context, termo: Annotated[str, Field(min_length=2)]) -> Any:
        """Busca profissionais do setor por parte do nome, sem diferenciar acento ou maiúsculas (até 20)."""
        return await chamar(ctx, "buscar_profissional", p_termo=termo)

    @mcp.tool(annotations=LEITURA)
    async def listar_especialidades(ctx: Context) -> Any:
        """Especialidades cadastradas (id, nome, categoria), para criar ou editar plantões."""
        try:
            return await rpc.select("especialidade", _token(ctx, token_fixo),
                                    {"select": "id,nome,categoria", "order": "categoria,nome"})
        except ErroTroka as e:
            raise ToolError(str(e)) from e

    @mcp.tool(annotations=LEITURA)
    async def ofertas_para_mim(ctx: Context) -> Any:
        """Profissional: anúncios e plantões em aberto que o usuário pode assumir (elegibilidade RN11 a RN15)."""
        return await chamar(ctx, "ofertas_para_mim")

    @mcp.tool(annotations=LEITURA)
    async def minhas_solicitacoes(ctx: Context) -> Any:
        """Profissional: anúncios que o usuário assumiu e candidaturas enviadas, com o status de cada um."""
        return await chamar(ctx, "minhas_solicitacoes")

    @mcp.tool(annotations=LEITURA)
    async def painel_do_setor(ctx: Context) -> Any:
        """Gestor: painel do setor com plantões em aberto, anúncios urgentes, a vencer e alertas (RN28)."""
        return await chamar(ctx, "painel_do_setor")

    @mcp.tool(annotations=LEITURA)
    async def pendencias_do_setor(ctx: Context) -> Any:
        """Gestor: trocas e candidaturas aguardando aprovação (RN19, RN21)."""
        return await chamar(ctx, "pendencias_do_setor")

    @mcp.tool(annotations=LEITURA)
    async def equipe_do_setor(ctx: Context) -> Any:
        """Gestor: profissionais do setor, com especialidade, conselho e lista de confiança (RN19b)."""
        return await chamar(ctx, "equipe_do_setor")

    @mcp.tool(annotations=LEITURA)
    async def historico_do_setor(ctx: Context, limite: Annotated[int, Field(ge=1, le=500)] = 50) -> Any:
        """Gestor: últimas mudanças registradas no setor (RN25, RN26)."""
        return await chamar(ctx, "historico_do_setor", p_limite=limite)

    # ------------------------------------------------------------------ plantões (gestor)
    @mcp.tool(annotations=ESCRITA)
    async def criar_plantao(
        ctx: Context, especialidade_id: Uuid, inicio: DataHora, fim: DataHora, profissional_id: Uuid | None = None
    ) -> Any:
        """Gestor: cria um plantão no setor, em aberto ou já atribuído (RN04, RN05, RN13, RN14)."""
        return await chamar(ctx, "criar_plantao", p_especialidade_id=especialidade_id, p_inicio=inicio, p_fim=fim,
                            p_profissional_id=profissional_id)

    @mcp.tool(annotations=ESCRITA)
    async def editar_plantao(
        ctx: Context, id: Uuid, especialidade_id: Uuid, inicio: DataHora, fim: DataHora,
        profissional_id: Uuid | None = None,
    ) -> Any:
        """Gestor: altera um plantão do setor. Informe todos os campos; sem profissional, o plantão fica em aberto."""
        return await chamar(ctx, "editar_plantao", p_id=id, p_especialidade_id=especialidade_id, p_inicio=inicio,
                            p_fim=fim, p_profissional_id=profissional_id)

    @mcp.tool(annotations=DESTRUTIVA)
    async def remover_plantao(ctx: Context, id: Uuid) -> Any:
        """Gestor: remove um plantão do setor (RN05). Fica registrado no histórico (RN25)."""
        return await chamar(ctx, "remover_plantao", p_id=id)

    # ------------------------------------------------------------------ anúncios
    @mcp.tool(annotations=ESCRITA)
    async def anunciar(
        ctx: Context,
        plantao_id: Uuid,
        urgencia: Literal["normal", "urgente"],
        motivo_categoria: Literal["saude", "pessoal", "outro"] | None = None,
        motivo_texto: Annotated[str | None, Field(max_length=500)] = None,
    ) -> Any:
        """Profissional: anuncia o próprio plantão para troca, antes do início (RN07 a RN10).
        O motivo é opcional e privado (RN29)."""
        return await chamar(ctx, "anunciar", p_plantao_id=plantao_id, p_urgencia=urgencia,
                            p_motivo_categoria=motivo_categoria, p_motivo_texto=motivo_texto)

    @mcp.tool(annotations=DESTRUTIVA)
    async def cancelar_anuncio(ctx: Context, anuncio_id: Uuid) -> Any:
        """Quem anunciou: cancela o anúncio antes da aprovação (RN22)."""
        return await chamar(ctx, "cancelar_anuncio", p_anuncio_id=anuncio_id)

    @mcp.tool(annotations=ESCRITA)
    async def definir_adicional(ctx: Context, anuncio_id: Uuid, valor: Annotated[float, Field(gt=0)]) -> Any:
        """Gestor: define um adicional em reais para o anúncio (RN17, RN17b, RN18)."""
        return await chamar(ctx, "definir_adicional", p_anuncio_id=anuncio_id, p_valor=valor)

    # ------------------------------------------------------------------ ofertas (profissional)
    @mcp.tool(annotations=ESCRITA)
    async def assumir_anuncio(ctx: Context, anuncio_id: Uuid) -> Any:
        """Profissional: assume um anúncio de troca. Pode ir para aprovação ou ser aprovado direto (RN12 a RN15, RN19c)."""
        return await chamar(ctx, "assumir_anuncio", p_anuncio_id=anuncio_id)

    @mcp.tool(annotations=ESCRITA)
    async def desistir_anuncio(ctx: Context, anuncio_id: Uuid) -> Any:
        """Profissional: desiste de um anúncio que assumiu, antes da aprovação (RN22b)."""
        return await chamar(ctx, "desistir_anuncio", p_anuncio_id=anuncio_id)

    @mcp.tool(annotations=ESCRITA)
    async def candidatar(ctx: Context, plantao_id: Uuid) -> Any:
        """Profissional: candidata-se a um plantão em aberto (RN06c)."""
        return await chamar(ctx, "candidatar", p_plantao_id=plantao_id)

    @mcp.tool(annotations=ESCRITA)
    async def desistir_candidatura(ctx: Context, candidatura_id: Uuid) -> Any:
        """Profissional: retira uma candidatura pendente."""
        return await chamar(ctx, "desistir_candidatura", p_candidatura_id=candidatura_id)

    # ------------------------------------------------------------------ aprovações e equipe (gestor)
    @mcp.tool(annotations=ESCRITA)
    async def aprovar_troca(ctx: Context, anuncio_id: Uuid) -> Any:
        """Gestor: aprova a troca. A elegibilidade é revalidada (RN16) e o plantão muda de dono (RN20)."""
        return await chamar(ctx, "aprovar_troca", p_anuncio_id=anuncio_id)

    @mcp.tool(annotations=ESCRITA)
    async def recusar_troca(ctx: Context, anuncio_id: Uuid) -> Any:
        """Gestor: recusa a troca pendente (RN19, RN21)."""
        return await chamar(ctx, "recusar_troca", p_anuncio_id=anuncio_id)

    @mcp.tool(annotations=ESCRITA)
    async def aprovar_candidatura(ctx: Context, candidatura_id: Uuid) -> Any:
        """Gestor: aprova a candidatura a um plantão em aberto (RN06c, RN16)."""
        return await chamar(ctx, "aprovar_candidatura", p_candidatura_id=candidatura_id)

    @mcp.tool(annotations=ESCRITA)
    async def recusar_candidatura(ctx: Context, candidatura_id: Uuid) -> Any:
        """Gestor: recusa a candidatura."""
        return await chamar(ctx, "recusar_candidatura", p_candidatura_id=candidatura_id)

    @mcp.tool(annotations=ESCRITA)
    async def definir_confianca(ctx: Context, profissional_id: Uuid, confiavel: bool) -> Any:
        """Gestor: põe ou tira o profissional da lista de confiança do setor (RN19b)."""
        return await chamar(ctx, "definir_confianca", p_profissional_id=profissional_id, p_confiavel=confiavel)

    @mcp.tool(annotations=ESCRITA)
    async def editar_profissional(
        ctx: Context, id: Uuid, nome: Annotated[str, Field(min_length=3, max_length=120)], especialidade_id: Uuid
    ) -> Any:
        """Gestor: corrige o nome ou a especialidade de um profissional do setor (RN03, RN13)."""
        return await chamar(ctx, "editar_profissional", p_id=id, p_nome=nome, p_especialidade_id=especialidade_id)

    @mcp.tool(annotations=ESCRITA)
    async def resolver_alerta(ctx: Context, alerta_id: Uuid) -> Any:
        """Gestor: marca um alerta de plantão em risco como resolvido (RN24)."""
        return await chamar(ctx, "resolver_alerta", p_alerta_id=alerta_id)

    @mcp.tool(annotations=ESCRITA)
    async def recusar_pedido_acesso(ctx: Context, pedido_id: Uuid) -> Any:
        """Gestor: recusa um pedido de acesso. Para APROVAR, use a tela Gestão → Aprovações: a aprovação
        depende do cadastro com convite e da validação do conselho (RN01, RN01b), que ainda não estão no MCP."""
        return await chamar(ctx, "resolver_pedido_acesso", p_pedido_id=pedido_id, p_aprovar=False)

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=True))
    async def marcar_avisos_lidos(ctx: Context) -> Any:
        """Marca todos os avisos do usuário como lidos."""
        return await chamar(ctx, "marcar_avisos_lidos")

    return mcp
