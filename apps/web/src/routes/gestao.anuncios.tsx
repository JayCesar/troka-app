import { createFileRoute } from "@tanstack/react-router";

import { SecaoGestao } from "@/components/gestao/SecaoGestao";
import { AnunciosSetor } from "@/components/gestao/AnunciosSetor";

export const Route = createFileRoute("/gestao/anuncios")({
  head: () => ({ meta: [{ title: "Anúncios do setor — TroKa" }] }),
  component: () => (
    <SecaoGestao titulo="Anúncios do setor">
      <AnunciosSetor />
    </SecaoGestao>
  ),
});
