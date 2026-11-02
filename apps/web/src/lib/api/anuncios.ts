import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../supabase";
import type { Database } from "../database.types";
import { unwrap } from "./plantoes";

type Enums = Database["public"]["Enums"];
export type Urgencia = Enums["urgencia"];
export type MotivoCategoria = Enums["motivo_categoria"];

export const URGENCIAS: { id: Urgencia; label: string; prazo: string; horas: number }[] = [
  { id: "normal", label: "Normal", prazo: "48h", horas: 48 },
  { id: "urgente", label: "Urgente", prazo: "24h", horas: 24 },
];
export const CATEGORIAS: { id: MotivoCategoria; label: string }[] = [
  { id: "saude", label: "Saúde" },
  { id: "pessoal", label: "Pessoal" },
  { id: "outro", label: "Outro" },
];
export const labelCategoria = (c: MotivoCategoria) => CATEGORIAS.find((x) => x.id === c)?.label ?? c;

// RN10: prévia do prazo (o valor oficial é calculado pelo banco)
export function previaExpiracao(urgencia: Urgencia, inicioPlantao: string): Date {
  const horas = URGENCIAS.find((u) => u.id === urgencia)!.horas;
  return new Date(Math.min(Date.now() + horas * 3_600_000, new Date(inicioPlantao).getTime()));
}

export type AnuncioSetor = Pick<Database["public"]["Tables"]["anuncio"]["Row"], "id" | "status" | "urgencia" | "expira_em" | "criado_em"> & {
  anuncio_motivo: { categoria: MotivoCategoria; texto: string | null } | null; // null para quem não pode ver (RN29)
  anunciante: { nome: string } | null;
  plantao: { inicio: string; fim: string; especialidade: { nome: string } | null } | null;
};

export interface AnunciarInput {
  plantaoId: string;
  urgencia: Urgencia;
  categoria: MotivoCategoria | null;
  texto: string;
}

export function useAnunciar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: AnunciarInput) =>
      unwrap(
        await supabase.rpc("anunciar", {
          p_plantao_id: i.plantaoId,
          p_urgencia: i.urgencia,
          ...(i.categoria ? { p_motivo_categoria: i.categoria } : {}),
          ...(i.categoria && i.texto.trim() ? { p_motivo_texto: i.texto.trim() } : {}),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plantoes"] });
      void qc.invalidateQueries({ queryKey: ["anuncios"] });
    },
  });
}

// Anúncios do setor (RLS). O motivo só vem preenchido para gestor/anunciante (RN29); para os demais vem null.
export function useAnunciosSetor() {
  return useQuery({
    queryKey: ["anuncios", "setor"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("anuncio")
          .select(
            "id, status, urgencia, expira_em, criado_em, anuncio_motivo(categoria, texto), anunciante:perfil!anuncio_anunciante_id_fkey(nome), plantao(inicio, fim, especialidade(nome))",
          )
          // "em aberto" efetivo (B3/P1): pendente, ou aberto ainda no prazo
          .or(`status.eq.pendente,and(status.eq.aberto,expira_em.gt.${new Date().toISOString()})`)
          .order("expira_em"),
      ) as unknown as AnuncioSetor[],
  });
}
