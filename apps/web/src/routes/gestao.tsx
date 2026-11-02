import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { Alertas } from "@/components/gestao/Alertas";
import { AnunciosSetor } from "@/components/gestao/AnunciosSetor";
import { CadastroProfissional } from "@/components/gestao/CadastroProfissional";
import { Equipe } from "@/components/gestao/Equipe";
import { Historico } from "@/components/gestao/Historico";
import { Painel } from "@/components/gestao/Painel";
import { Pendencias } from "@/components/gestao/Pendencias";
import { PlantoesSetor } from "@/components/gestao/PlantoesSetor";

export const Route = createFileRoute("/gestao")({
  head: () => ({
    meta: [
      { title: "Gestão — TroKa" },
      { name: "description", content: "Aprovação de trocas, cadastro de profissionais e histórico auditável." },
    ],
  }),
  component: () => <AppShell title="Gestão" role="gestor"><Page /></AppShell>,
});

function Page() {
  return (
    <div className="space-y-8">
      <Painel />
      <Alertas />
      <Pendencias />
      <AnunciosSetor />
      <PlantoesSetor />
      <Equipe />
      <CadastroProfissional />
      <Historico />
    </div>
  );
}
