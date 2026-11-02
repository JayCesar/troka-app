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
}

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
      for (const k of ["pendencias", "equipe", "plantoes", "anuncios", "avisos"]) void qc.invalidateQueries({ queryKey: [k] });
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
