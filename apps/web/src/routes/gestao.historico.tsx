import { createFileRoute } from "@tanstack/react-router";

import { SecaoGestao } from "@/components/gestao/SecaoGestao";
import { Historico } from "@/components/gestao/Historico";

export const Route = createFileRoute("/gestao/historico")({
  head: () => ({ meta: [{ title: "Histórico do setor — TroKa" }] }),
  component: () => (
    <SecaoGestao titulo="Histórico do setor">
      <Historico />
    </SecaoGestao>
  ),
});
