import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { unwrap } from "@/lib/api/plantoes";

interface PainelDados {
  em_aberto: number;
  urgentes: number;
  a_vencer: number;
  alertas: number;
  pendencias: number;
}

// RN28: plantões em aberto, anúncios urgentes, a vencer (≤ 6h, B9/P1) e alertas — contados no banco
export function Painel() {
  const { data } = useQuery({
    queryKey: ["painel"],
    refetchInterval: 60_000,
    queryFn: async () => (unwrap(await supabase.rpc("painel_do_setor")) as unknown as PainelDados[])[0] ?? null,
  });
  const tiles: [string, number | undefined, string][] = [
    ["Em aberto", data?.em_aberto, "text-primary"],
    ["Urgentes", data?.urgentes, "text-destructive"],
    ["A vencer (6h)", data?.a_vencer, "text-warning"],
    ["Alertas", data?.alertas, "text-warning"],
    ["Pendências", data?.pendencias, "text-primary"],
  ];
  return (
    <section className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {tiles.map(([label, valor, cor]) => (
        <div key={label} className="card p-3">
          <p className={`text-3xl font-bold tabular-nums ${valor ? cor : "text-muted-foreground"}`}>{valor ?? "–"}</p>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      ))}
    </section>
  );
}
