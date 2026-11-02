import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { eligibleDoctors, fmtDay, fmtTime, REASONS, useTroka, type Urgency } from "@/lib/troka";

export const Route = createFileRoute("/anunciar")({
  validateSearch: (s: Record<string, unknown>): { shift?: string } => { const r: { shift?: string } = {}; if (typeof s["shift"] === "string") r.shift = s["shift"]; return r; },
  head: () => ({
    meta: [
      { title: "Anunciar plantão — TroKa" },
      { name: "description", content: "Peça cobertura para um plantão que você não poderá cumprir." },
      { property: "og:title", content: "Anunciar plantão — TroKa" },
      { property: "og:description", content: "Peça cobertura para um plantão que você não poderá cumprir." },
    ],
  }),
  component: () => <AppShell title="Anunciar plantão" role="profissional"><Page /></AppShell>,
});

const URG: Urgency[] = ["Hoje", "Até 3 dias", "Mais de 3 dias"];

function Page() {
  const { user, state, hospital, publish } = useTroka();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const mine = state.shifts.filter((s) => s.doctorId === user!.id && s.status === "confirmado").sort((a, b) => a.start - b.start);
  const [shiftId, setShiftId] = useState(() => { const pre = search.shift; return pre && mine.some((s) => s.id === pre) ? pre : mine[0]?.id ?? ""; });
  const [reason, setReason] = useState(REASONS[0]!);
  const [urgency, setUrgency] = useState<Urgency>("Até 3 dias");
  const shift = mine.find((s) => s.id === shiftId);
  const count = shift ? eligibleDoctors(state, shift, user!.id).length : 0;
  const bonus = shift ? hospital(shift.hospitalId).rules.bonus[urgency] : undefined;

  if (mine.length === 0) return <p className="card p-6 text-center text-muted-foreground">Você não tem plantões confirmados para anunciar.</p>;

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); publish(shiftId, reason, urgency); toast.success(`Anúncio publicado. ${count} médico(s) avisado(s).`); navigate({ to: "/plantoes" }); }}>
      <label className="block space-y-2">
        <span className="text-sm font-semibold">Plantão que não poderá cumprir</span>
        <select className="field" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
          {mine.map((s) => <option key={s.id} value={s.id}>{fmtDay(s.start)} {fmtTime(s.start)} · {s.sector} · {hospital(s.hospitalId).short}</option>)}
        </select>
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold">Motivo</span>
        <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
      </label>
      <div className="space-y-2">
        <span className="text-sm font-semibold">Urgência</span>
        <div className="grid grid-cols-3 gap-2">
          {URG.map((u) => (
            <button type="button" key={u} onClick={() => setUrgency(u)} className={`btn text-sm ${urgency === u ? "btn-primary" : "btn-outline"}`}>{u}</button>
          ))}
        </div>
      </div>
      <div className="card flex items-center gap-4 p-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Users className="h-5 w-5" /></div>
        <div>
          <p className="font-bold">{count} médico(s) elegível(is) serão avisados</p>
          <p className="text-sm text-muted-foreground">{bonus ? `O hospital paga adicional de R$ ${bonus} a quem cobrir.` : "Sem adicional configurado para esta urgência."}</p>
        </div>
      </div>
      <button className="btn btn-primary w-full">Publicar anúncio</button>
    </form>
  );
}
