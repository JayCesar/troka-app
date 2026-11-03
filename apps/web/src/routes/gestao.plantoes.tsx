import { createFileRoute } from "@tanstack/react-router";

import { SecaoGestao } from "@/components/gestao/SecaoGestao";
import { PlantoesSetor } from "@/components/gestao/PlantoesSetor";

export const Route = createFileRoute("/gestao/plantoes")({
  head: () => ({ meta: [{ title: "Plantões do setor — TroKa" }] }),
  component: () => (
    <SecaoGestao titulo="Plantões do setor">
      <PlantoesSetor />
    </SecaoGestao>
  ),
});
