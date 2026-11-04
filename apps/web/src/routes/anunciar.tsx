import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { anuncioAtivo, useMeusPlantoes } from "@/lib/api/plantoes";
import { CATEGORIAS, previaExpiracao, URGENCIAS, useAnunciar, type MotivoCategoria, type Urgencia } from "@/lib/api/anuncios";
import { fmtDateTime, fmtDay, fmtTime } from "@/lib/format";
import { Selecao } from "@/components/Selecao";

export const Route = createFileRoute("/anunciar")({
  validateSearch: (s: Record<string, unknown>): { plantao?: string } =>
    typeof s["plantao"] === "string" ? { plantao: s["plantao"] } : {},
  head: () => ({
    meta: [
      { title: "Anunciar plantão — TroKa" },
      { name: "description", content: "Peça cobertura para um plantão que você não poderá cumprir." },
    ],
  }),
  component: () => <AppShell title="Anunciar plantão" role="profissional"><Page /></AppShell>,
});

const TEXTO_MAX = 500; // decisão B3/P2

function Page() {
  const { perfil } = useAuth();
  const { plantao: preSelecionado } = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading } = useMeusPlantoes(perfil!.id);
  const anunciar = useAnunciar();

  // RN07: só os próprios plantões, antes do início; RN08: sem anúncio em aberto
  const anunciaveis = (data ?? []).filter((p) => new Date(p.inicio).getTime() > Date.now() && !anuncioAtivo(p));
  const [plantaoId, setPlantaoId] = useState(preSelecionado ?? "");
  const [urgencia, setUrgencia] = useState<Urgencia | null>(null);
  const [categoria, setCategoria] = useState<MotivoCategoria | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");

  const plantao = anunciaveis.find((p) => p.id === plantaoId) ?? anunciaveis[0];
  if (isLoading) return <p className="card p-6 text-center text-muted-foreground">Carregando…</p>;
  if (!plantao) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-muted-foreground">Você não tem plantões futuros sem anúncio em aberto.</p>
        <Link to="/plantoes" className="btn btn-outline">Ver meus plantões</Link>
      </div>
    );
  }

  const prazo = urgencia ? previaExpiracao(urgencia, plantao.inicio) : null;
  const cortadoNoInicio = prazo !== null && prazo.getTime() === new Date(plantao.inicio).getTime();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urgencia) return setErro("Escolha a urgência.");
    setErro("");
    anunciar.mutate(
      { plantaoId: plantao.id, urgencia, categoria, texto },
      {
        onSuccess: () => { toast.success("Anúncio publicado."); navigate({ to: "/plantoes" }); },
        onError: (err) => setErro(err.message),
      },
    );
  };

  return (
    <form className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8" onSubmit={submit}>
      <div className="min-w-0 space-y-5">
      <div className="space-y-2">
        <label htmlFor="anunciar-plantao" className="block text-sm font-semibold">1. Plantão que não poderá cumprir</label>
        <Selecao id="anunciar-plantao" value={plantao.id} onChange={setPlantaoId}
          opcoes={anunciaveis.map((p) => {
            const i = new Date(p.inicio).getTime();
            return { value: p.id, label: `${fmtDay(i)} ${fmtTime(i)}–${fmtTime(new Date(p.fim).getTime())} · ${p.especialidade?.nome ?? ""}` };
          })} />
      </div>

      <div className="space-y-2">
        <span className="text-sm font-semibold">2. Urgência (obrigatória)</span>
        <div className="grid grid-cols-2 gap-2">
          {URGENCIAS.map((u) => (
            <button type="button" key={u.id} onClick={() => setUrgencia(u.id)} className={`btn text-sm ${urgencia === u.id ? (u.id === "urgente" ? "btn-danger" : "btn-primary") : "btn-outline"}`}>
              {u.label} · vale {u.prazo}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-semibold">3. Motivo (opcional)</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCategoria(null)} className={`chip ${categoria === null ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Não informar</button>
          {CATEGORIAS.map((c) => (
            <button type="button" key={c.id} onClick={() => setCategoria(c.id)} className={`chip ${categoria === c.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{c.label}</button>
          ))}
        </div>
        {categoria && (
          <>
            <textarea className="field min-h-24" maxLength={TEXTO_MAX} placeholder="Detalhes (opcional)" value={texto} onChange={(e) => setTexto(e.target.value)} />
            <p className="text-right text-xs text-muted-foreground">{texto.length}/{TEXTO_MAX}</p>
          </>
        )}
        <p className="text-xs text-muted-foreground">O motivo só é visto pela gestão do setor, nunca por outros profissionais.</p>
      </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">

      {prazo && (
        <div className="card flex items-center gap-4 p-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Clock className="h-5 w-5" /></div>
          <div>
            <p className="font-bold">Vale até {fmtDateTime(prazo.getTime())}</p>
            <p className="text-sm text-muted-foreground">{cortadoNoInicio ? "Limitado ao início do plantão." : "Se ninguém assumir até lá, o anúncio expira."}</p>
          </div>
        </div>
      )}

      {erro && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{erro}</p>}
      <button className="btn btn-primary w-full" disabled={!urgencia || anunciar.isPending}>{anunciar.isPending ? "Publicando…" : "Publicar anúncio"}</button>
      </aside>
    </form>
  );
}
