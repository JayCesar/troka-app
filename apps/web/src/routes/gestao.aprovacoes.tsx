import { createFileRoute } from "@tanstack/react-router";

import { SecaoGestao } from "@/components/gestao/SecaoGestao";
import { PedidosAcesso } from "@/components/gestao/PedidosAcesso";
import { Pendencias } from "@/components/gestao/Pendencias";

export const Route = createFileRoute("/gestao/aprovacoes")({
  head: () => ({ meta: [{ title: "Aprovações aguardando aceite — TroKa" }] }),
  component: () => (
    <SecaoGestao titulo="Aprovações aguardando aceite">
      <div className="grid items-start gap-8 xl:grid-cols-2"><Pendencias /><PedidosAcesso /></div>
    </SecaoGestao>
  ),
});
