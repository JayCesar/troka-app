import { labelCategoria, useAnunciosSetor } from "@/lib/api/anuncios";
import { fmtDateTime, fmtDay, fmtTime } from "@/lib/troka";

// Anúncios em aberto do setor. O motivo aparece aqui porque a RLS libera para o gestor (RN29).
export function AnunciosSetor() {
  const { data, isLoading, error } = useAnunciosSetor();

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Anúncios do setor</h2>
      {isLoading && <p className="card p-5 text-center text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="card p-5 text-center text-sm text-destructive">Erro: {error.message}</p>}
      {data?.length === 0 && <p className="card p-5 text-center text-sm text-muted-foreground">Nenhum anúncio em aberto.</p>}
      {data?.map((a) => {
        const inicio = a.plantao ? new Date(a.plantao.inicio).getTime() : 0;
        return (
          <div key={a.id} className="card space-y-1 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold">{a.plantao?.especialidade?.nome} · {fmtDay(inicio)} {fmtTime(inicio)}</p>
              {a.urgencia === "urgente" && <span className="chip bg-destructive/15 text-destructive">Urgente</span>}
              {a.status === "pendente" && <span className="chip bg-primary/15 text-primary">Assumido por {a.assumido?.nome} · aguardando aprovação</span>}
            </div>
            <p className="text-muted-foreground">Anunciado por {a.anunciante?.nome} · vence {fmtDateTime(new Date(a.expira_em).getTime())}</p>
            <p>
              <span className="font-semibold">Motivo: </span>
              {a.anuncio_motivo ? `${labelCategoria(a.anuncio_motivo.categoria)}${a.anuncio_motivo.texto ? ` — ${a.anuncio_motivo.texto}` : ""}` : <span className="text-muted-foreground">não informado</span>}
            </p>
          </div>
        );
      })}
    </section>
  );
}
