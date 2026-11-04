import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Bot, Maximize2, Minimize2, Send, Sparkles } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BotaoMicrofone, IndicadorGravacao } from "@/components/BotaoMicrofone";
import { SeletorFundoChat, useFundoChat } from "@/components/FundoChat";
import { useGravacaoAudio } from "@/hooks/use-gravacao-audio";
import { enviarAoAssistente, transcreverAudio, type MensagemChat } from "@/lib/services/assistente";
import { fmtTime } from "@/lib/format";

const BOAS_VINDAS: MensagemChat = {
  id: "boas-vindas",
  autor: "assistente",
  texto: "Olá! Sou o assistente do TroKa. Em breve vou ajudar com trocas, escalas e dúvidas sobre as regras.",
  em: Date.now(),
};
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));

interface AssistenteCtx {
  /** Abre o chat. Com `texto`, envia a pergunta na hora (ex.: caixa "Pergunte à IA" do /inicio). */
  abrir(texto?: string): void;
}
const Ctx = createContext<AssistenteCtx | null>(null);

export function useAssistente() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AssistenteProvider ausente");
  return c;
}

// Botão flutuante + painel de chat. Só interface: a resposta vem de `enviarAoAssistente`
// (lib/services/assistente.ts), o ponto de integração com o backend da IA.
export function AssistenteProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [maximizado, setMaximizado] = useState(false); // desktop: chat em tela cheia
  const { fundo, escolher: escolherFundo } = useFundoChat();
  const [mensagens, setMensagens] = useState<MensagemChat[]>([BOAS_VINDAS]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const historicoRef = useRef(mensagens);
  historicoRef.current = mensagens;

  useEffect(() => fimRef.current?.scrollIntoView({ block: "end" }), [mensagens, aberto]);

  const avisar = (t: string) => setMensagens((m) => [...m, { id: novoId(), autor: "sistema", texto: t, em: Date.now() }]);

  const enviarTexto = useCallback(async (conteudo: string) => {
    const minha: MensagemChat = { id: novoId(), autor: "usuario", texto: conteudo, em: Date.now() };
    const historico = [...historicoRef.current, minha];
    setMensagens(historico);
    setEnviando(true);
    try {
      const resposta = await enviarAoAssistente(historico);
      setMensagens((m) => [...m, { id: novoId(), autor: "assistente", texto: resposta, em: Date.now() }]);
    } catch (err) {
      setMensagens((m) => [...m, { id: novoId(), autor: "sistema", texto: (err as Error).message, em: Date.now() }]);
    } finally {
      setEnviando(false);
    }
  }, []);

  // Voz: o texto transcrito entra no campo (somado ao que já estava digitado) para revisar antes de enviar.
  const baseRef = useRef("");
  const voz = useGravacaoAudio({
    onTexto: (t) => setTexto(baseRef.current ? `${baseRef.current} ${t}` : t),
    onAudio: async (audio) => {
      try {
        const t = await transcreverAudio(audio);
        setTexto((atual) => (atual ? `${atual} ${t}` : t));
      } catch (err) {
        avisar((err as Error).message);
      }
    },
    onErro: avisar,
  });
  const alternarVoz = () => {
    if (!voz.gravando) baseRef.current = texto.trim();
    voz.alternar();
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (voz.gravando) voz.parar();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    setTexto("");
    void enviarTexto(conteudo);
  };

  const abrir = useCallback(
    (pergunta?: string) => {
      setAberto(true);
      if (pergunta?.trim()) void enviarTexto(pergunta.trim());
    },
    [enviarTexto],
  );

  return (
    <Ctx.Provider value={{ abrir }}>
      {children}
      <Sheet
        open={aberto}
        onOpenChange={(v) => {
          if (!v) voz.parar();
          setAberto(v);
        }}
      >
        <SheetTrigger asChild>
          {/* Acima da barra de abas no celular; canto inferior direito no desktop (sem barra) */}
          <button
            type="button"
            aria-label="Abrir assistente de IA"
            className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 lg:bottom-6"
          >
            <Sparkles className="h-6 w-6" aria-hidden />
          </button>
        </SheetTrigger>

        {/* Fundo escuro (Aurora/Noite): o painel inteiro usa o fundo, como a prévia do Início */}
        <SheetContent
          side="right"
          style={fundo.escuro ? fundo.style : undefined}
          className={`flex w-full flex-col gap-0 p-0 transition-[max-width] duration-200 ${maximizado ? "sm:max-w-none" : "sm:max-w-md"} ${fundo.escuro ? "chat-escuro border-white/10 text-white" : ""}`}
        >
          <SheetHeader className={`border-b p-4 pr-24 text-left sm:pr-32 ${fundo.escuro ? "border-white/10" : ""}`}>
            <SheetTitle className="flex items-center gap-3">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/40 to-primary/10 text-primary ring-1 ring-primary/40">
                <Bot className="h-5 w-5" aria-hidden />
                <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-primary/70" />
                <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              <span className="min-w-0">
                <span className={`block ${fundo.escuro ? "text-white" : ""}`}>Assistente TroKa</span>
                <SheetDescription asChild>
                  <span className={`block text-xs font-normal ${enviando ? "texto-ia" : fundo.escuro ? "text-white/60" : ""}`}>
                    {enviando ? "digitando…" : "Escreva ou toque no microfone para falar."}
                  </span>
                </SheetDescription>
              </span>
            </SheetTitle>
            {/* Só no desktop: no celular o chat já ocupa a tela toda.
                O header NÃO pode ser `relative`: ele cobriria o X (que vem antes no DOM) e bloquearia o clique. */}
            <button
              type="button"
              onClick={() => setMaximizado((m) => !m)}
              aria-pressed={maximizado}
              aria-label={maximizado ? "Restaurar tamanho do chat" : "Maximizar chat"}
              title={maximizado ? "Restaurar" : "Maximizar"}
              className="acao-chat absolute right-12 top-3 z-10 hidden h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid"
            >
              {maximizado ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
            </button>
            <SeletorFundoChat atual={fundo.id} onEscolher={escolherFundo} className="absolute right-12 top-3 z-10 sm:right-20" />
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 transition-[background] duration-300" style={fundo.escuro ? undefined : fundo.style} role="log" aria-live="polite" aria-label="Mensagens do chat">
          <div className={`space-y-3 ${maximizado ? "mx-auto max-w-4xl" : ""}`}>
            {mensagens.map((m) => (
              <div key={m.id} className={`flex ${m.autor === "usuario" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.autor === "usuario"
                      ? `rounded-br-sm bg-primary text-primary-foreground ${fundo.escuro ? "bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20" : ""}`
                      : m.autor === "sistema"
                        ? fundo.escuro
                          ? "border border-warning/60 bg-warning/20 text-white"
                          : "border border-warning/40 bg-warning/10 text-foreground"
                        : fundo.escuro
                          ? "rounded-bl-sm border border-white/10 bg-white/10 text-white shadow-lg backdrop-blur-sm"
                          : "rounded-bl-sm bg-secondary text-secondary-foreground"
                  }`}
                >
                  <span className="sr-only">{m.autor === "usuario" ? "Você" : m.autor === "sistema" ? "Aviso" : "Assistente"}: </span>
                  <p className="whitespace-pre-wrap">{m.texto}</p>
                  <p className="mt-1 text-right text-[10px] opacity-70">{fmtTime(m.em)}</p>
                </div>
              </div>
            ))}
            {enviando && <p className={`text-xs ${fundo.escuro ? "text-white/70" : "text-muted-foreground"}`}>Assistente digitando…</p>}
            <div ref={fimRef} />
          </div>
          </div>

          <form onSubmit={enviar} className={`border-t ${fundo.escuro ? "border-white/10" : ""} p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}>
            <div className={`flex items-end gap-2 ${maximizado ? "mx-auto max-w-4xl" : ""}`}>
            {voz.gravando ? (
              <IndicadorGravacao segundos={voz.segundos} texto={texto} />
            ) : (
              <>
                <label htmlFor="assistente-mensagem" className="sr-only">Mensagem para o assistente</label>
                <textarea
                  id="assistente-mensagem"
                  rows={1}
                  className={`field max-h-32 min-h-12 flex-1 resize-none py-3 ${fundo.escuro ? "border-white/10 bg-white/5 text-white placeholder:text-white/45 focus:border-primary" : ""}`}
                  placeholder={voz.estado === "processando" ? "Transcrevendo áudio…" : "Escreva ou fale…"}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
              </>
            )}
            <BotaoMicrofone estado={voz.estado} onClick={alternarVoz} disabled={enviando} />
            <button type="submit" className="btn btn-primary h-12 min-h-12 w-12 px-0" disabled={!texto.trim() || enviando} aria-label="Enviar mensagem">
              <Send className="h-5 w-5" aria-hidden />
            </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  );
}
