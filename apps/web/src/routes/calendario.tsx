import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, GripVertical, Lock } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { anuncioAtivo, useMeusPlantoes, usePlantoesSetor, type Plantao } from "@/lib/api/plantoes";
import { moverPlantao } from "@/lib/services/agenda";
import { fmtTime } from "@/lib/format";

export const Route = createFileRoute("/calendario")({
  head: () => ({ meta: [{ title: "Calendário — TroKa" }] }),
  component: () => <AppShell title="Calendário" wide><Page /></AppShell>,
});

// ---------------------------------------------------------------------------
// Turnos-alvo do arraste: soltar num turno define o início (07h ou 19h) e mantém a duração.
// ---------------------------------------------------------------------------
type Turno = "diurno" | "noturno";
const TURNOS: { id: Turno; label: string; hora: number }[] = [
  { id: "diurno", label: "Diurno", hora: 7 },
  { id: "noturno", label: "Noturno", hora: 19 },
];
const turnoDe = (d: Date): Turno => (d.getHours() >= 5 && d.getHours() < 17 ? "diurno" : "noturno");

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inicioDaSemana = (d: Date) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); // segunda-feira
  return s;
};
const addDias = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const fmtDiaLongo = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const alvoId = (dia: string, turno: Turno) => `${dia}|${turno}`;
const lerAlvo = (id: string) => {
  const [dia, turno] = id.split("|") as [string, Turno];
  const hora = TURNOS.find((t) => t.id === turno)!.hora;
  return { dia, turno, inicio: new Date(`${dia}T${pad(hora)}:00`) };
};

// Espelho da regra do banco (editar_plantao) só para UX; o banco é quem decide.
const podeMover = (p: Plantao) => new Date(p.inicio).getTime() > Date.now() && !anuncioAtivo(p);

function Page() {
  const { perfil } = useAuth();
  const gestor = perfil?.papel === "gestor";
  // D1: gestor vê o setor e arrasta; profissional vê só os próprios plantões
  const setor = usePlantoesSetor();
  const meus = useMeusPlantoes(perfil!.id);
  const query = gestor ? setor : meus;

  const qc = useQueryClient();
  const [semana, setSemana] = useState(() => inicioDaSemana(new Date()));
  const [arrastando, setArrastando] = useState<Plantao | null>(null);
  // Atualização otimista: posição nova enquanto o banco confirma; removida no sucesso (após refetch) ou no erro (reverte)
  const [pendentes, setPendentes] = useState<Record<string, { inicio: string; fim: string }>>({});

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDias(semana, i)), [semana]);
  const plantoes = useMemo(
    () => (query.data ?? []).map((p) => (pendentes[p.id] ? { ...p, ...pendentes[p.id] } : p)),
    [query.data, pendentes],
  );
  const porAlvo = useMemo(() => {
    const m = new Map<string, Plantao[]>();
    for (const p of plantoes) {
      const i = new Date(p.inicio);
      const k = alvoId(ymd(i), turnoDe(i));
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [plantoes]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }), // segurar para arrastar no celular
    useSensor(KeyboardSensor),
  );

  const onDragStart = (e: DragStartEvent) => setArrastando((e.active.data.current?.["plantao"] as Plantao) ?? null);

  const onDragEnd = async (e: DragEndEvent) => {
    setArrastando(null);
    const plantao = e.active.data.current?.["plantao"] as Plantao | undefined;
    if (!plantao || !e.over) return;
    const { inicio } = lerAlvo(String(e.over.id));
    if (inicio.getTime() === new Date(plantao.inicio).getTime()) return;
    if (inicio.getTime() <= Date.now()) {
      toast.error("Não é possível mover um plantão para o passado.");
      return;
    }

    const duracao = new Date(plantao.fim).getTime() - new Date(plantao.inicio).getTime();
    setPendentes((s) => ({ ...s, [plantao.id]: { inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + duracao).toISOString() } }));
    const limpar = () =>
      setPendentes((s) => {
        const { [plantao.id]: _, ...resto } = s;
        return resto;
      });
    try {
      await moverPlantao({ plantao, novoInicio: inicio });
      await Promise.all(["plantoes", "painel", "historico"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast.success(`Plantão movido para ${fmtDiaLongo(inicio)} ${fmtTime(inicio.getTime())}.`);
    } catch (err) {
      toast.error((err as Error).message); // ex.: "RN14: descanso mínimo de 11h não respeitado."
    } finally {
      limpar(); // sucesso: os dados novos já vieram; erro: o card volta para o lugar original
    }
  };

  const nomeAlvo = (id: string | number) => {
    const { dia, turno } = lerAlvo(String(id));
    return `${fmtDiaLongo(new Date(`${dia}T12:00`))}, turno ${turno}`;
  };
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Plantão ${rotulo(active.data.current?.["plantao"] as Plantao)} selecionado.`,
    onDragOver: ({ over }) => (over ? `Sobre ${nomeAlvo(over.id)}.` : "Fora do calendário."),
    onDragEnd: ({ over }) => (over ? `Plantão solto em ${nomeAlvo(over.id)}.` : "Plantão solto fora do calendário; nada mudou."),
    onDragCancel: () => "Arraste cancelado; nada mudou.",
  };

  const hoje = ymd(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button className="btn btn-outline min-h-10 px-3" onClick={() => setSemana((s) => addDias(s, -7))} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></button>
        <div className="text-center">
          <p className="font-bold">{fmtDiaLongo(dias[0]!)} – {fmtDiaLongo(dias[6]!)}</p>
          <button className="text-xs font-semibold text-primary" onClick={() => setSemana(inicioDaSemana(new Date()))}>Hoje</button>
        </div>
        <button className="btn btn-outline min-h-10 px-3" onClick={() => setSemana((s) => addDias(s, 7))} aria-label="Próxima semana"><ChevronRight className="h-4 w-4" /></button>
      </div>

      <p className="text-xs text-muted-foreground">
        {gestor
          ? "Arraste um plantão para outro dia ou turno (no celular, toque e segure). Pelo teclado: foque o plantão, Espaço para pegar, setas para mover, Espaço para soltar, Esc para cancelar."
          : "Seus plantões da semana. Mudanças de horário são feitas pela gestão; para trocar, use Pedir cobertura em Meus plantões."}
      </p>

      {query.isLoading && <p className="card p-6 text-center text-muted-foreground">Carregando…</p>}
      {query.error && <p className="card p-6 text-center text-destructive">Erro: {query.error.message}</p>}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setArrastando(null)}
        accessibility={{
          announcements: anuncios,
          screenReaderInstructions: { draggable: "Pressione Espaço para pegar o plantão, use as setas para mover e Espaço para soltar. Esc cancela." },
        }}
      >
        {/* Celular: um dia por linha. Desktop: 7 colunas. */}
        <div className="grid gap-2 md:grid-cols-7">
          {dias.map((d) => {
            const dia = ymd(d);
            return (
              <section key={dia} aria-label={fmtDiaLongo(d)} className={`card p-2 ${dia === hoje ? "ring-2 ring-primary" : ""}`}>
                <h2 className="mb-2 px-1 text-xs font-bold uppercase text-muted-foreground">{fmtDiaLongo(d)}</h2>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                  {TURNOS.map((t) => (
                    <Alvo key={t.id} id={alvoId(dia, t.id)} label={t.label} ativo={gestor}>
                      {(porAlvo.get(alvoId(dia, t.id)) ?? []).map((p) => (
                        <Cartao key={p.id} plantao={p} arrastavel={gestor && podeMover(p) && !pendentes[p.id]} salvando={!!pendentes[p.id]} mostrarProfissional={gestor} />
                      ))}
                    </Alvo>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>{arrastando && <CartaoConteudo plantao={arrastando} mostrarProfissional={gestor} flutuando />}</DragOverlay>
      </DndContext>
    </div>
  );
}

const rotulo = (p?: Plantao) =>
  p ? `${p.especialidade?.nome ?? ""} ${fmtDiaLongo(new Date(p.inicio))} ${fmtTime(new Date(p.inicio).getTime())}` : "";

function Alvo({ id, label, ativo, children }: { id: string; label: string; ativo: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !ativo });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-16 space-y-1 rounded-lg border border-dashed p-1 transition-colors ${isOver ? "border-primary bg-primary/10" : "border-border"}`}
    >
      <p className="px-1 text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Cartao({ plantao, arrastavel, salvando, mostrarProfissional }: { plantao: Plantao; arrastavel: boolean; salvando: boolean; mostrarProfissional: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: plantao.id, data: { plantao }, disabled: !arrastavel });
  return (
    <div
      ref={setNodeRef}
      {...(arrastavel ? { ...listeners, ...attributes } : {})}
      aria-label={`${arrastavel ? "Arrastar plantão " : "Plantão "}${rotulo(plantao)}`}
      className={`rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary ${arrastavel ? "cursor-grab touch-none" : ""} ${isDragging ? "opacity-40" : ""} ${salvando ? "animate-pulse" : ""}`}
    >
      <CartaoConteudo plantao={plantao} mostrarProfissional={mostrarProfissional} travado={mostrarProfissional && !arrastavel && !salvando} />
    </div>
  );
}

function CartaoConteudo({ plantao, mostrarProfissional, travado, flutuando }: { plantao: Plantao; mostrarProfissional: boolean; travado?: boolean; flutuando?: boolean }) {
  const anuncio = anuncioAtivo(plantao);
  const cor = anuncio ? "border-warning bg-warning/10" : plantao.profissional_id ? "border-primary bg-primary/10" : "border-border bg-secondary";
  const i = new Date(plantao.inicio).getTime();
  return (
    <div className={`flex items-start gap-1 rounded-md border-l-4 p-1.5 text-xs ${cor} ${flutuando ? "shadow-lg ring-2 ring-primary" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{plantao.especialidade?.nome}</p>
        <p>{fmtTime(i)}–{fmtTime(new Date(plantao.fim).getTime())}</p>
        {mostrarProfissional && <p className="truncate text-muted-foreground">{plantao.profissional?.nome ?? "Em aberto"}</p>}
        {anuncio && <p className="font-semibold text-warning">{anuncio.status === "pendente" ? "Troca pendente" : "Anunciado"}</p>}
      </div>
      {travado ? (
        <Lock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-label="Não pode ser movido (já começou ou tem anúncio/candidatura em aberto)" />
      ) : (
        mostrarProfissional && <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}
