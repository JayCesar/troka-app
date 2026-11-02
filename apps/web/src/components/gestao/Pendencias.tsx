import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useDecidir, usePendencias, type Pendencia } from "@/lib/api/gestao";
import { fmtDay, fmtTime } from "@/lib/troka";
import { fmtBRL } from "@/lib/format";

// RN19/RN21: o gestor do setor aprova ou recusa com um clique; o banco revalida tudo (RN16)
export function Pendencias() {
  const { data, isLoading, error } = usePendencias();
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Aguardando aprovação</h2>
      {isLoading && <p className="card p-5 text-center text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="card p-5 text-center text-sm text-destructive">Erro: {error.message}</p>}
      {data?.length === 0 && <p className="card p-5 text-center text-sm text-muted-foreground">Nenhuma troca ou candidatura pendente.</p>}
      {data?.map((p) => <PendenciaCard key={p.tipo + p.id} p={p} />)}
    </section>
  );
}

function PendenciaCard({ p }: { p: Pendencia }) {
  const decidir = useDecidir();
  const inicio = new Date(p.inicio).getTime();
  const acao = (aprovar: boolean) =>
    decidir.mutate(
      { p, aprovar },
      { onSuccess: () => toast.success(aprovar ? "Aprovado." : "Recusado."), onError: (e) => toast.error(e.message) },
    );
  return (
    <div className="card space-y-3 p-4">
      <div className="text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold">{p.especialidade} · {fmtDay(inicio)} {fmtTime(inicio)}–{fmtTime(new Date(p.fim).getTime())}</p>
          {p.urgencia === "urgente" && <span className="chip bg-destructive/15 text-destructive">Urgente</span>}
          {p.adicional && <span className="chip bg-accent text-accent-foreground">Adicional {fmtBRL(p.adicional)}</span>}
        </div>
        {p.tipo === "troca" ? (
          <p className="text-muted-foreground">{p.anunciante} → <span className="font-semibold text-foreground">{p.solicitante}</span></p>
        ) : (
          <p className="text-muted-foreground">Candidatura de <span className="font-semibold text-foreground">{p.solicitante}</span> (plantão em aberto)</p>
        )}
      </div>
      {p.motivos.length > 0 && (
        <div className="rounded-lg bg-warning/15 p-3 text-sm text-warning">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Não passa mais nas regras (RN16):</p>
          {p.motivos.map((m) => <p key={m}>{m}</p>)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-danger" disabled={decidir.isPending} onClick={() => acao(false)}>Recusar</button>
        <button className="btn btn-primary" disabled={decidir.isPending || p.motivos.length > 0} onClick={() => acao(true)}>Aprovar</button>
      </div>
    </div>
  );
}
