import { useMemo } from "react";

import { usePlantoesSetor, useMeusPlantoes, anuncioAtivo } from "@/lib/api/plantoes";
import { useOfertas } from "@/lib/api/ofertas";
import { useAlertas, usePendencias } from "@/lib/api/gestao";
import { gerarSugestoes } from "./sugestoes";

/** Sugestões do hero do Início conforme papel, dia/hora e dados (React Query reaproveita o cache das outras seções). */
export function useSugestoes(
  papel: "gestor" | "profissional",
  perfilId: string,
  quantidade = 4,
): string[] {
  const gestor = papel === "gestor";
  const meus = useMeusPlantoes(perfilId, !gestor);
  const ofertas = useOfertas(!gestor);
  const pendencias = usePendencias(gestor);
  const alertas = useAlertas(gestor);
  const setor = usePlantoesSetor(gestor);

  return useMemo(
    () =>
      gerarSugestoes(
        {
          papel,
          agora: new Date(),
          meusPlantoes: meus.data?.map((p) => ({
            inicio: p.inicio,
            anunciado: anuncioAtivo(p) !== null,
          })),
          ofertas: ofertas.data?.length,
          ofertasUrgentes: ofertas.data?.filter((o) => o.urgencia === "urgente").length,
          pendencias: pendencias.data?.length,
          alertas: alertas.data?.length,
          emAberto: setor.data?.filter((p) => p.profissional_id === null).length,
        },
        quantidade,
      ),
    // Sorteia de novo só quando os dados mudam (não a cada render)
    [papel, quantidade, meus.data, ofertas.data, pendencias.data, alertas.data, setor.data],
  );
}
