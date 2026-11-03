import { BedDouble, CheckCheck, Clock4, Coins, GraduationCap, Hospital, ShieldCheck, Undo2, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { useAssistente } from "@/components/AssistenteIA";
import { moverHolofote } from "@/components/inicio/efeitos";

// Resumo das regras que mais afetam o dia a dia (texto fiel a docs/aidlc/regras-de-negocio.md).
// Clicar pergunta ao assistente sobre a regra.
const REGRAS: { rn: string; titulo: string; texto: string; icon: LucideIcon; pergunta: string }[] = [
  { rn: "RN14", titulo: "Descanso mínimo de 11h", texto: "Sem sobreposição e com 11h de descanso entre plantões, contando trocas anteriores.", icon: BedDouble, pergunta: "Como funciona o descanso mínimo de 11 horas (RN14)?" },
  { rn: "RN13", titulo: "Especialidade idêntica", texto: "Só assume quem tem exatamente a especialidade exigida pelo plantão.", icon: GraduationCap, pergunta: "Quais especialidades podem assumir um plantão (RN13)?" },
  { rn: "RN12", titulo: "Mesmo hospital e setor", texto: "Trocas acontecem só entre profissionais do mesmo hospital e setor.", icon: Hospital, pergunta: "Posso trocar plantão com outro setor (RN12)?" },
  { rn: "RN10", titulo: "Prazo do anúncio", texto: "24h se urgente, 48h se normal — nunca depois do início do plantão.", icon: Clock4, pergunta: "Quanto tempo meu anúncio fica aberto (RN10)?" },
  { rn: "RN19c", titulo: "Aprovação automática", texto: "Entre dois profissionais da lista de confiança, a troca é aprovada sozinha.", icon: ShieldCheck, pergunta: "Quando uma troca é aprovada automaticamente (RN19c)?" },
  { rn: "RN20", titulo: "Muda só após aprovação", texto: "O plantão só troca de dono depois da aprovação da gestão (ou automática).", icon: CheckCheck, pergunta: "Quando o plantão muda de dono (RN20)?" },
  { rn: "RN22", titulo: "Cancelar anúncio", texto: "Quem anunciou pode cancelar a qualquer momento antes da aprovação.", icon: Undo2, pergunta: "Posso cancelar um anúncio (RN22)?" },
  { rn: "RN17", titulo: "Adicional da gestão", texto: "Só a gestão oferece adicional, e ele aparece antes de você assumir.", icon: Coins, pergunta: "Como funciona o adicional em um plantão (RN17/RN18)?" },
];

export function Regras() {
  const { abrir } = useAssistente();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {REGRAS.map((r, i) => (
        <button
          key={r.rn}
          type="button"
          onClick={() => abrir(r.pergunta)}
          onMouseMove={moverHolofote}
          style={{ "--atraso": `${i * 60}ms` } as CSSProperties}
          className="entrar holofote card group flex flex-col gap-3 p-4 text-left transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="flex items-center justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
              <r.icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="chip bg-muted text-muted-foreground">{r.rn}</span>
          </span>
          <span>
            <span className="block font-semibold">{r.titulo}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{r.texto}</span>
          </span>
          <span className="mt-auto text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Perguntar ao assistente →</span>
        </button>
      ))}
    </div>
  );
}
