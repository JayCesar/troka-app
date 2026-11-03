import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../supabase";
import type { Database } from "../database.types";
import { unwrap } from "./plantoes";

// Pedidos de acesso da tela pública /cadastro (M2). Regras no banco: `solicitar_acesso`, `resolver_pedido_acesso`, RLS por hospital.
export type PedidoAcesso = Database["public"]["Tables"]["pedido_acesso"]["Row"];
export type Funcao = "medico" | "enfermeiro" | "gestor";

export function useHospitaisCadastro() {
  return useQuery({
    queryKey: ["hospitais-cadastro"],
    staleTime: Infinity,
    queryFn: async () => unwrap(await supabase.rpc("hospitais_para_cadastro")) as { id: string; nome: string }[],
  });
}

export interface NovoPedido { hospitalId: string; nome: string; email: string; funcao: Funcao; conselho: string }
export async function solicitarAcesso(p: NovoPedido) {
  unwrap(
    await supabase.rpc("solicitar_acesso", {
      p_hospital_id: p.hospitalId,
      p_nome: p.nome,
      p_email: p.email,
      p_funcao: p.funcao,
      ...(p.conselho.trim() ? { p_conselho: p.conselho.trim() } : {}),
    }),
  );
}

// Gestão: pedidos pendentes do hospital (a RLS filtra)
export function usePedidosAcesso() {
  return useQuery({
    queryKey: ["pedidos-acesso"],
    queryFn: async () =>
      unwrap(await supabase.from("pedido_acesso").select("*").eq("status", "pendente").order("criado_em", { ascending: false })),
  });
}

export function useResolverPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aprovar }: { id: string; aprovar: boolean }) =>
      unwrap(await supabase.rpc("resolver_pedido_acesso", { p_pedido_id: id, p_aprovar: aprovar })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["pedidos-acesso"] }),
  });
}

/** "123456/SP" → { numero: "123456", uf: "SP" } (pré-preenche o cadastro do gestor). */
export function lerConselho(texto: string | null): { numero: string; uf: string | null } {
  const t = (texto ?? "").toUpperCase();
  return { numero: t.replace(/\D/g, ""), uf: t.match(/\b([A-Z]{2})\b/)?.[1] ?? null };
}
