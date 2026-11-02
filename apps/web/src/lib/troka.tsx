import { createContext, useContext, useState, type ReactNode } from "react";

export type Sector = "UTI Adulto" | "Pronto-Socorro" | "Clínica Médica";
export type Specialty = "Intensivista" | "Emergencista" | "Clínico";
export type Urgency = "Hoje" | "Até 3 dias" | "Mais de 3 dias";
export const SECTORS: Sector[] = ["UTI Adulto", "Pronto-Socorro", "Clínica Médica"];
export const SPECIALTIES: Specialty[] = ["Intensivista", "Emergencista", "Clínico"];
export const SECTOR_SPECIALTY: Record<Sector, Specialty> = {
  "UTI Adulto": "Intensivista",
  "Pronto-Socorro": "Emergencista",
  "Clínica Médica": "Clínico",
};
export const REASONS = ["Problema de saúde", "Compromisso familiar", "Congresso/curso", "Conflito de agenda", "Outro"];

export interface Hospital {
  id: string; name: string; short: string;
  rules: { minRestHours: number; weeklyLimitHours: number; autoApprove: boolean; bonus: Partial<Record<Urgency, number>> };
}
export interface User {
  id: string; name: string; email: string; role: "gestor" | "medico";
  crm?: string; specialty?: Specialty; memberships: { hospitalId: string; sectors: Sector[] }[];
}
export type ShiftStatus = "aberto" | "confirmado" | "anuncio" | "pendente";
export interface Shift { id: string; hospitalId: string; sector: Sector; start: number; end: number; status: ShiftStatus; doctorId?: string; urgent?: boolean }
export interface Coverage { id: string; shiftId: string; requesterId: string; reason: string; urgency: Urgency; status: "aberto" | "pendente" | "aprovado" | "recusado"; acceptedBy?: string; at: number }
export interface Audit { id: string; at: number; actorId: string; action: string; detail: string }
export interface Notice { id: string; userId: string; text: string; at: number; read: boolean }

const H = 3600_000;
const base = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
const t = (day: number, hour: number) => base + day * 24 * H + hour * H;
const sh = (id: string, hospitalId: string, sector: Sector, day: number, hour: number, status: ShiftStatus, doctorId?: string, urgent?: boolean): Shift => {
  const s: Shift = { id, hospitalId, sector, start: t(day, hour), end: t(day, hour) + 12 * H, status };
  if (doctorId !== undefined) s.doctorId = doctorId;
  if (urgent !== undefined) s.urgent = urgent;
  return s;
};

const hospitals: Hospital[] = [
  { id: "hv", name: "Hospital Vila Nova", short: "Vila Nova", rules: { minRestHours: 11, weeklyLimitHours: 60, autoApprove: false, bonus: { Hoje: 200, "Até 3 dias": 100 } } },
  { id: "sc", name: "Hospital Santa Clara", short: "Santa Clara", rules: { minRestHours: 11, weeklyLimitHours: 60, autoApprove: true, bonus: { Hoje: 150 } } },
];

const users: User[] = [
  { id: "g1", name: "Ana Ribeiro", email: "ana@vilanova.com.br", role: "gestor", memberships: [{ hospitalId: "hv", sectors: [] }] },
  { id: "d1", name: "Dr. Carlos Mendes", email: "carlos@troka.app", role: "medico", crm: "CRM-SP 123456", specialty: "Clínico", memberships: [{ hospitalId: "hv", sectors: ["Clínica Médica", "Pronto-Socorro"] }, { hospitalId: "sc", sectors: ["Clínica Médica"] }] },
  { id: "d2", name: "Dra. Beatriz Lima", email: "beatriz@troka.app", role: "medico", crm: "CRM-SP 234567", specialty: "Intensivista", memberships: [{ hospitalId: "hv", sectors: ["UTI Adulto"] }, { hospitalId: "sc", sectors: ["UTI Adulto"] }] },
  { id: "d3", name: "Dr. Rafael Costa", email: "rafael@troka.app", role: "medico", crm: "CRM-SP 345678", specialty: "Emergencista", memberships: [{ hospitalId: "hv", sectors: ["Pronto-Socorro"] }] },
  { id: "d4", name: "Dra. Juliana Alves", email: "juliana@troka.app", role: "medico", crm: "CRM-SP 456789", specialty: "Clínico", memberships: [{ hospitalId: "hv", sectors: ["Clínica Médica"] }, { hospitalId: "sc", sectors: ["Clínica Médica"] }] },
  { id: "d5", name: "Dr. Pedro Nogueira", email: "pedro@troka.app", role: "medico", crm: "CRM-SP 567890", specialty: "Intensivista", memberships: [{ hospitalId: "sc", sectors: ["UTI Adulto"] }] },
  { id: "d6", name: "Dra. Marina Souza", email: "marina@troka.app", role: "medico", crm: "CRM-SP 678901", specialty: "Emergencista", memberships: [{ hospitalId: "hv", sectors: ["Pronto-Socorro"] }, { hospitalId: "sc", sectors: ["Pronto-Socorro"] }] },
];

const shifts: Shift[] = [
  sh("s1", "hv", "Clínica Médica", 1, 7, "confirmado", "d1"),
  sh("s2", "sc", "Clínica Médica", 3, 19, "confirmado", "d1"),
  sh("s3", "hv", "Clínica Médica", 6, 7, "confirmado", "d1"),
  sh("s4", "hv", "Clínica Médica", 2, 7, "aberto"),
  sh("s5", "hv", "Clínica Médica", 1, 19, "aberto"),
  sh("s6", "hv", "Pronto-Socorro", 2, 19, "aberto"),
  sh("s7", "sc", "Clínica Médica", 4, 19, "aberto", undefined, true),
  sh("s8", "sc", "UTI Adulto", 2, 7, "aberto"),
  sh("s9", "hv", "UTI Adulto", 3, 7, "confirmado", "d2"),
  sh("s10", "hv", "Clínica Médica", 5, 7, "anuncio", "d4"),
  sh("s11", "hv", "Pronto-Socorro", 1, 19, "pendente", "d3"),
  sh("s12", "sc", "UTI Adulto", 3, 19, "confirmado", "d5"),
];

const coverages: Coverage[] = [
  { id: "c1", shiftId: "s10", requesterId: "d4", reason: "Congresso/curso", urgency: "Até 3 dias", status: "aberto", at: base - 5 * H },
  { id: "c2", shiftId: "s11", requesterId: "d3", reason: "Problema de saúde", urgency: "Hoje", status: "pendente", acceptedBy: "d6", at: base - 3 * H },
];

const audit: Audit[] = [
  { id: "a1", at: base - 30 * H, actorId: "g1", action: "Plantão criado", detail: "12 plantões publicados na escala" },
  { id: "a2", at: base - 5 * H, actorId: "d4", action: "Anúncio publicado", detail: "Clínica Médica · Vila Nova" },
  { id: "a3", at: base - 3 * H, actorId: "d3", action: "Anúncio publicado", detail: "Pronto-Socorro · Vila Nova" },
  { id: "a4", at: base - 2 * H, actorId: "d6", action: "Anúncio aceito", detail: "Pronto-Socorro · Vila Nova (cobrindo Dr. Rafael Costa)" },
];

const notices: Notice[] = [
  { id: "n1", userId: "d1", text: "Novo anúncio elegível: Clínica Médica · Vila Nova", at: base - 5 * H, read: false },
  { id: "n2", userId: "g1", text: "Troca aguardando aprovação: Pronto-Socorro", at: base - 2 * H, read: false },
];

export interface State { hospitals: Hospital[]; users: User[]; shifts: Shift[]; coverages: Coverage[]; audit: Audit[]; notices: Notice[]; currentUserId: string | null }
export const initialState = (): State => ({ hospitals, users, shifts, coverages, audit, notices, currentUserId: null });

/* ---------- Regras ---------- */
const weekStart = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); const day = (d.getDay() + 6) % 7; return d.getTime() - day * 24 * H; };

export function checkEligibility(s: State, doctor: User, shift: Shift): string[] {
  const reasons: string[] = [];
  const hosp = s.hospitals.find((h) => h.id === shift.hospitalId)!;
  const m = doctor.memberships.find((x) => x.hospitalId === shift.hospitalId);
  if (!m) reasons.push(`Você não está cadastrado no ${hosp.name}.`);
  else if (!m.sectors.includes(shift.sector)) reasons.push(`Você não está cadastrado no setor ${shift.sector}.`);
  const need = SECTOR_SPECIALTY[shift.sector];
  if (doctor.specialty !== need) reasons.push(`Exige especialidade ${need}.`);
  const mine = s.shifts.filter((x) => x.doctorId === doctor.id && x.id !== shift.id && (x.status === "confirmado" || x.status === "pendente" || x.status === "anuncio"));
  const minRest = hosp.rules.minRestHours * H;
  for (const o of mine) {
    const gap = Math.max(o.start - shift.end, shift.start - o.end);
    if (gap < 0) { reasons.push("Sobrepõe outro plantão seu."); break; }
    if (gap < minRest) { reasons.push(`Descanso mínimo de ${hosp.rules.minRestHours}h não respeitado (${Math.round(gap / H)}h).`); break; }
  }
  const ws = weekStart(shift.start);
  const weekHours = mine.filter((o) => weekStart(o.start) === ws).reduce((a, o) => a + (o.end - o.start) / H, 0) + (shift.end - shift.start) / H;
  if (weekHours > hosp.rules.weeklyLimitHours) reasons.push(`Ultrapassa o limite semanal de ${hosp.rules.weeklyLimitHours}h.`);
  return reasons;
}

export function eligibleDoctors(s: State, shift: Shift, excludeId?: string) {
  return s.users.filter((u) => u.role === "medico" && u.id !== excludeId && checkEligibility(s, u, shift).length === 0);
}

/* ---------- Store ---------- */
let seq = 100;
const uid = (p: string) => `${p}${++seq}`;

function useTrokaStore() {
  const [state, setState] = useState<State>(initialState);
  const user = state.users.find((u) => u.id === state.currentUserId) ?? null;
  const name = (id?: string) => state.users.find((u) => u.id === id)?.name ?? "—";
  const hospital = (id: string) => state.hospitals.find((h) => h.id === id)!;
  const label = (sh: Shift) => `${sh.sector} · ${hospital(sh.hospitalId).short} · ${fmtDay(sh.start)}`;

  const log = (s: State, actorId: string, action: string, detail: string): State => ({ ...s, audit: [{ id: uid("a"), at: Date.now(), actorId, action, detail }, ...s.audit] });
  const notify = (s: State, userIds: string[], text: string): State => ({ ...s, notices: [...userIds.map((userId) => ({ id: uid("n"), userId, text, at: Date.now(), read: false })), ...s.notices] });
  const gestoresOf = (s: State, hid: string) => s.users.filter((u) => u.role === "gestor" && u.memberships.some((m) => m.hospitalId === hid)).map((u) => u.id);

  return {
    state, user, name, hospital, label,
    login(email: string) {
      const u = state.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (u) setState((s) => ({ ...s, currentUserId: u.id }));
      return u ?? null;
    },
    logout: () => setState((s) => ({ ...s, currentUserId: null })),
    markRead: () => setState((s) => ({ ...s, notices: s.notices.map((n) => (n.userId === s.currentUserId ? { ...n, read: true } : n)) })),
    takeShift(shiftId: string) {
      setState((s) => {
        const me = s.users.find((u) => u.id === s.currentUserId)!;
        const shift = s.shifts.find((x) => x.id === shiftId)!;
        if (shift.status !== "aberto" || checkEligibility(s, me, shift).length) return s;
        let n: State = { ...s, shifts: s.shifts.map((x) => (x.id === shiftId ? { ...x, status: "confirmado", doctorId: me.id } : x)) };
        return log(n, me.id, "Plantão assumido", label(shift));
      });
    },
    publish(shiftId: string, reason: string, urgency: Urgency) {
      setState((s) => {
        const me = s.users.find((u) => u.id === s.currentUserId)!;
        const shift = s.shifts.find((x) => x.id === shiftId)!;
        let n: State = {
          ...s,
          shifts: s.shifts.map((x) => (x.id === shiftId ? { ...x, status: "anuncio", urgent: urgency === "Hoje" || x.urgent === true } : x)),
          coverages: [{ id: uid("c"), shiftId, requesterId: me.id, reason, urgency, status: "aberto", at: Date.now() }, ...s.coverages],
        };
        n = log(n, me.id, "Anúncio publicado", `${label(shift)} · ${reason} · ${urgency}`);
        return notify(n, eligibleDoctors(s, shift, me.id).map((u) => u.id), `Novo anúncio elegível: ${label(shift)}`);
      });
    },
    acceptCoverage(coverageId: string) {
      setState((s) => {
        const me = s.users.find((u) => u.id === s.currentUserId)!;
        const cov = s.coverages.find((c) => c.id === coverageId)!;
        const shift = s.shifts.find((x) => x.id === cov.shiftId)!;
        if (cov.status !== "aberto" || checkEligibility(s, me, shift).length) return s;
        const auto = s.hospitals.find((h) => h.id === shift.hospitalId)!.rules.autoApprove;
        let n: State = {
          ...s,
          coverages: s.coverages.map((c) => (c.id === coverageId ? { ...c, acceptedBy: me.id, status: auto ? "aprovado" : "pendente" } : c)),
          shifts: s.shifts.map((x) => (x.id === shift.id ? (auto ? { ...x, status: "confirmado", doctorId: me.id } : { ...x, status: "pendente" }) : x)),
        };
        n = log(n, me.id, "Anúncio aceito", `${label(shift)} (cobrindo ${name(cov.requesterId)})`);
        if (auto) {
          n = log(n, "sistema", "Troca aprovada", `${label(shift)} · aprovação automática`);
          return notify(n, [cov.requesterId, me.id], `Troca aprovada: ${label(shift)}`);
        }
        return notify(notify(n, [cov.requesterId], `Seu anúncio foi aceito por ${me.name}`), gestoresOf(s, shift.hospitalId), `Troca aguardando aprovação: ${label(shift)}`);
      });
    },
    decide(coverageId: string, approve: boolean) {
      setState((s) => {
        const me = s.users.find((u) => u.id === s.currentUserId)!;
        const cov = s.coverages.find((c) => c.id === coverageId)!;
        const shift = s.shifts.find((x) => x.id === cov.shiftId)!;
        let n: State = {
          ...s,
          coverages: s.coverages.map((c) => (c.id === coverageId ? { ...c, status: approve ? "aprovado" : "recusado" } : c)),
          shifts: s.shifts.map((x) => (x.id === shift.id ? (approve ? { ...x, status: "confirmado", doctorId: cov.acceptedBy! } : { ...x, status: "confirmado", doctorId: cov.requesterId }) : x)),
        };
        n = log(n, me.id, approve ? "Troca aprovada" : "Troca recusada", `${label(shift)} · ${name(cov.requesterId)} → ${name(cov.acceptedBy)}`);
        return notify(n, [cov.requesterId, cov.acceptedBy!], `Troca ${approve ? "aprovada" : "recusada"}: ${label(shift)}`);
      });
    },
    addProfessional(p: Omit<User, "id" | "role">) {
      setState((s) => {
        const me = s.users.find((u) => u.id === s.currentUserId)!;
        const n: State = { ...s, users: [...s.users, { ...p, id: uid("d"), role: "medico" }] };
        return log(n, me.id, "Profissional cadastrado", `${p.name} · ${p.specialty} · ${p.crm}`);
      });
    },
  };
}

type Store = ReturnType<typeof useTrokaStore>;
const Ctx = createContext<Store | null>(null);
export function TrokaProvider({ children }: { children: ReactNode }) {
  const store = useTrokaStore();
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
export function useTroka() {
  const c = useContext(Ctx);
  if (!c) throw new Error("TrokaProvider ausente");
  return c;
}

/* ---------- Formatação ---------- */
export const fmtDay = (ts: number) => new Date(ts).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (ts: number) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
