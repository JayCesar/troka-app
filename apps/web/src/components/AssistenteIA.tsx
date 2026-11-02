import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { enviarAoAssistente, type MensagemChat } from "@/lib/services/assistente";
import { fmtTime } from "@/lib/format";

const BOAS_VINDAS: MensagemChat = {
  id: "boas-vindas",
  autor: "assistente",
  texto: "Olá! Sou o assistente do TroKa. Em breve vou ajudar com trocas, escalas e dúvidas sobre as regras.",
  em: Date.now(),
};
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));

// Botão flutuante + painel de chat. Só interface: a resposta vem de `enviarAoAssistente`
// (lib/services/assistente.ts), o ponto de integração com o backend da IA.
export function AssistenteIA() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([BOAS_VINDAS]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => fimRef.current?.scrollIntoView({ block: "end" }), [mensagens, aberto]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    const minha: MensagemChat = { id: novoId(), autor: "usuario", texto: conteudo, em: Date.now() };
    const historico = [...mensagens, minha];
    setMensagens(historico);
    setTexto("");
    setEnviando(true);
    try {
      const resposta = await enviarAoAssistente(historico);
      setMensagens((m) => [...m, { id: novoId(), autor: "assistente", texto: resposta, em: Date.now() }]);
    } catch (err) {
      setMensagens((m) => [...m, { id: novoId(), autor: "sistema", texto: (err as Error).message, em: Date.now() }]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        {/* Acima da barra de abas no celular; canto inferior direito no desktop */}
        <button
          type="button"
          aria-label="Abrir assistente de IA"
          className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
        >
          <Sparkles className="h-6 w-6" aria-hidden />
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4 text-left">
          <SheetTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" aria-hidden />Assistente TroKa</SheetTitle>
          <SheetDescription>Em breve: dúvidas sobre regras, trocas e escalas.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Mensagens do chat">
          {mensagens.map((m) => (
            <div key={m.id} className={`flex ${m.autor === "usuario" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.autor === "usuario"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : m.autor === "sistema"
                      ? "border border-warning/40 bg-warning/10 text-foreground"
                      : "rounded-bl-sm bg-secondary text-secondary-foreground"
                }`}
              >
                <span className="sr-only">{m.autor === "usuario" ? "Você" : m.autor === "sistema" ? "Aviso" : "Assistente"}: </span>
                <p className="whitespace-pre-wrap">{m.texto}</p>
                <p className="mt-1 text-right text-[10px] opacity-70">{fmtTime(m.em)}</p>
              </div>
            </div>
          ))}
          {enviando && <p className="text-xs text-muted-foreground">Assistente digitando…</p>}
          <div ref={fimRef} />
        </div>

        <form onSubmit={enviar} className="flex items-end gap-2 border-t p-3">
          <label htmlFor="assistente-mensagem" className="sr-only">Mensagem para o assistente</label>
          <textarea
            id="assistente-mensagem"
            rows={1}
            className="field max-h-32 min-h-11 flex-1 resize-none"
            placeholder="Escreva sua mensagem…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" className="btn btn-primary min-h-11 px-3" disabled={!texto.trim() || enviando} aria-label="Enviar mensagem">
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
