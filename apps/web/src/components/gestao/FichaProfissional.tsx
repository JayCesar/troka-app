import { BadgeCheck, CalendarClock, Clock, ShieldAlert, Star } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEquipe } from "@/lib/api/gestao";
import { anuncioAtivo, type Plantao } from "@/lib/api/plantoes";
import { fmtTime } from "@/lib/format";

const CATEGORIA = { medico: "Médico(a)", enfermeiro: "Enfermeiro(a)" } as const;
const VALIDACAO = { verificado: "Conselho verificado", simulado: "Validação simulada", nao_verificado: "Conselho não verificado" } as const;
const fmtDia = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const iniciais = (nome: string) => nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

// Ficha do profissional para o gestor (calendário). Dados via equipe_do_setor + plantões já carregados;
// a RLS (RN03/RN30) garante que só aparecem perfis do próprio setor.
export function FichaProfissional({ profissionalId, plantoes, onClose }: { profissionalId: string | null; plantoes: Plantao[]; onClose: () => void }) {
  const equipe = useEquipe();
  const membro = equipe.data?.find((m) => m.id === profissionalId);
  const agora = Date.now();
  const proximos = plantoes
    .filter((p) => p.profissional_id === profissionalId && new Date(p.fim).getTime() > agora)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const horas = proximos.reduce((h, p) => h + (new Date(p.fim).getTime() - new Date(p.inicio).getTime()) / 3_600_000, 0);
  const nome = membro?.nome ?? plantoes.find((p) => p.profissional_id === profissionalId)?.profissional?.nome ?? "Profissional";

  return (
    <Dialog open={!!profissionalId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 text-base font-bold text-primary">{iniciais(nome)}</span>
            <div className="min-w-0 text-left">
              <DialogTitle className="truncate">{nome}</DialogTitle>
              <DialogDescription>
                {membro ? `${CATEGORIA[membro.categoria]} · ${membro.especialidade}` : equipe.isLoading ? "Carregando…" : "Dados do perfil indisponíveis."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {membro && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="chip bg-secondary">{membro.conselho}</span>
            {membro.conselho_validacao && (
              <span className={`chip ${membro.conselho_validacao === "nao_verificado" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
                {membro.conselho_validacao === "nao_verificado" ? <ShieldAlert className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                {VALIDACAO[membro.conselho_validacao]}
              </span>
            )}
            {membro.confiavel && <span className="chip bg-warning/10 text-warning"><Star className="h-3.5 w-3.5" />Confiável</span>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />Próximos plantões</p>
            <p className="text-2xl font-bold">{proximos.length}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />Horas agendadas</p>
            <p className="text-2xl font-bold">{Math.round(horas)}h</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agenda no setor</p>
          {proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum plantão futuro.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-auto">
              {proximos.map((p) => {
                const anuncio = anuncioAtivo(p);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className="capitalize">{fmtDia(new Date(p.inicio))} · {fmtTime(new Date(p.inicio).getTime())}–{fmtTime(new Date(p.fim).getTime())}</span>
                    {anuncio && <span className="text-xs font-semibold text-warning">{anuncio.status === "pendente" ? "Troca pendente" : "Anunciado"}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
