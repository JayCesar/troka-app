import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Selecao } from "@/components/Selecao";
import { useEditarProfissional, type MembroEquipe } from "@/lib/api/gestao";
import { useEspecialidades } from "@/lib/api/plantoes";

// M4: gestor corrige nome e especialidade de um profissional do setor. Regras no banco (editar_profissional):
// setor do gestor (RN03), especialidade da mesma categoria (RN01) e sem compromissos na especialidade antiga (RN13).
// Categoria e CRM/COREN não mudam aqui: exigiriam nova validação do conselho (RN01b).
export function EditarProfissional({ membro, onClose }: { membro: MembroEquipe | null; onClose: () => void }) {
  const especialidades = useEspecialidades();
  const editar = useEditarProfissional();
  const [nome, setNome] = useState("");
  const [especialidadeId, setEspecialidadeId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const daCategoria = (especialidades.data ?? []).filter((e) => e.categoria === membro?.categoria);
  useEffect(() => {
    if (!membro) return;
    setNome(membro.nome);
    setEspecialidadeId(daCategoria.find((e) => e.nome === membro.especialidade)?.id ?? "");
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preenche ao abrir (ou quando as especialidades chegam)
  }, [membro?.id, especialidades.data]);

  const salvar = (e: FormEvent) => {
    e.preventDefault();
    if (!membro) return;
    setErro(null);
    editar.mutate(
      { id: membro.id, nome: nome.trim(), especialidadeId },
      { onSuccess: () => { toast.success("Profissional atualizado."); onClose(); }, onError: (err) => setErro(err.message) },
    );
  };
  const semMudanca = !!membro && nome.trim() === membro.nome && daCategoria.find((x) => x.id === especialidadeId)?.nome === membro.especialidade;

  return (
    <Dialog open={!!membro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar profissional</DialogTitle>
          <DialogDescription>
            {membro ? `${membro.categoria === "medico" ? "Médico(a)" : "Enfermeiro(a)"} · ${membro.conselho}` : ""}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={salvar} noValidate>
          <div className="space-y-1.5">
            <label htmlFor="edit-nome" className="text-sm font-semibold">Nome completo</label>
            <input id="edit-nome" className="field" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-esp" className="text-sm font-semibold">Especialidade</label>
            <Selecao id="edit-esp" value={especialidadeId} onChange={setEspecialidadeId} vazio="Selecione…"
              opcoes={daCategoria.map((x) => ({ value: x.id, label: x.nome }))} />
            <p className="text-xs text-muted-foreground">Trocar a especialidade só é possível sem plantões futuros, candidaturas ou trocas em andamento (RN13).</p>
          </div>
          <p className="text-xs text-muted-foreground">Categoria e CRM/COREN não são editáveis aqui, porque exigem nova validação do conselho (RN01b).</p>
          <div aria-live="polite">{erro && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{erro}</p>}</div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={editar.isPending || semMudanca || nome.trim().length < 3 || !especialidadeId}>
              {editar.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
