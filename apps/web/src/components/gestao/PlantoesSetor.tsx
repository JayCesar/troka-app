import { useMemo, useState } from "react";
import { CalendarPlus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { PlantaoCard } from "@/components/PlantaoCard";
import {
  useCriarPlantao,
  useEditarPlantao,
  useEspecialidades,
  usePlantoesSetor,
  useProfissionaisSetor,
  useRemoverPlantao,
  type Plantao,
} from "@/lib/api/plantoes";

// RN05: gestor cria, edita e remove plantões do próprio setor. As regras são validadas no banco.
export function PlantoesSetor() {
  const { data, isLoading, error } = usePlantoesSetor();
  const remover = useRemoverPlantao();
  const [form, setForm] = useState<{ plantao?: Plantao } | null>(null);
  const agora = Date.now();

  const onRemover = (p: Plantao) => {
    if (!confirm("Remover este plantão?")) return;
    remover.mutate(p.id, {
      onSuccess: () => toast.success("Plantão removido."),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Plantões do setor</h2>
        <button className="btn btn-primary min-h-10 text-sm" onClick={() => setForm({})}>
          <CalendarPlus className="h-4 w-4" />Novo plantão
        </button>
      </div>
      {isLoading && <p className="card p-5 text-center text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="card p-5 text-center text-sm text-destructive">Erro: {error.message}</p>}
      {data?.length === 0 && <p className="card p-5 text-center text-sm text-muted-foreground">Nenhum plantão futuro.</p>}
      {data?.map((p) => {
        const editavel = new Date(p.inicio).getTime() > agora; // espelho da regra do banco (B2/P3), só para UX
        return (
          <PlantaoCard key={p.id} plantao={p} showProfissional>
            {editavel && (
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-outline min-h-10 text-sm" onClick={() => setForm({ plantao: p })}><Pencil className="h-4 w-4" />Editar</button>
                <button className="btn btn-danger min-h-10 text-sm" disabled={remover.isPending} onClick={() => onRemover(p)}><Trash2 className="h-4 w-4" />Remover</button>
              </div>
            )}
          </PlantaoCard>
        );
      })}
      {form && <PlantaoForm plantao={form.plantao} onClose={() => setForm(null)} />}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Formulário: data + turno (com horário personalizado). Horas são locais do navegador.
// ---------------------------------------------------------------------------
type Turno = "diurno" | "noturno" | "custom";
const TURNOS: { id: Turno; label: string; inicio?: string; fim?: string }[] = [
  { id: "diurno", label: "Diurno 07–19", inicio: "07:00", fim: "19:00" },
  { id: "noturno", label: "Noturno 19–07", inicio: "19:00", fim: "07:00" },
  { id: "custom", label: "Personalizado" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const amanha = () => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); };

// Fim no mesmo dia se depois do início; senão vira o dia seguinte (plantão noturno).
function intervalo(data: string, horaInicio: string, horaFim: string) {
  if (!data || !horaInicio || !horaFim) return null;
  const inicio = new Date(`${data}T${horaInicio}`);
  const fim = new Date(`${data}T${horaFim}`);
  if (fim <= inicio) fim.setDate(fim.getDate() + 1);
  if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return null;
  return { inicio, fim };
}

function estadoInicial(p?: Plantao) {
  if (!p) return { data: amanha(), turno: "diurno" as Turno, horaInicio: "07:00", horaFim: "19:00" };
  const i = new Date(p.inicio);
  const f = new Date(p.fim);
  const turno = TURNOS.find((t) => t.inicio === hm(i) && t.fim === hm(f) && f.getTime() - i.getTime() === 12 * 3_600_000)?.id ?? "custom";
  return { data: ymd(i), turno, horaInicio: hm(i), horaFim: hm(f) };
}

const fmtResumo = (d: Date) => d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function PlantaoForm({ plantao, onClose }: { plantao?: Plantao | undefined; onClose: () => void }) {
  const especialidades = useEspecialidades();
  const profissionais = useProfissionaisSetor();
  const criar = useCriarPlantao();
  const editar = useEditarPlantao();
  const [t, setT] = useState(() => estadoInicial(plantao));
  const [especialidadeId, setEspecialidadeId] = useState(plantao?.especialidade_id ?? "");
  const [profissionalId, setProfissionalId] = useState(plantao?.profissional_id ?? "");
  const [erro, setErro] = useState("");

  // Quantos profissionais do setor têm cada especialidade (o setor vem da RLS)
  const noSetor = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of profissionais.data ?? []) if (p.especialidade_id) m.set(p.especialidade_id, (m.get(p.especialidade_id) ?? 0) + 1);
    return m;
  }, [profissionais.data]);
  const doSetor = (especialidades.data ?? []).filter((e) => noSetor.has(e.id));
  const outras = (especialidades.data ?? []).filter((e) => !noSetor.has(e.id));

  // Pré-seleciona a primeira especialidade do setor ao criar
  if (!plantao && !especialidadeId && doSetor[0]) setEspecialidadeId(doSetor[0].id);

  // Só oferece quem tem a especialidade exigida (RN13); o banco revalida tudo.
  const elegiveis = (profissionais.data ?? []).filter((p) => p.especialidade_id === especialidadeId);
  const iv = intervalo(t.data, t.horaInicio, t.horaFim);
  const horas = iv ? Math.round((iv.fim.getTime() - iv.inicio.getTime()) / 3_600_000) : 0;
  const pending = criar.isPending || editar.isPending;
  const faltando = !especialidadeId ? "Escolha a especialidade." : !iv ? "Preencha a data e os horários." : "";

  const setTurno = (turno: Turno) => {
    const def = TURNOS.find((x) => x.id === turno)!;
    setT({ ...t, turno, horaInicio: def.inicio ?? t.horaInicio, horaFim: def.fim ?? t.horaFim });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (faltando || !iv) return;
    setErro("");
    const input = { especialidadeId, inicio: iv.inicio.toISOString(), fim: iv.fim.toISOString(), profissionalId: profissionalId || null };
    const done = {
      onSuccess: () => { toast.success(plantao ? "Plantão atualizado." : "Plantão criado."); onClose(); },
      onError: (err: Error) => setErro(err.message),
    };
    if (plantao) editar.mutate({ id: plantao.id, ...input }, done);
    else criar.mutate(input, done);
  };

  const opt = (e: { id: string; nome: string; categoria: string }) => (
    <option key={e.id} value={e.id}>
      {e.nome} ({e.categoria === "medico" ? "médico" : "enfermeiro"}){noSetor.has(e.id) ? ` · ${noSetor.get(e.id)} no setor` : ""}
    </option>
  );

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-navy/60 sm:items-center">
      <form className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-auto rounded-t-3xl bg-background p-6 sm:rounded-3xl" onSubmit={submit}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{plantao ? "Editar plantão" : "Novo plantão"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>

        <label className="block space-y-1 text-sm font-semibold">1. Especialidade exigida
          <select className="field" value={especialidadeId} onChange={(e) => { setEspecialidadeId(e.target.value); setProfissionalId(""); }}>
            <option value="">Selecione…</option>
            {doSetor.length > 0 && <optgroup label="Do seu setor">{doSetor.map(opt)}</optgroup>}
            {outras.length > 0 && <optgroup label="Outras">{outras.map(opt)}</optgroup>}
          </select>
        </label>

        <div className="space-y-2">
          <label className="block space-y-1 text-sm font-semibold">2. Data
            <input className="field" type="date" value={t.data} onChange={(e) => setT({ ...t, data: e.target.value })} />
          </label>
          <div className="flex flex-wrap gap-2">
            {TURNOS.map((x) => (
              <button type="button" key={x.id} onClick={() => setTurno(x.id)} className={`chip ${t.turno === x.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{x.label}</button>
            ))}
          </div>
          {t.turno === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-sm font-semibold">Início
                <input className="field" type="time" value={t.horaInicio} onChange={(e) => setT({ ...t, horaInicio: e.target.value })} />
              </label>
              <label className="block space-y-1 text-sm font-semibold">Fim
                <input className="field" type="time" value={t.horaFim} onChange={(e) => setT({ ...t, horaFim: e.target.value })} />
              </label>
            </div>
          )}
          {iv && <p className="text-sm text-muted-foreground">{fmtResumo(iv.inicio)} → {fmtResumo(iv.fim)} ({horas}h)</p>}
        </div>

        <label className="block space-y-1 text-sm font-semibold">3. Profissional (opcional)
          <select className="field" value={profissionalId} disabled={!especialidadeId || elegiveis.length === 0} onChange={(e) => setProfissionalId(e.target.value)}>
            <option value="">Deixar em aberto</option>
            {elegiveis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          {especialidadeId && elegiveis.length === 0 && (
            <span className="block text-xs font-normal text-muted-foreground">Ninguém do seu setor tem essa especialidade; o plantão fica em aberto.</span>
          )}
        </label>

        {erro && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{erro}</p>}
        {faltando && <p className="text-xs text-muted-foreground">{faltando}</p>}
        <button disabled={!!faltando || pending} className="btn btn-primary w-full">{pending ? "Salvando…" : "Salvar"}</button>
      </form>
    </div>
  );
}
