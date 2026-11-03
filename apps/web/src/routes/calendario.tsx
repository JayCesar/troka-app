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
  component: () => <AppShell title="Calendário"><Page /></AppShell>,
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
const inicioDoDia = (d: Date) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
};
const fmtDiaMes = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const fmtDiaLongo = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const alvoId = (dia: string, turno: Turno) => `${dia}|${turno}`;
const lerAlvo = (id: string) => {
  const [dia, turno] = id.split("|") as [string, Turno];
  const hora = TURNOS.find((t) => t.id === turno)!.hora;
  return { dia, turno, inicio: new Date(`${dia}T${pad(hora)}:00`) };
};

// ---------------------------------------------------------------------------
// Visões (como no Google Calendar): 3 dias, semana, 15 dias e mês.
// ---------------------------------------------------------------------------
type Visao = "3d" | "7d" | "15d" | "mes";
const VISOES: { id: Visao; label: string; dias: number }[] = [
  { id: "3d", label: "3 dias", dias: 3 },
  { id: "7d", label: "Semana", dias: 7 },
  { id: "15d", label: "15 dias", dias: 15 },
  { id: "mes", label: "Mês", dias: 0 },
];
const DIAS_SEMANA = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

function diasDaVisao(visao: Visao, ancora: Date): Date[] {
  if (visao === "mes") {
    // Grade completa: da segunda da semana do dia 1 ao domingo da semana do último dia
    const inicio = inicioDaSemana(new Date(ancora.getFullYear(), ancora.getMonth(), 1));
    const fim = addDias(inicioDaSemana(new Date(ancora.getFullYear(), ancora.getMonth() + 1, 0)), 6);
    const total = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;
    return Array.from({ length: total }, (_, i) => addDias(inicio, i));
  }
  const n = VISOES.find((v) => v.id === visao)!.dias;
  const inicio = visao === "7d" ? inicioDaSemana(ancora) : inicioDoDia(ancora);
  return Array.from({ length: n }, (_, i) => addDias(inicio, i));
}

function deslocar(visao: Visao, ancora: Date, sentido: 1 | -1): Date {
  if (visao === "mes") return new Date(ancora.getFullYear(), ancora.getMonth() + sentido, 1);
  return addDias(ancora, sentido * VISOES.find((v) => v.id === visao)!.dias);
}

function tituloDoPeriodo(visao: Visao, ancora: Date, dias: Date[]): string {
  if (visao === "mes") return ancora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return `${fmtDiaMes(dias[0]!)} – ${fmtDiaMes(dias.at(-1)!)} de ${dias.at(-1)!.getFullYear()}`;
}

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
  const [visao, setVisao] = useState<Visao>("mes");
  const [ancora, setAncora] = useState(() => inicioDoDia(new Date()));
  const [arrastando, setArrastando] = useState<Plantao | null>(null);
  // Atualização otimista: posição nova enquanto o banco confirma; removida no sucesso (após refetch) ou no erro (reverte)
  const [pendentes, setPendentes] = useState<Record<string, { inicio: string; fim: string }>>({});

  const dias = useMemo(() => diasDaVisao(visao, ancora), [visao, ancora]);
  const rotuloVisao = VISOES.find((v) => v.id === visao)!.label.toLowerCase();
  // Clique numa data: abre a visão de 3 dias a partir dela (equivalente ao "dia" do Google Calendar)
  const abrirDia = (d: Date) => {
    setAncora(inicioDoDia(d));
    setVisao("3d");
  };
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn btn-outline min-h-10 px-4 text-sm" onClick={() => setAncora(inicioDoDia(new Date()))}>Hoje</button>
          <button className="btn btn-outline min-h-10 w-10 px-0" onClick={() => setAncora((a) => deslocar(visao, a, -1))} aria-label={`Período anterior (${rotuloVisao})`}><ChevronLeft className="h-4 w-4" /></button>
          <button className="btn btn-outline min-h-10 w-10 px-0" onClick={() => setAncora((a) => deslocar(visao, a, 1))} aria-label={`Próximo período (${rotuloVisao})`}><ChevronRight className="h-4 w-4" /></button>
          <h2 className="ml-1 text-lg font-bold capitalize" aria-live="polite">{tituloDoPeriodo(visao, ancora, dias)}</h2>
        </div>
        {/* Filtro de período */}
        <div role="group" aria-label="Período exibido" className="inline-flex rounded-full border bg-card p-1">
          {VISOES.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={visao === v.id}
              onClick={() => setVisao(v.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${visao === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {gestor
          ? "Arraste um plantão para outro dia ou turno (no celular, toque e segure). Pelo teclado: foque o plantão, Espaço para pegar, setas para mover, Espaço para soltar, Esc para cancelar."
          : "Seus plantões no período. Mudanças de horário são feitas pela gestão; para trocar, use Pedir cobertura em Meus plantões."}
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
        {visao === "mes" ? (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="grid grid-cols-7 border-b bg-muted/60">
              {DIAS_SEMANA.map((d) => <p key={d} className="py-2 text-center text-[10px] font-bold tracking-wider text-muted-foreground md:text-xs">{d}</p>)}
            </div>
            <div className="grid grid-cols-7">
              {dias.map((d, i) => {
                const dia = ymd(d);
                const doMes = d.getMonth() === ancora.getMonth();
                const qtd = TURNOS.reduce((n, t) => n + (porAlvo.get(alvoId(dia, t.id))?.length ?? 0), 0);
                return (
                  <section
                    key={dia}
                    aria-label={fmtDiaLongo(d)}
                    className={`min-h-16 border-b p-1 md:min-h-32 ${(i + 1) % 7 ? "border-r" : ""} ${doMes ? "" : "bg-muted/40"}`}
                  >
                    <button
                      type="button"
                      onClick={() => abrirDia(d)}
                      aria-label={`Ver ${fmtDiaLongo(d)}${qtd ? `, ${qtd} plantão(ões)` : ""}`}
                      className={`mx-auto mb-1 grid h-7 w-7 place-items-center rounded-full text-xs font-semibold transition-colors md:mx-0 ${
                        dia === hoje ? "bg-primary text-primary-foreground hover:brightness-110" : doMes ? "hover:bg-accent hover:text-accent-foreground" : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {d.getDate()}
                    </button>
                    {/* Celular: só indicadores; toque na data abre os detalhes */}
                    {qtd > 0 && (
                      <button type="button" onClick={() => abrirDia(d)} className="flex w-full justify-center gap-0.5 md:hidden" aria-hidden tabIndex={-1}>
                        {Array.from({ length: Math.min(qtd, 3) }, (_, k) => <span key={k} className="h-1.5 w-1.5 rounded-full bg-primary" />)}
                      </button>
                    )}
                    {/* Desktop: turnos com os plantões (arrastáveis pelo gestor) */}
                    <div className="hidden space-y-1 md:block">
                      {TURNOS.map((t) => (
                        <Alvo key={t.id} id={alvoId(dia, t.id)} label={t.label} ativo={gestor} compacto>
                          {(porAlvo.get(alvoId(dia, t.id)) ?? []).map((p) => (
                            <Cartao key={p.id} plantao={p} arrastavel={gestor && podeMover(p) && !pendentes[p.id]} salvando={!!pendentes[p.id]} mostrarProfissional={gestor} compacto />
                          ))}
                        </Alvo>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          /* Celular: um dia por linha. Desktop: 3 ou 7 colunas (15 dias quebra em linhas). */
          <div className={`grid gap-2 ${visao === "3d" ? "md:grid-cols-3" : "md:grid-cols-7"}`}>
            {dias.map((d) => {
              const dia = ymd(d);
              return (
                <section key={dia} aria-label={fmtDiaLongo(d)} className={`card p-2 ${dia === hoje ? "ring-2 ring-primary" : ""}`}>
                  <h2 className="mb-2">
                    <button
                      type="button"
                      onClick={() => abrirDia(d)}
                      disabled={visao === "3d"}
                      className="rounded-md px-1 text-xs font-bold uppercase text-muted-foreground transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:cursor-default disabled:opacity-100"
                    >
                      {fmtDiaLongo(d)}
                    </button>
                  </h2>
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
        )}
        <DragOverlay dropAnimation={null}>{arrastando && <CartaoConteudo plantao={arrastando} mostrarProfissional={gestor} flutuando />}</DragOverlay>
      </DndContext>
    </div>
  );
}

const rotulo = (p?: Plantao) =>
  p ? `${p.especialidade?.nome ?? ""} ${fmtDiaLongo(new Date(p.inicio))} ${fmtTime(new Date(p.inicio).getTime())}` : "";

function Alvo({ id, label, ativo, compacto, children }: { id: string; label: string; ativo: boolean; compacto?: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !ativo });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-1 rounded-lg border border-dashed p-1 transition-colors ${compacto ? "min-h-8" : "min-h-16"} ${isOver ? "border-primary bg-primary/10" : compacto ? "border-transparent" : "border-border"}`}
    >
      <p className={`px-1 font-semibold uppercase text-muted-foreground ${compacto ? "text-[9px]" : "text-[10px]"}`}>{label}</p>
      {children}
    </div>
  );
}

function Cartao({ plantao, arrastavel, salvando, mostrarProfissional, compacto }: { plantao: Plantao; arrastavel: boolean; salvando: boolean; mostrarProfissional: boolean; compacto?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: plantao.id, data: { plantao }, disabled: !arrastavel });
  return (
    <div
      ref={setNodeRef}
      {...(arrastavel ? { ...listeners, ...attributes } : {})}
      aria-label={`${arrastavel ? "Arrastar plantão " : "Plantão "}${rotulo(plantao)}`}
      className={`rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary ${arrastavel ? "cursor-grab touch-none transition-shadow hover:shadow-md active:cursor-grabbing" : ""} ${isDragging ? "opacity-40" : ""} ${salvando ? "animate-pulse" : ""}`}
    >
      {compacto ? (
        <CartaoCompacto plantao={plantao} mostrarProfissional={mostrarProfissional} />
      ) : (
        <CartaoConteudo plantao={plantao} mostrarProfissional={mostrarProfissional} travado={mostrarProfissional && !arrastavel && !salvando} />
      )}
    </div>
  );
}

// Uma linha para caber na célula do mês: "07:00 Clínica · Ana"
function CartaoCompacto({ plantao, mostrarProfissional }: { plantao: Plantao; mostrarProfissional: boolean }) {
  const anuncio = anuncioAtivo(plantao);
  const cor = anuncio ? "border-warning bg-warning/10" : plantao.profissional_id ? "border-primary bg-primary/10" : "border-border bg-secondary";
  const quem = mostrarProfissional ? ` · ${plantao.profissional?.nome.split(" ")[0] ?? "Em aberto"}` : "";
  return (
    <p className={`truncate rounded border-l-2 px-1 py-0.5 text-[11px] ${cor}`} title={`${rotulo(plantao)}${quem}`}>
      <span className="font-semibold">{fmtTime(new Date(plantao.inicio).getTime())}</span> {plantao.especialidade?.nome}{quem}
    </p>
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
