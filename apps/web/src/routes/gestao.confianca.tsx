import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Info, Search, ShieldCheck, ShieldOff, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { SecaoGestao } from "@/components/gestao/SecaoGestao";
import { useDefinirConfianca, useEquipe, type MembroEquipe } from "@/lib/api/gestao";

export const Route = createFileRoute("/gestao/confianca")({
  head: () => ({ meta: [{ title: "Lista de confiança — TroKa" }] }),
  component: () => (
    <SecaoGestao titulo="Lista de confiança">
      <ListaConfianca />
    </SecaoGestao>
  ),
});

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// RN19b: o gestor marca individualmente quem é de confiança (RPC definir_confianca; o banco valida setor/papel).
// RN19c/RN06c: troca entre dois confiáveis e candidatura de confiável são aprovadas automaticamente,
// com elegibilidade revalidada. Mudanças só valem para solicitações futuras.
function ListaConfianca() {
  const { data, isLoading, error } = useEquipe();
  const definir = useDefinirConfianca();
  const [busca, setBusca] = useState("");
  const [alterando, setAlterando] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    return (data ?? []).filter((m) => !q || normalizar(`${m.nome} ${m.especialidade} ${m.conselho}`).includes(q));
  }, [data, busca]);
  const confiaveis = filtrados.filter((m) => m.confiavel);
  const demais = filtrados.filter((m) => !m.confiavel);
  const total = data?.length ?? 0;
  const naLista = data?.filter((m) => m.confiavel).length ?? 0;

  const alternar = (m: MembroEquipe) => {
    setAlterando(m.id);
    definir.mutate(
      { id: m.id, confiavel: !m.confiavel },
      {
        onSuccess: () => toast.success(m.confiavel ? `${m.nome} saiu da lista de confiança.` : `${m.nome} entrou na lista de confiança.`),
        onError: (err) => toast.error(err.message),
        onSettled: () => setAlterando(null),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid items-center gap-4 rounded-[1.25rem] sm:grid-cols-[auto_minmax(0,1fr)_auto] border border-navy-foreground/10 bg-navy p-5 text-navy-foreground shadow-lg">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-success/20 text-success"><ShieldCheck className="h-6 w-6" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Lista de confiança do setor</h2>
          <p className="text-sm text-navy-foreground/65">Trocas entre dois profissionais da lista e candidaturas de quem está nela são aprovadas automaticamente, se passarem nas regras de elegibilidade (RN19c, RN06c).</p>
        </div>
        <p className="text-sm text-navy-foreground/70"><span className="text-3xl font-bold tabular-nums text-navy-foreground">{isLoading ? "–" : naLista}</span> de {total} na lista</p>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Incluir ou remover alguém só vale para novas solicitações; anúncios e candidaturas em andamento não mudam (RN19c).
      </p>

      <label className="relative block max-w-md">
        <span className="sr-only">Buscar profissional</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input className="field w-full pl-9" placeholder="Buscar por nome, especialidade ou CRM/COREN" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </label>

      {isLoading && <p className="card p-5 text-center text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="card p-5 text-center text-sm text-destructive">Erro: {error.message}</p>}

      {data && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Grupo titulo="Na lista de confiança" vazio={busca ? "Ninguém da lista corresponde à busca." : "Ninguém na lista ainda. Adicione ao lado."} membros={confiaveis} alterando={alterando} onAlternar={alternar} />
          <Grupo titulo="Demais profissionais" vazio={busca ? "Nenhum profissional corresponde à busca." : "Toda a equipe já está na lista."} membros={demais} alterando={alterando} onAlternar={alternar} />
        </div>
      )}
    </div>
  );
}

function Grupo({ titulo, vazio, membros, alterando, onAlternar }: { titulo: string; vazio: string; membros: MembroEquipe[]; alterando: string | null; onAlternar: (m: MembroEquipe) => void }) {
  return (
    <section aria-label={titulo} className="min-w-0 space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {titulo}<span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{membros.length}</span>
      </h3>
      {membros.length === 0 && <p className="card p-5 text-center text-sm text-muted-foreground">{vazio}</p>}
      <ul className="space-y-2">
        {membros.map((m) => (
          <li key={m.id} className={`card flex items-center gap-3 p-3 text-sm transition-opacity ${alterando === m.id ? "opacity-60" : ""}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${m.confiavel ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {m.confiavel ? <ShieldCheck className="h-4 w-4" aria-hidden /> : <ShieldOff className="h-4 w-4" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.nome}</p>
              <p className="truncate text-xs text-muted-foreground">{m.categoria === "medico" ? "Médico" : "Enfermeiro"} · {m.especialidade} · {m.conselho}</p>
            </div>
            <button
              type="button"
              disabled={alterando !== null}
              onClick={() => onAlternar(m)}
              className={`btn min-h-9 shrink-0 px-3 text-xs ${m.confiavel ? "btn-outline" : "btn-primary"}`}
              aria-label={m.confiavel ? `Remover ${m.nome} da lista de confiança` : `Adicionar ${m.nome} à lista de confiança`}
            >
              {m.confiavel ? <><UserMinus className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Remover</span></> : <><UserPlus className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Adicionar</span></>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
