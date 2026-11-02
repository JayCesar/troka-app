import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { PlantaoCard } from "@/components/PlantaoCard";
import { useAuth } from "@/lib/auth";
import { useMeusPlantoes } from "@/lib/api/plantoes";

export const Route = createFileRoute("/plantoes")({
  head: () => ({
    meta: [
      { title: "Meus plantões — TroKa" },
      { name: "description", content: "Seus próximos plantões." },
    ],
  }),
  component: () => <AppShell title="Meus plantões" role="profissional"><Page /></AppShell>,
});

function Page() {
  const { perfil } = useAuth();
  const { data, isLoading, error } = useMeusPlantoes(perfil!.id);

  if (isLoading) return <p className="card p-6 text-center text-muted-foreground">Carregando…</p>;
  if (error) return <p className="card p-6 text-center text-destructive">Erro ao carregar plantões: {error.message}</p>;

  return (
    <div className="space-y-4">
      {data?.length === 0 && <p className="card p-6 text-center text-muted-foreground">Nenhum plantão por aqui.</p>}
      {/* "Pedir cobertura" volta no B3, com o anúncio no banco */}
      {data?.map((p) => <PlantaoCard key={p.id} plantao={p} />)}
    </div>
  );
}
