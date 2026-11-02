import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Flame, Lock } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import {
  useAssumirAnuncio,
  useCandidatar,
  useDesistirAnuncio,
  useDesistirCandidatura,
  useMinhasSolicitacoes,
  useOfertas,
  type Oferta,
  type Solicitacao,
} from "@/lib/api/ofertas";
import { fmtDateTime, fmtDay, fmtTime } from "@/lib/troka";

export const Route = createFileRoute("/assumir")({
  head: () => ({
    meta: [
      { title: "Assumir plantão — TroKa" },
      { name: "description", content: "Anúncios e plantões em aberto do seu setor." },
    ],
  }),
  component: () => <AppShell title="Assumir plantão" role="profissional"><Page /></AppShell>,
});

const horario = (inicio: string, fim: string) => {
  const i = new Date(inicio).getTime();
  return `${fmtDay(i)} · ${fmtTime(i)}–${fmtTime(new Date(fim).getTime())}`;
};
const erro = (e: Error) => toast.error(e.message);

function Page() {
  const ofertas = useOfertas();
  const solicitacoes = useMinhasSolicitacoes();

  return (
    <div className="space-y-6">
      {(solicitacoes.data?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Aguardando aprovação</h2>
          {solicitacoes.data!.map((s) => <SolicitacaoCard key={s.id} s={s} />)}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Disponíveis no seu setor</h2>
        {ofertas.isLoading && <p className="card p-6 text-center text-muted-foreground">Carregando…</p>}
        {ofertas.error && <p className="card p-6 text-center text-destructive">Erro: {ofertas.error.message}</p>}
        {ofertas.data?.length === 0 && <p className="card p-6 text-center text-muted-foreground">Nenhum anúncio ou plantão em aberto.</p>}
        {ofertas.data?.map((o) => <OfertaCard key={(o.anuncio_id ?? "") + o.plantao_id} o={o} />)}
      </section>
    </div>
  );
}

function OfertaCard({ o }: { o: Oferta }) {
  const assumir = useAssumirAnuncio();
  const candidatar = useCandidatar();
  const ok = o.motivos.length === 0;
  const pending = assumir.isPending || candidatar.isPending;
  const anuncio = o.tipo === "anuncio";

  const agir = () => {
    // RN19c / RN06c: o banco pode aprovar na hora (lista de confiança)
    if (anuncio)
      assumir.mutate(o.anuncio_id!, {
        onSuccess: (a) => toast.success(a.status === "aprovado" ? "Troca aprovada automaticamente! O plantão é seu." : "Anúncio assumido. Aguardando aprovação da gestão."),
        onError: erro,
      });
    else
      candidatar.mutate(o.plantao_id, {
        onSuccess: (c) => toast.success(c.status === "aprovada" ? "Aprovado automaticamente! O plantão é seu." : "Candidatura enviada à gestão."),
        onError: erro,
      });
  };

  return (
    <div className="card space-y-3 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold">{o.especialidade}</h3>
          <span className={`chip ${anuncio ? "bg-warning/15 text-warning" : "bg-secondary"}`}>{anuncio ? `Troca · ${o.anunciante}` : "Plantão em aberto"}</span>
          {o.urgencia === "urgente" && <span className="chip bg-destructive/15 text-destructive"><Flame className="h-3 w-3" />Urgente</span>}
          {ok && <span className="chip bg-success/15 text-success"><CheckCircle2 className="h-3 w-3" />Você é elegível</span>}
        </div>
        <p className="text-sm font-semibold">{horario(o.inicio, o.fim)}</p>
        {anuncio && o.expira_em && <p className="text-xs text-muted-foreground">Anúncio vale até {fmtDateTime(new Date(o.expira_em).getTime())}</p>}
      </div>
      {!ok && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {o.motivos.map((m) => <p key={m} className="flex items-start gap-2"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />{m}</p>)}
        </div>
      )}
      {o.ja_candidatei ? (
        <p className="text-center text-sm font-semibold text-primary">Candidatura enviada</p>
      ) : (
        <button disabled={!ok || pending} className="btn btn-primary w-full" onClick={agir}>
          {anuncio ? "Assumir plantão" : "Candidatar-me"}
        </button>
      )}
    </div>
  );
}

// RN22b: desistir antes da aprovação
function SolicitacaoCard({ s }: { s: Solicitacao }) {
  const desistirAnuncio = useDesistirAnuncio();
  const desistirCandidatura = useDesistirCandidatura();
  const pending = desistirAnuncio.isPending || desistirCandidatura.isPending;
  const desistir = () => {
    if (!confirm("Desistir desta solicitação?")) return;
    const done = { onSuccess: () => toast("Você desistiu."), onError: erro };
    if (s.tipo === "anuncio") desistirAnuncio.mutate(s.id, done);
    else desistirCandidatura.mutate(s.id, done);
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{s.especialidade}</p>
        <p className="text-sm">{horario(s.inicio, s.fim)}</p>
        <p className="text-xs text-muted-foreground">{s.tipo === "anuncio" ? `Troca com ${s.anunciante}` : "Candidatura a plantão em aberto"}</p>
      </div>
      <button className="btn btn-outline min-h-10 text-sm" disabled={pending} onClick={desistir}>Desistir</button>
    </div>
  );
}
