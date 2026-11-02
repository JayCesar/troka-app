import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useEspecialidades } from "@/lib/api/plantoes";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
type Categoria = "medico" | "enfermeiro";

const STATUS_VALIDACAO: Record<string, string> = {
  verificado: "conselho verificado",
  simulado: "validação simulada",
  nao_verificado: "modo teste: conselho NÃO verificado",
};

// RN01/RN01b: o gestor cadastra no próprio setor; a Edge Function valida o conselho e envia o convite.
function useCadastrar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, string>) => {
      const { data, error } = await supabase.functions.invoke("cadastrar-profissional", { body });
      if (error) {
        // A função devolve { error: "mensagem da regra" } com status 4xx
        const ctx = (error as { context?: Response }).context;
        const msg = ctx ? ((await ctx.json().catch(() => null)) as { error?: string } | null)?.error : null;
        throw new Error(msg ?? error.message);
      }
      return data as { validacao: string; modo: string };
    },
    onSuccess: () => {
      for (const k of ["equipe", "historico"]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export function CadastroProfissional() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className="btn btn-outline w-full" onClick={() => setAberto(true)}><UserPlus className="h-4 w-4" />Cadastrar profissional</button>
      {aberto && <Formulario onClose={() => setAberto(false)} />}
    </>
  );
}

function Formulario({ onClose }: { onClose: () => void }) {
  const especialidades = useEspecialidades();
  const cadastrar = useCadastrar();
  const [f, setF] = useState({ nome: "", email: "", categoria: "medico" as Categoria, especialidade_id: "", conselho_numero: "", conselho_uf: "SP" });
  const [erro, setErro] = useState("");
  const daCategoria = (especialidades.data ?? []).filter((e) => e.categoria === f.categoria);
  const conselho = f.categoria === "medico" ? "CRM" : "COREN";
  const valid = f.nome.trim().length >= 3 && f.email.includes("@") && f.especialidade_id && f.conselho_numero.replace(/\D/g, "").length >= 3;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setErro("");
    cadastrar.mutate(f, {
      onSuccess: (r) => {
        toast.success(`Cadastrado (${STATUS_VALIDACAO[r.validacao] ?? r.validacao}). Convite enviado para ${f.email}.`);
        onClose();
      },
      onError: (err) => setErro(err.message),
    });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-navy/60 sm:items-center">
      <form className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto rounded-t-3xl bg-background p-6 sm:rounded-3xl" onSubmit={submit}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Cadastrar profissional</h2>
          <button type="button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <p className="text-xs text-muted-foreground">Entra no seu setor. O registro no conselho é validado antes de concluir (RN01b) e a pessoa recebe um convite por e-mail para criar a senha.</p>
        <input className="field" placeholder="Nome completo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        <input className="field" type="email" placeholder="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          {(["medico", "enfermeiro"] as const).map((c) => (
            <button type="button" key={c} onClick={() => setF({ ...f, categoria: c, especialidade_id: "" })}
              className={`btn text-sm ${f.categoria === c ? "btn-primary" : "btn-outline"}`}>{c === "medico" ? "Médico(a)" : "Enfermeiro(a)"}</button>
          ))}
        </div>
        <select className="field" value={f.especialidade_id} onChange={(e) => setF({ ...f, especialidade_id: e.target.value })}>
          <option value="">Especialidade…</option>
          {daCategoria.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <input className="field" inputMode="numeric" placeholder={`Nº do ${conselho}`} value={f.conselho_numero} onChange={(e) => setF({ ...f, conselho_numero: e.target.value })} />
          <select className="field" value={f.conselho_uf} onChange={(e) => setF({ ...f, conselho_uf: e.target.value })} aria-label={`UF do ${conselho}`}>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        {erro && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{erro}</p>}
        <button disabled={!valid || cadastrar.isPending} className="btn btn-primary w-full">{cadastrar.isPending ? "Validando e cadastrando…" : "Cadastrar"}</button>
      </form>
    </div>
  );
}
