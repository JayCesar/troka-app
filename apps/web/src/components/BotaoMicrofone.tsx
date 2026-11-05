import { useEffect, useRef } from "react";
import { Loader2, Mic, Square } from "lucide-react";

import { fmtDuracao, type EstadoGravacao } from "@/hooks/use-gravacao-audio";

// Botão de voz grande (48px) para toque no celular. Gravando: vermelho com anel pulsante.
export function BotaoMicrofone({
  estado,
  onClick,
  disabled,
}: {
  estado: EstadoGravacao;
  onClick: () => void;
  disabled?: boolean;
}) {
  const gravando = estado === "gravando";
  const processando = estado === "processando";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || processando}
      aria-pressed={gravando}
      aria-label={
        gravando ? "Parar gravação" : processando ? "Processando áudio" : "Gravar mensagem de voz"
      }
      title={gravando ? "Parar gravação" : "Falar em vez de digitar"}
      className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 disabled:opacity-45 ${
        gravando
          ? "bg-destructive text-destructive-foreground hover:brightness-110 focus-visible:ring-destructive/40"
          : "border border-input bg-card text-primary hover:border-primary hover:bg-accent focus-visible:ring-primary/40"
      }`}
    >
      {gravando && (
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full bg-destructive/50"
        />
      )}
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

// Faixa "Gravando… 00:12" mostrada no lugar do campo de texto (chat). O texto ditado quebra linha
// (até ~3 linhas, depois rola e acompanha o fim), em vez de ser cortado no celular.
export function IndicadorGravacao({ segundos, texto }: { segundos: number; texto?: string }) {
  const fimRef = useRef<HTMLSpanElement>(null);
  useEffect(() => fimRef.current?.scrollIntoView({ block: "end" }), [texto]);
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-12 min-w-0 flex-1 flex-col justify-center gap-1 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-destructive"
        />
        <span className="font-semibold text-destructive">Gravando</span>
        <span className="tabular-nums text-destructive">{fmtDuracao(segundos)}</span>
      </div>
      {texto && (
        <p className="max-h-[4.5rem] overflow-y-auto whitespace-pre-wrap break-words leading-snug text-foreground/80">
          {texto}
          <span ref={fimRef} />
        </p>
      )}
    </div>
  );
}
