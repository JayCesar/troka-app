import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { useEspecialidades } from "@/lib/api/plantoes";
import { cadastrarProfissional, type Categoria, type NovoProfissional } from "@/lib/services/cadastroProfissional";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const STATUS_VALIDACAO: Record<string, string> = {
  verificado: "conselho verificado",
  simulado: "validação simulada",
  nao_verificado: "modo teste: conselho NÃO verificado",
};

// RN01/RN01b: criação (C do CRUD). A chamada à API fica isolada em lib/services/cadastroProfissional.ts.
function useCadastrar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cadastrarProfissional,
    onSuccess: () => {
      for (const k of ["equipe", "historico"]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export function CadastroProfissional() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className="btn btn-outline w-full" onClick={() => setAberto(true)}><UserPlus className="h-4 w-4" aria-hidden />Cadastrar profissional</button>
      {aberto && <Formulario onClose={() => setAberto(false)} />}
    </>
  );
}

const VAZIO: NovoProfissional = { nome: "", email: "", categoria: "medico", especialidade_id: "", conselho_numero: "", conselho_uf: "SP" };

function Campo({ id, label, dica, children }: { id: string; label: string; dica?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {dica && <p id={`${id}-dica`} className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  );
}

function Formulario({ onClose }: { onClose: () => void }) {
  const especialidades = useEspecialidades();
  const cadastrar = useCadastrar();
  const [f, setF] = useState<NovoProfissional>(VAZIO);
  const [erro, setErro] = useState("");
  const daCategoria = (especialidades.data ?? []).filter((e) => e.categoria === f.categoria);
  const conselho = f.categoria === "medico" ? "CRM" : "COREN";
  const faltando = !f.nome.trim() || f.nome.trim().length < 3 ? "Informe o nome completo."
    : !f.email.includes("@") ? "Informe um e-mail válido."
    : !f.especialidade_id ? "Escolha a especialidade."
    : f.conselho_numero.replace(/\D/g, "").length < 3 ? `Informe o número do ${conselho}.`
    : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (faltando) return setErro(faltando);
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/60 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="cadastro-titulo"
      onKeyDown={(e) => e.key === "Escape" && onClose()}>
      {/* Celular: tela cheia com botão fixo embaixo. Desktop: janela central. */}
      <form className="flex h-[100dvh] w-full flex-col bg-background sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-3xl" onSubmit={submit} noValidate>
        <div className="flex items-center justify-between border-b p-4">
          <h2 id="cadastro-titulo" className="text-xl font-bold">Cadastrar profissional</h2>
          <button type="button" onClick={onClose} aria-label="Fechar cadastro" className="grid h-11 w-11 place-items-center rounded-full hover:bg-accent"><X aria-hidden /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-sm text-muted-foreground">Entra no seu setor. O registro no conselho é validado antes de concluir (RN01b) e a pessoa recebe um convite por e-mail para criar a senha.</p>

          <Campo id="cad-nome" label="Nome completo">
            <input id="cad-nome" className="field" autoComplete="name" autoFocus value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          </Campo>
          <Campo id="cad-email" label="E-mail" dica="O convite de acesso chega neste e-mail.">
            <input id="cad-email" className="field" type="email" inputMode="email" autoComplete="email" aria-describedby="cad-email-dica"
              value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Campo>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-semibold">Categoria</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["medico", "enfermeiro"] as Categoria[]).map((c) => (
                <label key={c} className={`btn cursor-pointer text-sm ${f.categoria === c ? "btn-primary" : "btn-outline"}`}>
                  <input type="radio" name="cad-categoria" value={c} className="sr-only" checked={f.categoria === c}
                    onChange={() => setF({ ...f, categoria: c, especialidade_id: "" })} />
                  {c === "medico" ? "Médico(a)" : "Enfermeiro(a)"}
                </label>
              ))}
            </div>
          </fieldset>

          <Campo id="cad-esp" label="Especialidade">
            <select id="cad-esp" className="field" value={f.especialidade_id} onChange={(e) => setF({ ...f, especialidade_id: e.target.value })}>
              <option value="">Selecione…</option>
              {daCategoria.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Campo>

          <div className="grid grid-cols-[1fr_6.5rem] gap-2">
            <Campo id="cad-conselho" label={`Nº do ${conselho}`}>
              <input id="cad-conselho" className="field" inputMode="numeric" value={f.conselho_numero} onChange={(e) => setF({ ...f, conselho_numero: e.target.value })} />
            </Campo>
            <Campo id="cad-uf" label="UF">
              <select id="cad-uf" className="field" value={f.conselho_uf} onChange={(e) => setF({ ...f, conselho_uf: e.target.value })}>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Campo>
          </div>

          <div aria-live="polite">{erro && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{erro}</p>}</div>
        </div>

        <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="submit" disabled={cadastrar.isPending} className="btn btn-primary min-h-12 w-full text-base">
            {cadastrar.isPending ? "Validando e cadastrando…" : "Cadastrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
