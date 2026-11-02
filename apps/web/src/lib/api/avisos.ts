import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../supabase";
import { unwrap } from "./plantoes";

// Avisos do usuário logado (RLS: só os próprios). Atualiza a cada 30s.
export function useAvisos() {
  return useQuery({
    queryKey: ["avisos"],
    refetchInterval: 30_000,
    queryFn: async () =>
      unwrap(await supabase.from("aviso").select("id, texto, link, lido_em, criado_em").order("criado_em", { ascending: false }).limit(30)),
  });
}

export function useMarcarAvisosLidos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("marcar_avisos_lidos");
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["avisos"] }),
  });
}
