import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useAlertas, useResolverAlerta } from "@/lib/api/gestao";
import { fmtDateTime, fmtDay, fmtTime } from "@/lib/format";

// RN24: anúncio expirado sem cobertura gera alerta de plantão em risco.
// Resolve sozinho quando o plantão muda de dono (ex.: gestor reatribui em "Plantões do setor").
export function Alertas() {
  const { data } = useAlertas();
  const resolver = useResolverAlerta();
  if (!data?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold text-warning"><AlertTriangle className="h-5 w-5" />Plantões em risco</h2>
      <div className="grade-cards">
      {data.map((a) => {
        const inicio = a.plantao ? new Date(a.plantao.inicio).getTime() : 0;
        return (
          <div key={a.id} className="card space-y-2 border-warning/40 p-4 text-sm">
            <p className="font-bold">{a.plantao?.especialidade?.nome} · {fmtDay(inicio)} {fmtTime(inicio)}</p>
            <p className="text-muted-foreground">Anúncio de {a.plantao?.profissional?.nome} expirou sem cobertura ({fmtDateTime(new Date(a.criado_em).getTime())}).</p>
            <p className="text-xs text-muted-foreground">Reatribua o plantão em "Plantões do setor" ou marque como resolvido.</p>
            <button className="btn btn-outline min-h-10 w-full text-sm" disabled={resolver.isPending}
              onClick={() => resolver.mutate(a.id, { onSuccess: () => toast.success("Alerta resolvido."), onError: (e) => toast.error(e.message) })}>
              Marcar como resolvido
            </button>
          </div>
        );
      })}
      </div>
    </section>
  );
}
