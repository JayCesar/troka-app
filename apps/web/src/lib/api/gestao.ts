import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../supabase";
import type { Database } from "../database.types";
import { unwrap } from "./plantoes";

type Enums = Database["public"]["Enums"];

// Tipos à mão: campos nulos nas linhas de candidatura (anunciante/urgência)
export interface Pendencia {
  tipo: "troca" | "candidatura";
  id: string;
  plantao_id: string;
  inicio: string;
  fim: string;
  especialidade: string;
  solicitante: string;
  anunciante: string | null;
  urgencia: Enums["urgencia"] | null;
  adicional: number | null;
  solicitado_em: string;
  motivos: string[]; // revalidação prévia (RN16): vazio = aprovação deve passar
}
export interface MembroEquipe {
  id: string;
  nome: string;
  categoria: Enums["categoria_profissional"];
  especialidade: string;
  confiavel: boolean;
  conselho: string;
  conselho_validacao: Enums["validacao_conselho"] | null;
}

// RN24: plantões em risco (RLS: só gestão do setor)
export interface Alerta {
  id: string;
  criado_em: string;
  plantao: { inicio: string; fim: string; especialidade: { nome: string } | null; profissional: { nome: string } | null } | null;
}
export function useAlertas() {
  return useQuery({
    queryKey: ["alertas"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("alerta")
          .select("id, criado_em, plantao(inicio, fim, especialidade(nome), profissional:perfil!plantao_profissional_id_fkey(nome))")
          .is("resolvido_em", null)
          .order("criado_em", { ascending: false }),
      ) as unknown as Alerta[],
  });
}
export const useResolverAlerta = () =>
  useAcaoGestor(async (id: string) => unwrap(await supabase.rpc("resolver_alerta", { p_alerta_id: id })));

export function usePendencias() {
  return useQuery({ queryKey: ["pendencias"], queryFn: async () => unwrap(await supabase.rpc("pendencias_do_setor")) as unknown as Pendencia[] });
}

export function useEquipe() {
  return useQuery({ queryKey: ["equipe"], queryFn: async () => unwrap(await supabase.rpc("equipe_do_setor")) as unknown as MembroEquipe[] });
}

function useAcaoGestor<A>(fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of ["pendencias", "equipe", "plantoes", "anuncios", "avisos", "alertas", "painel", "historico"]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export const useDecidir = () =>
  useAcaoGestor(async ({ p, aprovar }: { p: Pendencia; aprovar: boolean }) => {
    if (p.tipo === "troca") return unwrap(await supabase.rpc(aprovar ? "aprovar_troca" : "recusar_troca", { p_anuncio_id: p.id }));
    return unwrap(await supabase.rpc(aprovar ? "aprovar_candidatura" : "recusar_candidatura", { p_candidatura_id: p.id }));
  });

export const useDefinirConfianca = () =>
  useAcaoGestor(async ({ id, confiavel }: { id: string; confiavel: boolean }) => {
    const { error } = await supabase.rpc("definir_confianca", { p_profissional_id: id, p_confiavel: confiavel });
    if (error) throw new Error(error.message);
  });

// M4: gestor corrige nome/especialidade (RPC editar_profissional; o banco valida setor, categoria e RN13)
export const useEditarProfissional = () =>
  useAcaoGestor(async ({ id, nome, especialidadeId }: { id: string; nome: string; especialidadeId: string }) => {
    const { error } = await supabase.rpc("editar_profissional", { p_id: id, p_nome: nome, p_especialidade_id: especialidadeId });
    if (error) throw new Error(error.message);
  });
