import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../supabase";
import type { Database } from "../database.types";
import { unwrap } from "./plantoes";

// Tipos escritos à mão: o gerador marca como não-nulas colunas que vêm null nas linhas de plantão aberto.
export interface Oferta {
  tipo: "anuncio" | "plantao";
  anuncio_id: string | null;
  plantao_id: string;
  inicio: string;
  fim: string;
  especialidade: string;
  urgencia: Database["public"]["Enums"]["urgencia"] | null;
  expira_em: string | null;
  anunciante: string | null;
  adicional: number | null; // RN18: visível antes de assumir
  motivos: string[]; // vazio = elegível (RN12–RN15)
  ja_candidatei: boolean;
}
export interface Solicitacao {
  tipo: "anuncio" | "candidatura";
  id: string;
  plantao_id: string;
  inicio: string;
  fim: string;
  especialidade: string;
  anunciante: string | null;
}

// Ofertas do setor com os motivos de inelegibilidade calculados no banco (RN12–RN15)
export function useOfertas(enabled = true) {
  return useQuery({ enabled, queryKey: ["ofertas"], queryFn: async () => unwrap(await supabase.rpc("ofertas_para_mim")) as unknown as Oferta[] });
}

export function useMinhasSolicitacoes() {
  return useQuery({ queryKey: ["solicitacoes"], queryFn: async () => unwrap(await supabase.rpc("minhas_solicitacoes")) as unknown as Solicitacao[] });
}

// Toda ação muda ofertas, solicitações, plantões, anúncios e avisos
function useAcao<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of ["ofertas", "solicitacoes", "plantoes", "anuncios", "candidaturas", "avisos"]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export const useAssumirAnuncio = () => useAcao(async (id: string) => unwrap(await supabase.rpc("assumir_anuncio", { p_anuncio_id: id })));
export const useDesistirAnuncio = () => useAcao(async (id: string) => unwrap(await supabase.rpc("desistir_anuncio", { p_anuncio_id: id })));
export const useCandidatar = () => useAcao(async (id: string) => unwrap(await supabase.rpc("candidatar", { p_plantao_id: id })));
export const useDesistirCandidatura = () =>
  useAcao(async (id: string) => unwrap(await supabase.rpc("desistir_candidatura", { p_candidatura_id: id })));
