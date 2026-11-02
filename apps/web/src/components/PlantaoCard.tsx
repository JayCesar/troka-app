import type { ReactNode } from "react";

import { fmtDay, fmtTime } from "@/lib/troka";
import type { Plantao } from "@/lib/api/plantoes";

const STATUS: Record<string, { label: string; cls: string }> = {
  aberto: { label: "Aberto", cls: "bg-secondary text-secondary-foreground" },
  atribuido: { label: "Atribuído", cls: "bg-success/15 text-success" },
};

export function PlantaoCard({ plantao, showProfissional, children }: { plantao: Plantao; showProfissional?: boolean; children?: ReactNode }) {
  const inicio = new Date(plantao.inicio).getTime();
  const fim = new Date(plantao.fim).getTime();
  const status = STATUS[plantao.status ?? "aberto"] ?? STATUS["aberto"]!;
  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-accent py-2 text-accent-foreground">
          <span className="text-[11px] font-semibold uppercase">{fmtDay(inicio).split(",")[0]}</span>
          <span className="text-xl font-bold leading-none">{new Date(inicio).getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{plantao.especialidade?.nome}</h3>
            <span className={`chip ${status.cls}`}>{status.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{plantao.setor?.nome} · {plantao.hospital?.nome}</p>
          <p className="text-sm font-semibold">{fmtTime(inicio)} – {fmtTime(fim)}{fmtDay(fim) !== fmtDay(inicio) && ` (${fmtDay(fim)})`}</p>
          {showProfissional && <p className="text-sm">{plantao.profissional?.nome ?? <span className="text-muted-foreground">Sem profissional</span>}</p>}
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
