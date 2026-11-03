import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, ClipboardCheck, HandHelping, Hourglass, Megaphone, UserX, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { falta, moverHolofote, useAgora, useContagem } from "@/components/inicio/efeitos";
import { useAnunciosSetor } from "@/lib/api/anuncios";
import { useAlertas, usePendencias } from "@/lib/api/gestao";
import { useMinhasSolicitacoes, useOfertas } from "@/lib/api/ofertas";
import { anuncioAtivo, useMeusPlantoes, usePlantoesSetor, type Plantao } from "@/lib/api/plantoes";
import { fmtTime } from "@/lib/format";

type Destino = "/calendario" | "/plantoes" | "/assumir" | "/gestao/aprovacoes" | "/gestao/anuncios" | "/gestao/plantoes";
interface Indicador { label: string; valor: number | undefined; icon: LucideIcon; to: Destino; destaque?: boolean }

const atraso = (i: number) => ({ "--atraso": `${i * 70}ms` }) as CSSProperties;

// ---------------------------------------------------------------------------
// Seção 2 do Início: números do dia + próximos 7 dias. Versão por papel (hooks diferentes).
// ---------------------------------------------------------------------------
export function PanoramaProfissional({ userId }: { userId: string }) {
  const meus = useMeusPlantoes(userId);
  const ofertas = useOfertas();
  const solicitacoes = useMinhasSolicitacoes();
  const agora = useAgora();
  const plantoes = meus.data ?? [];
  const semana = plantoes.filter((p) => new Date(p.inicio).getTime() < agora + 7 * 86_400_000);
  const proximo = plantoes.find((p) => new Date(p.fim).getTime() > agora);

  const indicadores: Indicador[] = [
    { label: "Plantões nos próximos 7 dias", valor: meus.data ? semana.length : undefined, icon: CalendarClock, to: "/plantoes" },
    { label: "Disponíveis para assumir", valor: ofertas.data?.length, icon: HandHelping, to: "/assumir", destaque: (ofertas.data?.length ?? 0) > 0 },
    { label: "Aguardando aprovação", valor: solicitacoes.data?.length, icon: Hourglass, to: "/assumir" },
  ];

  return (
    <Moldura titulo="Seu panorama">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
        <ProximoPlantao plantao={proximo} agora={agora} carregando={meus.isLoading} />
        <div className="grid gap-3 sm:grid-cols-3">
          {indicadores.map((ind, i) => <Tile key={ind.label} ind={ind} i={i + 1} />)}
        </div>
      </div>
      <Semana plantoes={plantoes} agora={agora} rotulo="Sua semana" />
    </Moldura>
  );
}

export function PanoramaGestor() {
  const pendencias = usePendencias();
  const anuncios = useAnunciosSetor();
  const setor = usePlantoesSetor();
  const alertas = useAlertas();
  const agora = useAgora();
  const emAberto = setor.data?.filter((p) => !p.profissional_id).length;

  const indicadores: Indicador[] = [
    { label: "Aguardando sua aprovação", valor: pendencias.data?.length, icon: ClipboardCheck, to: "/gestao/aprovacoes", destaque: (pendencias.data?.length ?? 0) > 0 },
    { label: "Anúncios em aberto", valor: anuncios.data?.length, icon: Megaphone, to: "/gestao/anuncios" },
    { label: "Plantões sem profissional", valor: emAberto, icon: UserX, to: "/gestao/plantoes", destaque: (emAberto ?? 0) > 0 },
    { label: "Plantões em risco", valor: alertas.data?.length, icon: AlertTriangle, to: "/gestao/aprovacoes", destaque: (alertas.data?.length ?? 0) > 0 },
  ];

  return (
    <Moldura titulo="Panorama do setor">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map((ind, i) => <Tile key={ind.label} ind={ind} i={i} />)}
      </div>
      <Semana plantoes={setor.data ?? []} agora={agora} rotulo="Cobertura dos próximos 7 dias" mostrarAbertos />
    </Moldura>
  );
}

function Moldura({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="entrar text-2xl font-bold md:text-3xl" style={atraso(0)}>{titulo}</h2>
      {children}
    </div>
  );
}

function Tile({ ind, i }: { ind: Indicador; i: number }) {
  const valor = useContagem(ind.valor);
  return (
    <Link
      to={ind.to}
      onMouseMove={moverHolofote}
      style={atraso(i)}
      className="entrar holofote card group flex flex-col justify-between gap-4 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{ind.label}</p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${ind.destaque ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"} group-hover:bg-primary group-hover:text-primary-foreground`}>
          <ind.icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className={`text-4xl font-bold tabular-nums ${ind.destaque ? "text-primary" : ""}`}>{valor ?? "–"}</p>
    </Link>
  );
}

function ProximoPlantao({ plantao, agora, carregando }: { plantao: Plantao | undefined; agora: number; carregando: boolean }) {
  const inicio = plantao ? new Date(plantao.inicio).getTime() : 0;
  const fim = plantao ? new Date(plantao.fim).getTime() : 0;
  const andamento = plantao && inicio <= agora;
  const progresso = andamento ? Math.min(100, ((agora - inicio) / (fim - inicio)) * 100) : 0;
  return (
    <Link
      to="/plantoes"
      onMouseMove={moverHolofote}
      className="entrar holofote card group relative flex flex-col justify-between gap-3 overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
      style={atraso(0)}
    >
      <p className="text-sm font-medium text-muted-foreground">{andamento ? "Plantão em andamento" : "Próximo plantão"}</p>
      {carregando ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : plantao ? (
        <>
          <div>
            <p className="text-3xl font-bold text-primary">{andamento ? `termina ${falta(fim - agora)}` : falta(inicio - agora)}</p>
            <p className="mt-1 font-semibold">{plantao.especialidade?.nome}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(inicio).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {fmtTime(inicio)}–{fmtTime(fim)}
            </p>
          </div>
          {andamento && (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progresso)} aria-valuemin={0} aria-valuemax={100} aria-label="Andamento do plantão">
              <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${progresso}%` }} />
            </div>
          )}
          {anuncioAtivo(plantao) && <span className="chip w-fit bg-warning/15 text-warning">Anunciado para troca</span>}
        </>
      ) : (
        <p className="text-lg font-semibold">Nenhum plantão agendado. Que tal assumir um?</p>
      )}
    </Link>
  );
}

// Faixa dos próximos 7 dias: barras por turno; clique leva ao calendário.
function Semana({ plantoes, agora, rotulo, mostrarAbertos }: { plantoes: Plantao[]; agora: number; rotulo: string; mostrarAbertos?: boolean }) {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + i);
    const doDia = plantoes.filter((p) => new Date(p.inicio).toDateString() === d.toDateString());
    return { d, total: doDia.length, abertos: doDia.filter((p) => !p.profissional_id).length };
  });
  const max = Math.max(1, ...dias.map((x) => x.total));

  return (
    <div className="entrar card p-4" style={atraso(5)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{rotulo}</p>
        <Link to="/calendario" className="text-xs font-semibold text-primary hover:underline">Abrir calendário</Link>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {dias.map(({ d, total, abertos }, i) => (
          <Link
            key={i}
            to="/calendario"
            aria-label={`${d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit" })}: ${total} plantão(ões)${mostrarAbertos && abertos ? `, ${abertos} sem profissional` : ""}`}
            className={`group flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all hover:-translate-y-0.5 hover:bg-accent ${i === 0 ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}
          >
            <span className="text-[10px] font-bold uppercase text-muted-foreground">{i === 0 ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
            <span className="text-lg font-bold leading-none">{d.getDate()}</span>
            {/* barra: altura proporcional; parte âmbar = sem profissional */}
            <span className="flex h-14 w-full max-w-8 flex-col-reverse overflow-hidden rounded-md bg-muted">
              <span className="w-full bg-primary transition-all duration-700 group-hover:brightness-110" style={{ height: `${((total - (mostrarAbertos ? abertos : 0)) / max) * 100}%` }} />
              {mostrarAbertos && abertos > 0 && <span className="w-full bg-warning" style={{ height: `${(abertos / max) * 100}%` }} />}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{total}</span>
          </Link>
        ))}
      </div>
      {mostrarAbertos && (
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Com profissional</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-warning" />Sem profissional</span>
        </div>
      )}
    </div>
  );
}
