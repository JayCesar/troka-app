// RN01b — validação do registro no conselho (CRM para médico, COREN para enfermeiro).
// O modo vem do secret CONSELHO_VALIDACAO (decisão B10/P2):
//   desligada → modo de teste: aceita qualquer registro e marca "nao_verificado"
//   simulada  → regras falsas e determinísticas para demonstrar o bloqueio (ver abaixo)
//   real      → consulta um provedor externo (PENDENTE: escolha do provedor pelo usuário)
// Padrão: real. Sem provedor configurado, falha fechado (B10/P3): sem validação, o cadastro não conclui.

export type Categoria = "medico" | "enfermeiro";
export type Status = "verificado" | "simulado" | "nao_verificado";
export type Resultado = { ok: true; status: Status } | { ok: false; motivo: string };

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const sigla = (c: Categoria) => (c === "medico" ? "CRM" : "COREN");

export async function validarConselho(categoria: Categoria, numero: string, uf: string, modo: string): Promise<Resultado> {
  const registro = `${sigla(categoria)} ${numero}/${uf}`;
  switch (modo) {
    case "desligada":
      return { ok: true, status: "nao_verificado" };

    case "simulada":
      // Final 0000 = inexistente; final 9999 = inativo; demais = ativo.
      if (numero.endsWith("0000")) return { ok: false, motivo: `RN01b: ${registro} não encontrado no conselho (simulação).` };
      if (numero.endsWith("9999")) return { ok: false, motivo: `RN01b: ${registro} está inativo no conselho (simulação).` };
      return { ok: true, status: "simulado" };

    case "real":
      return await consultarProvedor(categoria, numero, uf, registro);

    default:
      return { ok: false, motivo: `Configuração inválida: CONSELHO_VALIDACAO="${modo}" (use desligada, simulada ou real).` };
  }
}

// Ponto de integração do provedor real (CFM para CRM; Cofen/Corens para COREN).
// Deve devolver { ok: true, status: "verificado" } só se o registro existir E estiver ativo.
async function consultarProvedor(_c: Categoria, _numero: string, _uf: string, registro: string): Promise<Resultado> {
  return {
    ok: false,
    motivo: `RN01b: não foi possível validar ${registro} — provedor de consulta ao conselho ainda não configurado. ` +
      `Para testar o fluxo, use CONSELHO_VALIDACAO=desligada ou simulada.`,
  };
}
