import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Palette } from "lucide-react";

import { useTemaAtivo } from "@/lib/tema";

// Fundo só da área de mensagens do chat (não muda o tema do site). Preferência local por navegador.
export type FundoId = "padrao" | "aurora" | "troka" | "pontos" | "menta" | "noite";
export const FUNDOS: { id: FundoId; label: string; style: CSSProperties; escuro?: boolean }[] = [
  { id: "padrao", label: "Padrão", style: {} },
  {
    // Mesmo visual da prévia do Início: navy com brilhos verde-água da marca
    id: "aurora",
    label: "Aurora TroKa",
    escuro: true,
    style: {
      background:
        "radial-gradient(circle at 90% 5%, color-mix(in oklab, #14A9A0 38%, transparent), transparent 42%), radial-gradient(circle at 5% 95%, color-mix(in oklab, #14A9A0 22%, transparent), transparent 48%), radial-gradient(circle at 50% 55%, color-mix(in oklab, #14A9A0 8%, transparent), transparent 60%), linear-gradient(165deg, #031334 0%, #061d3d 55%, #0a2b45 100%)",
    },
  },
  {
    id: "troka",
    label: "Gradiente TroKa",
    style: {
      background:
        "radial-gradient(circle at 15% 0%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 55%), radial-gradient(circle at 100% 100%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 50%), var(--background)",
    },
  },
  {
    id: "pontos",
    label: "Pontilhado",
    style: { backgroundColor: "var(--background)", backgroundImage: "radial-gradient(color-mix(in oklab, var(--foreground) 14%, transparent) 1px, transparent 1px)", backgroundSize: "16px 16px" },
  },
  { id: "menta", label: "Menta", style: { background: "color-mix(in oklab, var(--primary) 9%, var(--background))" } },
  { id: "noite", label: "Noite", style: { background: "linear-gradient(160deg, #031334 0%, #0a2647 60%, #0e3a4f 100%)" }, escuro: true },
];

const CHAVE = "troka.chat.fundo";
const ler = (): FundoId => {
  try {
    const v = localStorage.getItem(CHAVE);
    return FUNDOS.some((f) => f.id === v) ? (v as FundoId) : "padrao";
  } catch {
    return "padrao";
  }
};

export function useFundoChat() {
  const [id, setId] = useState<FundoId>(ler);
  const escolher = (novo: FundoId) => {
    setId(novo);
    try { localStorage.setItem(CHAVE, novo); } catch { /* sem storage: vale só nesta sessão */ }
  };
  // No tema Aurora, o fundo "Padrão" do chat acompanha o site (Aurora); outra escolha explícita prevalece.
  const tema = useTemaAtivo();
  const efetivo = id === "padrao" && tema === "aurora" ? "aurora" : id;
  return { fundo: FUNDOS.find((f) => f.id === efetivo)!, escolher };
}

export function SeletorFundoChat({ atual, onEscolher, className = "" }: { atual: FundoId; onEscolher: (id: FundoId) => void; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setAberto(false); } };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc, true); };
  }, [aberto]);

  return (
    <div ref={ref} className={className}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label="Trocar fundo da conversa"
        title="Fundo da conversa"
        className="acao-chat grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Palette className="h-4 w-4" aria-hidden />
      </button>
      {aberto && (
        <div role="menu" aria-label="Fundo da conversa" className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl">
          {FUNDOS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="menuitemradio"
              aria-checked={atual === f.id}
              onClick={() => { onEscolher(f.id); setAberto(false); }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            >
              <span className="h-6 w-6 shrink-0 rounded-md border bg-background" style={f.style} aria-hidden />
              <span className="flex-1">{f.label}</span>
              {atual === f.id && <Check className="h-4 w-4 text-primary" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
