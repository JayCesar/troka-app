import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Send, Square } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { fmtDuracao, useGravacaoAudio } from "@/hooks/use-gravacao-audio";
import { useIsMobile } from "@/hooks/use-mobile";
import { transcreverAudio } from "@/lib/services/assistente";
import type { ProgressoTranscricao } from "@/lib/transcricao";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onEnviar: (texto: string) => void;
}

// Pergunta por voz em tela própria: mostra o texto inteiro enquanto a pessoa fala (no celular a faixa
// inline cortava) e deixa corrigir antes de enviar. Celular: gaveta de baixo; desktop: modal central.
export function ModalVoz({ aberto, onFechar, onEnviar }: Props) {
  const mobile = useIsMobile();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<ProgressoTranscricao | null>(null);
  const descartar = useRef(false); // fechou/cancelou: ignora o que ainda chegar do reconhecedor
  const iniciou = useRef(false); // evita iniciar duas vezes (StrictMode roda efeitos 2x no dev)
  const fimRef = useRef<HTMLDivElement>(null);

  const voz = useGravacaoAudio({
    onTexto: (t) => !descartar.current && setTexto(t),
    onAudio: async (audio) => {
      if (descartar.current) return;
      try {
        setTexto(await transcreverAudio(audio, setProgresso));
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setProgresso(null);
      }
    },
    onErro: setErro,
  });

  // Abriu: limpa e já começa a gravar (o toque no microfone é o gesto que libera o áudio)
  useEffect(() => {
    if (!aberto) {
      iniciou.current = false;
      return;
    }
    if (iniciou.current) return;
    iniciou.current = true;
    descartar.current = false;
    setTexto("");
    setErro(null);
    voz.alternar();
  }, [aberto, voz]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" }); // bloco: no Chrome novo scrollIntoView devolve Promise, e o React a trataria como cleanup
  }, [texto]);

  const fechar = () => {
    descartar.current = true;
    if (voz.gravando) voz.parar();
    onFechar();
  };

  const gravarDeNovo = () => {
    setTexto("");
    setErro(null);
    voz.alternar();
  };

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    descartar.current = true;
    if (voz.gravando) voz.parar();
    onEnviar(t);
  };

  const titulo = voz.gravando
    ? "Ouvindo…"
    : voz.estado === "processando"
      ? "Transcrevendo…"
      : "Revise sua pergunta";
  const descricao = voz.gravando
    ? "Fale sua pergunta. Toque em parar quando terminar."
    : "Corrija o texto se precisar e envie ao assistente.";

  const corpo = (
    <div className="flex flex-col gap-4 p-1">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full ${voz.gravando ? "bg-destructive text-destructive-foreground" : "bg-primary/15 text-primary"}`}
        >
          {voz.gravando && (
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />
          )}
          <Mic className="relative h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{titulo}</p>
          {voz.gravando && (
            <p className="tabular-nums text-sm text-destructive">{fmtDuracao(voz.segundos)}</p>
          )}
        </div>
      </div>

      {voz.gravando || voz.estado === "processando" ? (
        <div
          role="status"
          aria-live="polite"
          className="max-h-[40vh] min-h-28 overflow-y-auto whitespace-pre-wrap break-words rounded-[var(--radius)] border bg-muted/40 p-3 text-base leading-relaxed"
        >
          {texto ||
            (progresso?.fase === "baixando" ? (
              <span className="block space-y-2 text-muted-foreground">
                <span className="block">
                  Preparando a transcrição no seu aparelho (só na primeira vez)…{" "}
                  {progresso.percentual}%
                </span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-full bg-primary transition-[width]"
                    style={{ width: `${progresso.percentual}%` }}
                  />
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                {!voz.gravando
                  ? "Transcrevendo o áudio…"
                  : voz.modo === "arquivo"
                    ? "Pode falar… o texto aparece quando você tocar em parar."
                    : "Pode falar…"}
              </span>
            ))}
          <div ref={fimRef} />
        </div>
      ) : (
        <>
          <label htmlFor="voz-texto" className="sr-only">
            Texto da pergunta
          </label>
          <textarea
            id="voz-texto"
            autoFocus
            rows={4}
            className="field max-h-[40vh] min-h-28 resize-none py-3 text-base leading-relaxed"
            placeholder="Nada foi captado. Grave de novo ou digite aqui."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
          />
        </>
      )}

      {erro && (
        <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {voz.gravando ? (
          <button type="button" className="btn btn-primary h-12 flex-1" onClick={voz.parar}>
            <Square className="h-4 w-4 fill-current" aria-hidden /> Parar
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn h-12 flex-1"
              onClick={gravarDeNovo}
              disabled={voz.estado === "processando"}
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Gravar de novo
            </button>
            <button
              type="button"
              className="btn btn-primary h-12 flex-1"
              onClick={enviar}
              disabled={!texto.trim() || voz.estado === "processando"}
            >
              <Send className="h-4 w-4" aria-hidden /> Enviar
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        className="mx-auto text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={fechar}
      >
        Cancelar
      </button>
    </div>
  );

  if (mobile) {
    return (
      <Drawer open={aberto} onOpenChange={(v) => !v && fechar()}>
        <DrawerContent className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerTitle className="sr-only">Pergunta por voz</DrawerTitle>
          <DrawerDescription className="sr-only">{descricao}</DrawerDescription>
          <div className="pt-3">{corpo}</div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="sr-only">Pergunta por voz</DialogTitle>
        <DialogDescription className="sr-only">{descricao}</DialogDescription>
        {corpo}
      </DialogContent>
    </Dialog>
  );
}
