import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Bot, CalendarCheck, CheckCircle2, Clock, Mic, Send, ShieldCheck, Sparkles, UserRound, Zap } from "lucide-react";

import { moverHolofote } from "./efeitos";

// Prévia ilustrativa (decorativa, aria-hidden) do assistente: conversa roteirizada em loop.
// Dados fictícios; não consulta o banco.
type Passo = { pergunta: string; resposta: string; pensando: string; cartao?: ReactNode };

const Pessoa = ({ nome, descanso }: { nome: string; descanso: string }) => (
  <li className="flex items-center justify-between gap-3 rounded-lg bg-navy-foreground/10 px-3 py-1.5">
    <span className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5 text-primary" />{nome}</span>
    <span className="text-xs text-navy-foreground/60">{descanso} de descanso</span>
  </li>
);

const PlantaoMini = ({ titulo, quando, status }: { titulo: string; quando: string; status: string }) => (
  <div className="flex items-center gap-3 rounded-lg border-l-4 border-primary bg-navy-foreground/10 px-3 py-2">
    <CalendarCheck className="h-4 w-4 shrink-0 text-primary" />
    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{titulo}</p><p className="text-xs text-navy-foreground/60">{quando}</p></div>
    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">{status}</span>
  </div>
);

const ROTEIRO: Record<"gestor" | "profissional", Passo[]> = {
  gestor: [
    {
      pergunta: "Quem pode cobrir o noturno de sexta?",
      pensando: "Cruzando escala e descanso mínimo…",
      resposta: "3 pessoas da Clínica Médica respeitam o descanso de 11h (RN14):",
      cartao: <ul className="space-y-1"><Pessoa nome="Carlos M." descanso="14h" /><Pessoa nome="Fernanda S." descanso="22h" /><Pessoa nome="Paulo R." descanso="36h" /></ul>,
    },
    { pergunta: "Avise o Carlos, por favor.", pensando: "Enviando convite…", resposta: "Pronto. Convite enviado ao Carlos; te aviso quando ele responder." },
    {
      pergunta: "Algum plantão em risco hoje?",
      pensando: "Verificando cobertura do setor…",
      resposta: "Sim, 1 plantão sem cobertura. Quer anunciar com urgência?",
      cartao: <PlantaoMini titulo="UTI · Noturno" quando="Hoje, 19:00–07:00" status="Em aberto" />,
    },
  ],
  profissional: [
    {
      pergunta: "Posso assumir o plantão de sábado?",
      pensando: "Checando seu descanso…",
      resposta: "Pode sim: você terá 14h de descanso antes (RN14).",
      cartao: <PlantaoMini titulo="Clínica Médica · Diurno" quando="Sáb, 07:00–19:00" status="Disponível" />,
    },
    { pergunta: "Quantas horas tenho no mês?", pensando: "Somando sua escala…", resposta: "72h agendadas em 6 plantões. O próximo é quinta às 19h." },
    { pergunta: "Me lembra na véspera.", pensando: "Agendando lembrete…", resposta: "Combinado: aviso na sexta às 18h. ✔" },
  ],
};

type Fase = "pergunta" | "pensando" | "digitando" | "cartao";
const reduzir = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function ConversaDemo({ papel, onPerguntar }: { papel: "gestor" | "profissional"; onPerguntar: (texto?: string) => void }) {
  const [digitado, setDigitado] = useState("");
  const roteiro = ROTEIRO[papel];
  const estatico = reduzir();
  const [passo, setPasso] = useState(estatico ? roteiro.length - 1 : 0);
  const [fase, setFase] = useState<Fase>(estatico ? "cartao" : "pergunta");
  const [letras, setLetras] = useState(estatico ? Infinity : 0);
  const atual = roteiro[passo]!;

  // Máquina de estados: pergunta → pensando → digitando (letra a letra) → cartão → próximo passo
  useEffect(() => {
    if (estatico) return;
    let t: ReturnType<typeof setTimeout>;
    if (fase === "pergunta") t = setTimeout(() => setFase("pensando"), 900);
    else if (fase === "pensando") t = setTimeout(() => { setLetras(0); setFase("digitando"); }, 1400);
    else if (fase === "digitando") {
      if (letras < atual.resposta.length) t = setTimeout(() => setLetras((n) => n + 2), 28);
      else t = setTimeout(() => setFase("cartao"), 200);
    } else {
      t = setTimeout(() => {
        setPasso((p) => (p + 1) % roteiro.length);
        setLetras(0);
        setFase("pergunta");
      }, atual.cartao ? 3600 : 2400);
    }
    return () => clearTimeout(t);
  }, [fase, letras, atual, roteiro.length, estatico]);

  // Histórico: passos já concluídos (até 2) + o passo atual
  const anteriores = estatico ? roteiro.slice(0, -1).slice(-2) : roteiro.slice(Math.max(0, passo - 2), passo);
  const texto = atual.resposta.slice(0, letras);
  const selos = SELOS[papel];

  // Inclinação 3D leve seguindo o mouse (+ luz do holofote)
  const inclinar = (e: MouseEvent<HTMLDivElement>) => {
    if (estatico) return;
    moverHolofote(e);
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.transform = `perspective(1200px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg)`;
  };
  const endireitar = (e: MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = ""; };

  return (
    <div className="relative hidden w-full xl:block">
      {/* Halo e brilhos de fundo */}
      <div className="halo-ia pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_35%,transparent),transparent)] blur-2xl" />
      <div className="flutuar pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/30 blur-3xl" />

      <div
        onMouseMove={inclinar}
        onMouseLeave={endireitar}
        className="borda-ia holofote relative rounded-3xl bg-navy-foreground/[0.06] p-5 shadow-2xl backdrop-blur-md transition-transform duration-200 ease-out will-change-transform"
      >
        <div className="flex items-center justify-between pb-3">
          <span className="flex items-center gap-3 font-semibold">
            <span className="relative grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary/40 to-primary/10 text-primary ring-1 ring-primary/40">
              <Bot className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-primary/70" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span>
              Assistente TroKa
              <span className={`block text-xs font-normal ${fase === "pensando" ? "texto-ia" : "text-navy-foreground/55"}`}>
                {fase === "pensando" ? atual.pensando : fase === "digitando" ? "digitando…" : "online"}
              </span>
            </span>
          </span>
          {/* Progresso do roteiro */}
          <span className="flex items-center gap-1.5">
            {roteiro.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === passo ? "w-6 bg-primary" : i < passo ? "w-1.5 bg-primary/60" : "w-1.5 bg-navy-foreground/20"}`} />
            ))}
            <span className="ml-2 flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary"><Sparkles className="h-3 w-3" />IA</span>
          </span>
        </div>
        {/* Linha sob o cabeçalho: varre enquanto a IA pensa */}
        <div className={`h-px bg-navy-foreground/10 ${fase === "pensando" || fase === "digitando" ? "varredura-ia" : ""}`} />
        {/* Selos (dentro do card, sem sobrepor as mensagens) */}
        <div aria-hidden className="flex flex-wrap gap-2 pt-3">
          <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-navy-foreground/85"><ShieldCheck className="h-3.5 w-3.5 text-primary" />{selos[0]}</span>
          <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-navy-foreground/85"><Zap className="h-3.5 w-3.5 text-primary" />{selos[1]}</span>
        </div>

        <div aria-hidden className="flex h-[24rem] flex-col justify-end gap-4 overflow-hidden pt-4 text-[15px] [mask-image:linear-gradient(to_bottom,transparent,#000_22%)] xl:h-[28rem]">
          {anteriores.map((p, i) => (
            <div key={`h-${p.pergunta}`} className={`space-y-2 transition-opacity duration-500 ${i === anteriores.length - 1 ? "opacity-60" : "opacity-30"}`}>
              <Balao lado="eu">{p.pergunta}</Balao>
              <Balao lado="ia">{p.resposta}</Balao>
            </div>
          ))}

          <div key={`p-${passo}`} className="space-y-2">
            <div className="surgir-ia"><Balao lado="eu">{atual.pergunta}</Balao></div>
            {fase === "pensando" && (
              <div className="surgir-ia flex items-center gap-2 pl-11">
                <span className="flex gap-1 rounded-2xl rounded-bl-sm border border-navy-foreground/10 bg-navy-foreground/10 px-4 py-3">
                  {[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              </div>
            )}
            {(fase === "digitando" || fase === "cartao") && (
              <div className="surgir-ia">
                <Balao lado="ia" destaque>
                  <span className={fase === "digitando" ? "cursor-ia" : ""}>{texto}</span>
                  {fase === "cartao" && atual.cartao && <div className="surgir-ia mt-3">{atual.cartao}</div>}
                  {fase === "cartao" && !atual.cartao && <CheckCircle2 className="surgir-ia ml-1 inline h-4 w-4 text-primary" />}
                </Balao>
              </div>
            )}
          </div>
        </div>

        {/* Campo real: o que for digitado abre o assistente com a pergunta */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = digitado.trim();
            onPerguntar(t || undefined);
            setDigitado("");
          }}
          className="mt-4 flex items-center gap-2 rounded-2xl border border-navy-foreground/10 bg-navy-foreground/5 py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-primary/60 focus-within:bg-navy-foreground/10"
        >
          <label htmlFor="demo-pergunta" className="sr-only">Pergunte ao assistente</label>
          <input
            id="demo-pergunta"
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            placeholder="Pergunte sobre escalas, trocas e descanso…"
            className="min-w-0 flex-1 bg-transparent text-sm text-navy-foreground outline-none placeholder:text-navy-foreground/45"
          />
          <button type="submit" aria-label="Abrir o assistente com esta pergunta" className="grid h-9 w-9 place-items-center rounded-full bg-primary/20 text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
            {digitado.trim() ? <Send className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
          </button>
        </form>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-navy-foreground/40"><Clock className="h-3 w-3" />Respostas com base na escala e nas regras do setor</p>
      </div>
    </div>
  );
}

const SELOS: Record<"gestor" | "profissional", [string, string]> = {
  gestor: ["RN14 · descanso verificado", "Escala do setor em tempo real"],
  profissional: ["Descanso mínimo garantido", "Sua escala em tempo real"],
};

function Balao({ lado, children, destaque }: { lado: "eu" | "ia"; children: ReactNode; destaque?: boolean }) {
  if (lado === "eu")
    return <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-to-br from-primary to-primary/80 px-4 py-2.5 text-primary-foreground shadow-lg shadow-primary/20">{children}</div>;
  return (
    <div className="flex items-end gap-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-foreground/10 text-primary ring-1 ring-navy-foreground/10"><Bot className="h-4 w-4" /></span>
      <div className={`max-w-[85%] rounded-2xl rounded-bl-sm border px-4 py-3 shadow-lg ${destaque ? "border-primary/30 bg-navy-foreground/[0.12] shadow-primary/10" : "border-navy-foreground/10 bg-navy-foreground/10"}`}>{children}</div>
    </div>
  );
}
