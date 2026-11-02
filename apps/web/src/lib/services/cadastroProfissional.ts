// PONTO DE INTEGRAÇÃO — criação de profissional (C do CRUD), RN01/RN01b.
// A tela só conhece `cadastrarProfissional`. Hoje chama a Edge Function `cadastrar-profissional`
// (valida o conselho, envia convite, grava o perfil). Para trocar de API, mude só este arquivo.
import { supabase } from "../supabase";

export type Categoria = "medico" | "enfermeiro";

export interface NovoProfissional {
  nome: string;
  email: string;
  categoria: Categoria;
  especialidade_id: string;
  conselho_numero: string;
  conselho_uf: string;
}

export interface ResultadoCadastro {
  validacao: "verificado" | "simulado" | "nao_verificado";
  modo: string;
}

export async function cadastrarProfissional(dados: NovoProfissional): Promise<ResultadoCadastro> {
  const { data, error } = await supabase.functions.invoke("cadastrar-profissional", { body: dados });
  if (error) {
    // A função devolve { error: "mensagem da regra" } com status 4xx
    const ctx = (error as { context?: Response }).context;
    const corpo = ctx ? ((await ctx.json().catch(() => null)) as { error?: string } | null) : null;
    throw new Error(corpo?.error ?? "Não foi possível cadastrar agora. Verifique se as Edge Functions estão rodando.");
  }
  return data as ResultadoCadastro;
}
