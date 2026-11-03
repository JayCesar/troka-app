import { Loader2, Mic, Square } from "lucide-react";

import { fmtDuracao, type EstadoGravacao } from "@/hooks/use-gravacao-audio";

// Botão de voz grande (48px) para toque no celular. Gravando: vermelho com anel pulsante.
export function BotaoMicrofone({ estado, onClick, disabled }: { estado: EstadoGravacao; onClick: () => void; disabled?: boolean }) {
  const gravando = estado === "gravando";
  const processando = estado === "processando";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || processando}
      aria-pressed={gravando}
      aria-label={gravando ? "Parar gravação" : processando ? "Processando áudio" : "Gravar mensagem de voz"}
      title={gravando ? "Parar gravação" : "Falar em vez de digitar"}
      className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 disabled:opacity-45 ${
        gravando
          ? "bg-destructive text-destructive-foreground hover:brightness-110 focus-visible:ring-destructive/40"
          : "border border-input bg-card text-primary hover:border-primary hover:bg-accent focus-visible:ring-primary/40"
      }`}
    >
      {gravando && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-destructive/50" />}
      {processando ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      ) : gravando ? (
        <Square className="relative h-4 w-4 fill-current" aria-hidden />
      ) : (
        <Mic className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}

// Faixa "Gravando… 00:12" mostrada no lugar do campo de texto.
export function IndicadorGravacao({ segundos, texto }: { segundos: number; texto?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-12 flex-1 items-center gap-2 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 px-3 text-sm">
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-destructive" />
      <span className="font-semibold text-destructive">Gravando</span>
      <span className="tabular-nums text-destructive">{fmtDuracao(segundos)}</span>
      {texto && <span className="min-w-0 flex-1 truncate text-muted-foreground">{texto}</span>}
    </div>
  );
}
