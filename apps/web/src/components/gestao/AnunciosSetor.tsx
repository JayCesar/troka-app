import { useState } from "react";
import { Coins } from "lucide-react";
import { toast } from "sonner";

import { labelCategoria, useAnunciosSetor, useDefinirAdicional } from "@/lib/api/anuncios";
import { fmtBRL } from "@/lib/format";
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
      {[...(data ?? [])].sort((x, y) => Number(y.urgencia === "urgente") - Number(x.urgencia === "urgente")).map((a) => {
        const inicio = a.plantao ? new Date(a.plantao.inicio).getTime() : 0;
        return (
          <div key={a.id} className="card space-y-1 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold">{a.plantao?.especialidade?.nome} · {fmtDay(inicio)} {fmtTime(inicio)}</p>
              {a.urgencia === "urgente" && <span className="chip bg-destructive/15 text-destructive">Urgente</span>}
              {new Date(a.expira_em).getTime() - Date.now() <= 6 * 3_600_000 && (
                <span className="chip bg-warning/15 text-warning">Vence em {Math.max(1, Math.round((new Date(a.expira_em).getTime() - Date.now()) / 3_600_000))}h</span>
              )}
              {a.status === "pendente" && <span className="chip bg-primary/15 text-primary">Assumido por {a.assumido?.nome} · aguardando aprovação</span>}
            </div>
            <p className="text-muted-foreground">Anunciado por {a.anunciante?.nome} · vence {fmtDateTime(new Date(a.expira_em).getTime())}</p>
            <AdicionalEditor id={a.id} valor={a.adicional_valor} />
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

// RN17/RN17b: valor fixo em reais, opcional, definido pelo gestor enquanto o anúncio está aberto
function AdicionalEditor({ id, valor }: { id: string; valor: number | null }) {
  const definir = useDefinirAdicional();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor ? String(valor).replace(".", ",") : "");

  const salvar = (v: number | null) =>
    definir.mutate(
      { id, valor: v },
      { onSuccess: () => { setEditando(false); toast.success(v ? `Adicional de ${fmtBRL(v)} oferecido.` : "Adicional removido."); }, onError: (e) => toast.error(e.message) },
    );

  if (!editando) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Coins className="h-4 w-4 text-muted-foreground" />
        <span>{valor ? <>Adicional <b>{fmtBRL(valor)}</b></> : <span className="text-muted-foreground">Sem adicional</span>}</span>
        <button className="ml-auto text-xs font-semibold text-primary" onClick={() => setEditando(true)}>{valor ? "Alterar" : "Oferecer adicional"}</button>
      </div>
    );
  }
  const numero = Number(texto.replace(/\./g, "").replace(",", "."));
  return (
    <form className="flex items-center gap-2 py-1" onSubmit={(e) => { e.preventDefault(); if (numero > 0) salvar(numero); }}>
      <span className="text-sm font-semibold">R$</span>
      <input className="field min-h-10 flex-1" inputMode="decimal" placeholder="0,00" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} />
      <button className="btn btn-primary min-h-10 text-sm" disabled={!(numero > 0) || definir.isPending}>Salvar</button>
      {valor && <button type="button" className="btn btn-outline min-h-10 text-sm" disabled={definir.isPending} onClick={() => salvar(null)}>Remover</button>}
      <button type="button" className="text-xs text-muted-foreground" onClick={() => setEditando(false)}>Cancelar</button>
    </form>
  );
}
