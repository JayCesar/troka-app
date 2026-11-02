import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Download, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, MockOnly } from "@/components/AppShell";
import { PlantoesSetor } from "@/components/gestao/PlantoesSetor";
import { eligibleDoctors, fmtDateTime, fmtDay, fmtTime, SECTORS, SPECIALTIES, useTroka, type Sector, type Specialty } from "@/lib/troka";

export const Route = createFileRoute("/gestao")({
  head: () => ({
    meta: [
      { title: "Gestão — TroKa" },
      { name: "description", content: "Aprovação de trocas, cadastro de profissionais e histórico auditável." },
      { property: "og:title", content: "Gestão — TroKa" },
      { property: "og:description", content: "Aprovação de trocas, cadastro de profissionais e histórico auditável." },
    ],
  }),
  component: () => <AppShell title="Gestão" role="gestor"><Page /></AppShell>,
});

function Page() {
  return (
    <div className="space-y-8">
      <PlantoesSetor />
      <MockOnly bolt="B5–B9">
        <MockGestao />
      </MockOnly>
    </div>
  );
}

// TEMPORÁRIO: painel/aprovações/histórico mock até B5–B9.
function MockGestao() {
  const { user, state, hospital, name, decide } = useTroka();
  const [form, setForm] = useState(false);
  const hid = user!.memberships[0]!.hospitalId;
  const hs = state.shifts.filter((s) => s.hospitalId === hid);
  const open = hs.filter((s) => s.status === "aberto");
  const pending = state.coverages.filter((c) => c.status === "pendente" && hs.some((s) => s.id === c.shiftId));
  const alerts = open.filter((s) => eligibleDoctors(state, s).length === 0);

  const exportCsv = () => {
    const rows = [["Data/hora", "Quem", "Ação", "Detalhe"], ...state.audit.map((a) => [new Date(a.at).toISOString(), a.actorId === "sistema" ? "Sistema" : name(a.actorId), a.action, a.detail])];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "troka-historico.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm font-semibold text-muted-foreground">{hospital(hid).name}</p>
      <div className="grid grid-cols-3 gap-3">
        {[["Em aberto", open.length], ["Trocas pendentes", pending.length], ["Alertas de regra", alerts.length]].map(([l, v]) => (
          <div key={l} className="card p-4"><p className="text-3xl font-bold text-primary">{v}</p><p className="text-xs font-medium text-muted-foreground">{l}</p></div>
        ))}
      </div>
      {alerts.length > 0 && (
        <div className="rounded-xl bg-warning/15 p-3 text-sm text-warning">
          {alerts.map((s) => <p key={s.id}>Nenhum médico elegível para {s.sector} em {fmtDay(s.start)} {fmtTime(s.start)}.</p>)}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Aguardando aprovação</h2>
        {pending.length === 0 && <p className="card p-5 text-center text-sm text-muted-foreground">Nenhuma troca pendente.</p>}
        {pending.map((c) => {
          const s = state.shifts.find((x) => x.id === c.shiftId)!;
          return (
            <div key={c.id} className="card space-y-3 p-4">
              <div>
                <p className="font-bold">{s.sector} · {fmtDay(s.start)} {fmtTime(s.start)}–{fmtTime(s.end)}</p>
                <p className="text-sm text-muted-foreground">{name(c.requesterId)} → <span className="font-semibold text-foreground">{name(c.acceptedBy)}</span></p>
                <p className="text-xs text-muted-foreground">Motivo: {c.reason} · {c.urgency}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-danger" onClick={() => { decide(c.id, false); toast("Troca recusada."); }}>Recusar</button>
                <button className="btn btn-primary" onClick={() => { decide(c.id, true); toast.success("Troca aprovada."); }}>Aprovar</button>
              </div>
            </div>
          );
        })}
      </section>

      <button className="btn btn-outline w-full" onClick={() => setForm(true)}><UserPlus className="h-4 w-4" />Cadastrar profissional</button>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Histórico auditável</h2>
          <button className="btn btn-outline min-h-10 text-sm" onClick={exportCsv}><Download className="h-4 w-4" />CSV</button>
        </div>
        <ol className="card divide-y">
          {state.audit.map((a) => (
            <li key={a.id} className="p-4 text-sm">
              <div className="flex justify-between gap-2"><span className="font-bold">{a.action}</span><span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(a.at)}</span></div>
              <p className="text-muted-foreground">{a.detail}</p>
              <p className="text-xs">por {a.actorId === "sistema" ? "Sistema" : name(a.actorId)}</p>
            </li>
          ))}
        </ol>
      </section>
      {form && <ProfessionalForm onClose={() => setForm(false)} />}
    </div>
  );
}

function ProfessionalForm({ onClose }: { onClose: () => void }) {
  const { state, addProfessional } = useTroka();
  const [f, setF] = useState({ name: "", email: "", crm: "", specialty: "Clínico" as Specialty });
  const [mem, setMem] = useState<Record<string, Sector[]>>({});
  const toggle = (h: string, s: Sector) => setMem((m) => { const cur = m[h] ?? []; return { ...m, [h]: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] }; });
  const memberships = Object.entries(mem).filter(([, s]) => s.length).map(([hospitalId, sectors]) => ({ hospitalId, sectors }));
  const valid = f.name && f.email.includes("@") && f.crm && memberships.length;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-navy/60 sm:items-center">
      <form className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto rounded-t-3xl bg-background p-6 sm:rounded-3xl"
        onSubmit={(e) => { e.preventDefault(); if (!valid) return; addProfessional({ ...f, memberships }); toast.success("Profissional cadastrado."); onClose(); }}>
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Cadastrar profissional</h2><button type="button" onClick={onClose} aria-label="Fechar"><X /></button></div>
        <input className="field" placeholder="Nome completo" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="field" type="email" placeholder="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className="field" placeholder="Registro profissional (CRM)" value={f.crm} onChange={(e) => setF({ ...f, crm: e.target.value })} />
        <select className="field" value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value as Specialty })}>{SPECIALTIES.map((s) => <option key={s}>{s}</option>)}</select>
        {state.hospitals.map((h) => (
          <div key={h.id} className="space-y-2">
            <p className="text-sm font-semibold">{h.name}</p>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map((s) => (
                <button type="button" key={s} onClick={() => toggle(h.id, s)} className={`chip ${mem[h.id]?.includes(s) ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{s}</button>
              ))}
            </div>
          </div>
        ))}
        <button disabled={!valid} className="btn btn-primary w-full">Cadastrar</button>
      </form>
    </div>
  );
}
