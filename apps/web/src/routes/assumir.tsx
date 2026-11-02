import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Lock, Flame, Coins } from "lucide-react";
import { toast } from "sonner";
import { AppShell, MockOnly } from "@/components/AppShell";
import { ShiftCard } from "@/components/ShiftCard";
import { checkEligibility, SECTORS, useTroka, type Shift, type Coverage } from "@/lib/troka";

export const Route = createFileRoute("/assumir")({
  head: () => ({
    meta: [
      { title: "Assumir plantão — TroKa" },
      { name: "description", content: "Plantões abertos e anúncios de cobertura nos seus hospitais." },
      { property: "og:title", content: "Assumir plantão — TroKa" },
      { property: "og:description", content: "Plantões abertos e anúncios de cobertura nos seus hospitais." },
    ],
  }),
  component: () => <AppShell title="Assumir plantão" role="profissional"><MockOnly bolt="B4"><Page /></MockOnly></AppShell>,
});

function Page() {
  const { user, state, hospital, name, takeShift, acceptCoverage } = useTroka();
  const [hf, setHf] = useState("");
  const [sf, setSf] = useState("");
  const myH = user!.memberships.map((m) => m.hospitalId);
  const items: { shift: Shift; cov?: Coverage }[] = [
    ...state.shifts.filter((s) => s.status === "aberto").map((shift) => ({ shift })),
    ...state.coverages.filter((c) => c.status === "aberto" && c.requesterId !== user!.id).map((cov) => ({ shift: state.shifts.find((s) => s.id === cov.shiftId)!, cov })),
  ]
    .filter(({ shift }) => myH.includes(shift.hospitalId) && (!hf || shift.hospitalId === hf) && (!sf || shift.sector === sf))
    .sort((a, b) => a.shift.start - b.shift.start);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <select className="field" value={hf} onChange={(e) => setHf(e.target.value)}>
          <option value="">Todos os hospitais</option>
          {myH.map((h) => <option key={h} value={h}>{hospital(h).short}</option>)}
        </select>
        <select className="field" value={sf} onChange={(e) => setSf(e.target.value)}>
          <option value="">Todos os setores</option>
          {SECTORS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {items.length === 0 && <p className="card p-6 text-center text-muted-foreground">Nenhum plantão disponível.</p>}
      {items.map(({ shift, cov }) => {
        const reasons = checkEligibility(state, user!, shift);
        const ok = reasons.length === 0;
        const bonus = cov ? hospital(shift.hospitalId).rules.bonus[cov.urgency] : undefined;
        const urgent = shift.urgent || cov?.urgency === "Hoje";
        return (
          <ShiftCard key={shift.id + (cov?.id ?? "")} shift={shift} showStatus={false}
            badges={<>
              {cov && <span className="chip bg-warning/15 text-warning">Cobertura · {name(cov.requesterId)}</span>}
              {urgent && <span className="chip bg-destructive/15 text-destructive"><Flame className="h-3 w-3" />Urgente</span>}
              {ok && <span className="chip bg-success/15 text-success"><CheckCircle2 className="h-3 w-3" />Descanso mínimo ok</span>}
              {ok && <span className="chip bg-success/15 text-success"><CheckCircle2 className="h-3 w-3" />Especialidade compatível</span>}
              {bonus && <span className="chip bg-accent text-accent-foreground"><Coins className="h-3 w-3" />Adicional R$ {bonus}</span>}
            </>}>
            {!ok && (
              <div className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {reasons.map((r) => <p key={r} className="flex items-start gap-2"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />{r}</p>)}
              </div>
            )}
            <button disabled={!ok} className="btn btn-primary w-full"
              onClick={() => {
                if (cov) {
                  acceptCoverage(cov.id);
                  toast.success(hospital(shift.hospitalId).rules.autoApprove ? "Troca aprovada automaticamente." : "Anúncio aceito. Aguardando aprovação da gestão.");
                } else { takeShift(shift.id); toast.success("Plantão assumido!"); }
              }}>
              {cov ? "Aceitar cobertura" : "Assumir plantão"}
            </button>
          </ShiftCard>
        );
      })}
    </div>
  );
}
