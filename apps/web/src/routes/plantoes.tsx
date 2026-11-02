import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ShiftCard } from "@/components/ShiftCard";
import { useTroka } from "@/lib/troka";

export const Route = createFileRoute("/plantoes")({
  head: () => ({
    meta: [
      { title: "Meus plantões — TroKa" },
      { name: "description", content: "Seus plantões confirmados em todos os hospitais." },
      { property: "og:title", content: "Meus plantões — TroKa" },
      { property: "og:description", content: "Seus plantões confirmados em todos os hospitais." },
    ],
  }),
  component: () => <AppShell title="Meus plantões" role="profissional"><Page /></AppShell>,
});

function Page() {
  const { user, state, hospital } = useTroka();
  const [hf, setHf] = useState<string | null>(null);
  const mine = state.shifts
    .filter((s) => s.doctorId === user!.id && s.status !== "aberto" && (!hf || s.hospitalId === hf))
    .sort((a, b) => a.start - b.start);
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        <button onClick={() => setHf(null)} className={`chip ${!hf ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Todos</button>
        {user!.memberships.map((m) => (
          <button key={m.hospitalId} onClick={() => setHf(m.hospitalId)} className={`chip ${hf === m.hospitalId ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{hospital(m.hospitalId).name}</button>
        ))}
      </div>
      {mine.length === 0 && <p className="card p-6 text-center text-muted-foreground">Nenhum plantão por aqui.</p>}
      {mine.map((s) => (
        <ShiftCard key={s.id} shift={s}>
          {s.status === "confirmado" && (
            <Link to="/anunciar" search={{ shift: s.id }} className="btn btn-outline w-full">Pedir cobertura</Link>
          )}
        </ShiftCard>
      ))}
    </div>
  );
}
