import type { ReactNode } from "react";
import { fmtDay, fmtTime, useTroka, type Shift } from "@/lib/troka";

const STATUS: Record<Shift["status"], { label: string; cls: string }> = {
  aberto: { label: "Aberto", cls: "bg-secondary text-secondary-foreground" },
  confirmado: { label: "Confirmado", cls: "bg-success/15 text-success" },
  anuncio: { label: "Anúncio aberto", cls: "bg-warning/15 text-warning" },
  pendente: { label: "Pendente de aprovação", cls: "bg-primary/15 text-primary" },
};

export function ShiftCard({ shift, badges, children, showStatus = true }: { shift: Shift; badges?: ReactNode; children?: ReactNode; showStatus?: boolean }) {
  const { hospital } = useTroka();
  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-accent py-2 text-accent-foreground">
          <span className="text-[11px] font-semibold uppercase">{fmtDay(shift.start).split(",")[0]}</span>
          <span className="text-xl font-bold leading-none">{new Date(shift.start).getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{shift.sector}</h3>
            {showStatus && <span className={`chip ${STATUS[shift.status].cls}`}>{STATUS[shift.status].label}</span>}
          </div>
          <p className="text-sm text-muted-foreground">{hospital(shift.hospitalId).name}</p>
          <p className="text-sm font-semibold">{fmtTime(shift.start)} – {fmtTime(shift.end)}</p>
          {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
