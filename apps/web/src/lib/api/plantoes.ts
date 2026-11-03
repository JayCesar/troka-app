import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../supabase";
import type { Database } from "../database.types";

type Tables = Database["public"]["Tables"];
export type AnuncioResumo = Pick<Tables["anuncio"]["Row"], "id" | "status" | "urgencia" | "expira_em" | "adicional_valor">;
export type Plantao = Tables["plantao"]["Row"] & {
  anuncio: AnuncioResumo[];
  especialidade: { nome: string } | null;
  profissional: { nome: string; conselho_numero: string | null; conselho_uf: string | null } | null;
  setor: { nome: string } | null;
  hospital: { nome: string } | null;
};
export type Especialidade = Tables["especialidade"]["Row"];
export type Profissional = Pick<Tables["perfil"]["Row"], "id" | "nome" | "categoria" | "especialidade_id">;

export interface PlantaoInput {
  especialidadeId: string;
  inicio: string; // ISO
  fim: string; // ISO
  profissionalId: string | null;
}

const SELECT = "*, anuncio(id, status, urgencia, expira_em, adicional_valor), especialidade(nome), profissional:perfil!plantao_profissional_id_fkey(nome, conselho_numero, conselho_uf), setor(nome), hospital(nome)";

// Anúncio "em aberto" (RN08 / decisão B3/P1): pendente, ou aberto ainda no prazo. Espelho da regra do banco, só para exibição.
export function anuncioAtivo(p: Plantao): AnuncioResumo | null {
  const agora = Date.now();
  return p.anuncio.find((a) => a.status === "pendente" || (a.status === "aberto" && new Date(a.expira_em).getTime() > agora)) ?? null;
}

// Erros das RPCs já vêm com a mensagem da regra (ex.: "RN14: ...")
export function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

const keys = {
  meus: (userId: string) => ["plantoes", "meus", userId] as const,
  setor: ["plantoes", "setor"] as const,
};

export function useMeusPlantoes(userId: string) {
  return useQuery({
    queryKey: keys.meus(userId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from("plantao")
          .select(SELECT)
          .eq("profissional_id", userId)
          .gte("fim", new Date().toISOString())
          .order("inicio"),
      ) as Plantao[],
  });
}

// RLS já restringe ao setor do usuário (RN03)
export function usePlantoesSetor() {
  return useQuery({
    queryKey: keys.setor,
    queryFn: async () =>
      unwrap(await supabase.from("plantao").select(SELECT).gte("fim", new Date().toISOString()).order("inicio")) as Plantao[],
  });
}

export function useEspecialidades() {
  return useQuery({
    queryKey: ["especialidades"],
    staleTime: Infinity,
    queryFn: async () => unwrap(await supabase.from("especialidade").select("*").order("categoria").order("nome")),
  });
}

export function useProfissionaisSetor() {
  return useQuery({
    queryKey: ["profissionais", "setor"],
    queryFn: async () =>
      unwrap(
        await supabase.from("perfil").select("id, nome, categoria, especialidade_id").eq("papel", "profissional").order("nome"),
      ) as Profissional[],
  });
}

function useInvalidatePlantoes() {
  const qc = useQueryClient();
  return () => Promise.all(["plantoes", "painel", "historico"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

const args = (i: PlantaoInput) => ({
  p_especialidade_id: i.especialidadeId,
  p_inicio: i.inicio,
  p_fim: i.fim,
  ...(i.profissionalId ? { p_profissional_id: i.profissionalId } : {}),
});

export function useCriarPlantao() {
  const invalidate = useInvalidatePlantoes();
  return useMutation({
    mutationFn: async (i: PlantaoInput) => unwrap(await supabase.rpc("criar_plantao", args(i))),
    onSuccess: invalidate,
  });
}

export function useEditarPlantao() {
  const invalidate = useInvalidatePlantoes();
  return useMutation({
    mutationFn: async ({ id, ...i }: PlantaoInput & { id: string }) =>
      unwrap(await supabase.rpc("editar_plantao", { p_id: id, ...args(i) })),
    onSuccess: invalidate,
  });
}

export function useRemoverPlantao() {
  const invalidate = useInvalidatePlantoes();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("remover_plantao", { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}
