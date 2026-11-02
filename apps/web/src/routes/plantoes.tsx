import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { PlantaoCard } from "@/components/PlantaoCard";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

import { anuncioAtivo, useMeusPlantoes } from "@/lib/api/plantoes";
import { useCancelarAnuncio } from "@/lib/api/anuncios";

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
  const cancelar = useCancelarAnuncio();
  const onCancelar = (id: string) => {
    if (!confirm("Cancelar este anúncio?")) return;
    cancelar.mutate(id, { onSuccess: () => toast("Anúncio cancelado."), onError: (e) => toast.error(e.message) });
  };

  if (isLoading) return <p className="card p-6 text-center text-muted-foreground">Carregando…</p>;
  if (error) return <p className="card p-6 text-center text-destructive">Erro ao carregar plantões: {error.message}</p>;

  return (
    <div className="space-y-4">
      {data?.length === 0 && <p className="card p-6 text-center text-muted-foreground">Nenhum plantão por aqui.</p>}
      {data?.map((p) => (
        <PlantaoCard key={p.id} plantao={p}>
          {/* RN07: só antes do início; RN08: sem anúncio em aberto (o banco valida de novo) */}
          {!anuncioAtivo(p) && new Date(p.inicio).getTime() > Date.now() && (
            <Link to="/anunciar" search={{ plantao: p.id }} className="btn btn-outline w-full">Pedir cobertura</Link>
          )}
          {/* RN22: cancelar antes da aprovação */}
          {anuncioAtivo(p) && (
            <button className="btn btn-outline w-full" disabled={cancelar.isPending} onClick={() => onCancelar(anuncioAtivo(p)!.id)}>Cancelar anúncio</button>
          )}
        </PlantaoCard>
      ))}
    </div>
  );
}
