import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Download, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, MockOnly } from "@/components/AppShell";
import { PlantoesSetor } from "@/components/gestao/PlantoesSetor";
import { AnunciosSetor } from "@/components/gestao/AnunciosSetor";
import { Pendencias } from "@/components/gestao/Pendencias";
import { Alertas } from "@/components/gestao/Alertas";
import { Equipe } from "@/components/gestao/Equipe";
import { Historico } from "@/components/gestao/Historico";
import { Painel } from "@/components/gestao/Painel";
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
      <Painel />
      <Alertas />
      <Pendencias />
      <AnunciosSetor />
      <PlantoesSetor />
      <Equipe />
      <Historico />
      <MockOnly bolt="B10">
        <MockGestao />
      </MockOnly>
    </div>
  );
}

// TEMPORÁRIO: cadastro mock até o B10.
function MockGestao() {
  const [form, setForm] = useState(false);

  return (
    <div className="space-y-6">
      <button className="btn btn-outline w-full" onClick={() => setForm(true)}><UserPlus className="h-4 w-4" />Cadastrar profissional</button>

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
