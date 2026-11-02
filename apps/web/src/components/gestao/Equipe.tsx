import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useDefinirConfianca, useEquipe } from "@/lib/api/gestao";

// RN19b: o gestor marca quem é da lista de confiança. Troca entre dois confiáveis e candidatura de confiável
// são aprovadas automaticamente (RN19c, RN06c) — só para solicitações futuras.
export function Equipe() {
  const { data, isLoading } = useEquipe();
  const definir = useDefinirConfianca();
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Equipe do setor</h2>
        <p className="text-xs text-muted-foreground">Lista de confiança: trocas entre dois confiáveis e candidaturas de confiáveis são aprovadas automaticamente. Vale só para novas solicitações.</p>
      </div>
      {isLoading && <p className="card p-5 text-center text-sm text-muted-foreground">Carregando…</p>}
      <ul className="card divide-y">
        {data?.map((m) => (
          <li key={m.id} className="flex items-center gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{m.nome}</p>
              <p className="text-xs text-muted-foreground">{m.categoria === "medico" ? "Médico" : "Enfermeiro"} · {m.especialidade} · {m.conselho}</p>
              {m.conselho_validacao === "nao_verificado" && <span className="chip mt-1 bg-warning/15 text-warning">Conselho não verificado (modo teste)</span>}
              {m.conselho_validacao === "simulado" && <span className="chip mt-1 bg-secondary">Validação simulada</span>}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <ShieldCheck className={`h-4 w-4 ${m.confiavel ? "text-success" : "text-muted-foreground"}`} />
              Confiança
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--color-primary)]"
                checked={m.confiavel}
                disabled={definir.isPending}
                onChange={(e) => definir.mutate({ id: m.id, confiavel: e.target.checked }, { onError: (err) => toast.error(err.message) })}
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
