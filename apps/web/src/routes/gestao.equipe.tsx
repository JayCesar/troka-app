import { createFileRoute } from "@tanstack/react-router";

import { SecaoGestao } from "@/components/gestao/SecaoGestao";
import { CadastroProfissional } from "@/components/gestao/CadastroProfissional";
import { Equipe } from "@/components/gestao/Equipe";

export const Route = createFileRoute("/gestao/equipe")({
  head: () => ({ meta: [{ title: "Equipe do setor — TroKa" }] }),
  component: () => (
    <SecaoGestao titulo="Equipe do setor">
      <div className="space-y-4"><CadastroProfissional /><Equipe /></div>
    </SecaoGestao>
  ),
});
