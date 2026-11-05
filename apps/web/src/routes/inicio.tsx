import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import { ArrowRight, Bot, Send, Sparkles } from "lucide-react";

import { AppShell, acoesDe } from "@/components/AppShell";
import { useAssistente } from "@/components/AssistenteIA";
import { BotaoMicrofone } from "@/components/BotaoMicrofone";
import { ModalVoz } from "@/components/ModalVoz";
import { ConversaDemo } from "@/components/inicio/ConversaDemo";
import { moverHolofote, useRotativo } from "@/components/inicio/efeitos";
import { PanoramaGestor, PanoramaProfissional } from "@/components/inicio/Panorama";
import { AtividadeGestor, AtividadeProfissional } from "@/components/inicio/Atividade";
import { IndicadoresGestor, IndicadoresProfissional } from "@/components/inicio/Indicadores";
import { Regras } from "@/components/inicio/Regras";
import { NavSecoes, ProximaSecao, Secao, type ItemSecao } from "@/components/inicio/Secao";
import { useSugestoes } from "@/components/inicio/useSugestoes";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/inicio")({
  head: () => ({ meta: [{ title: "Início — TroKa" }] }),
  component: () => (
    <AppShell title="Início">
      <Inicio />
    </AppShell>
  ),
});

const atraso = (ms: number) => ({ "--atraso": `${ms}ms` }) as CSSProperties;
const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

const SECOES: ItemSecao[] = [
  { id: "assistente", label: "Assistente" },
  { id: "panorama", label: "Panorama" },
  { id: "numeros", label: "Números e gráficos" },
  { id: "atividade", label: "Atividade" },
  { id: "regras", label: "Regras essenciais" },
  { id: "atalhos", label: "Atalhos" },
];

// Início em seções de tela cheia: assistente · panorama · números/gráficos · atividade · regras · atalhos.
function Inicio() {
  const { perfil } = useAuth();
  const { abrir } = useAssistente();
  const [pergunta, setPergunta] = useState("");
  const [vozAberta, setVozAberta] = useState(false); // pergunta por voz em modal (texto inteiro, editável)
  const papel = perfil?.papel === "gestor" ? "gestor" : "profissional";
  const sugestoes = useSugestoes(papel, perfil?.id ?? "");
  const [focado, setFocado] = useState(false);
  const dica = useRotativo(sugestoes, 3500, !pergunta && !focado);

  if (!perfil) return null;
  const acoes = acoesDe(perfil.papel);
  const primeiroNome =
    perfil.nome.split(" ").find((p) => !/^(dr|dra|enf)\.?$/i.test(p)) ?? perfil.nome;

  const perguntar = (texto: string) => {
    abrir(texto);
    setPergunta("");
  };

  return (
    <div className="lg:pr-10">
      <NavSecoes itens={SECOES} />

      {/* 1. Assistente de IA */}
      <Secao id="assistente">
        <div className="entrar relative flex flex-1 items-center overflow-hidden rounded-3xl border border-navy-foreground/10 bg-navy p-6 text-navy-foreground md:p-10">
          <div
            aria-hidden
            className="flutuar pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/25 blur-3xl"
          />
          <div
            aria-hidden
            className="flutuar pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl [animation-delay:-7s]"
          />
          <div className="relative grid w-full items-center gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:gap-14">
            <div className="max-w-2xl space-y-4">
              <span
                className="entrar inline-flex items-center gap-1.5 rounded-full border border-primary/50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary"
                style={atraso(80)}
              >
                <Sparkles className="h-3.5 w-3.5 animate-pulse" aria-hidden />
                Assistente TroKa
              </span>
              <h2
                id="ia-titulo"
                className="entrar text-2xl font-bold leading-tight md:text-4xl"
                style={atraso(160)}
              >
                {saudacao()}, {primeiroNome}. Como posso ajudar no seu plantão?
              </h2>
              <p className="entrar text-navy-foreground/70" style={atraso(240)}>
                Pergunte por texto ou toque no microfone e fale: trocas, escalas e regras de
                descanso.
              </p>

              <form
                className="entrar flex items-end gap-2"
                style={atraso(320)}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pergunta.trim()) perguntar(pergunta);
                }}
              >
                <label htmlFor="inicio-pergunta" className="sr-only">
                  Pergunta para o assistente
                </label>
                <input
                  id="inicio-pergunta"
                  className="field min-h-12 flex-1 border-navy-foreground/15 bg-navy-foreground/10 text-navy-foreground placeholder:text-navy-foreground/50 focus:border-primary"
                  placeholder={`Ex.: ${dica.item ?? "pergunte ao assistente…"}`}
                  value={pergunta}
                  onChange={(e) => setPergunta(e.target.value)}
                  onFocus={() => setFocado(true)}
                  onBlur={() => setFocado(false)}
                />
                <BotaoMicrofone estado="ocioso" onClick={() => setVozAberta(true)} />
                <button
                  type="submit"
                  className="btn btn-primary h-12 min-h-12 w-12 px-0"
                  disabled={!pergunta.trim()}
                  aria-label="Perguntar ao assistente"
                >
                  <Send className="h-5 w-5" aria-hidden />
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {sugestoes.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => perguntar(s)}
                    style={atraso(400 + i * 70)}
                    className={`entrar chip py-2 text-navy-foreground transition-all hover:-translate-y-0.5 hover:bg-navy-foreground/20 ${dica.indice === i && !pergunta ? "bg-primary/25 ring-1 ring-primary/50" : "bg-navy-foreground/10"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Prévia do chat (ilustrativa, em loop), só no desktop */}
            <ConversaDemo papel={papel} onPerguntar={(t) => abrir(t)} />
            <ModalVoz
              aberto={vozAberta}
              onFechar={() => setVozAberta(false)}
              onEnviar={(t) => {
                setVozAberta(false);
                perguntar(t);
              }}
            />
          </div>
        </div>
        <ProximaSecao para="panorama" label="Veja seu panorama" />
      </Secao>

      {/* 2. Panorama (números do dia e semana) */}
      <Secao id="panorama">
        {papel === "gestor" ? <PanoramaGestor /> : <PanoramaProfissional userId={perfil.id} />}
      </Secao>

      {/* 3. Números e gráficos */}
      <Secao
        id="numeros"
        titulo={papel === "gestor" ? "Cobertura e carga do setor" : "Sua escala em números"}
        subtitulo={
          papel === "gestor"
            ? "Onde faltam profissionais e como a carga está distribuída."
            : "Horas, turnos e descanso nas próximas semanas."
        }
      >
        {papel === "gestor" ? (
          <IndicadoresGestor />
        ) : (
          <IndicadoresProfissional userId={perfil.id} />
        )}
      </Secao>

      {/* 4. Atividade recente */}
      <Secao
        id="atividade"
        titulo={papel === "gestor" ? "Atividade do setor" : "Atividade e oportunidades"}
        subtitulo={
          papel === "gestor"
            ? "Avisos e as últimas mudanças registradas."
            : "Seus avisos e plantões que você pode assumir agora."
        }
      >
        {papel === "gestor" ? <AtividadeGestor /> : <AtividadeProfissional />}
      </Secao>

      {/* 5. Regras essenciais */}
      <Secao
        id="regras"
        titulo="Regras essenciais"
        subtitulo="O que o sistema valida em toda troca. Toque numa regra para perguntar ao assistente."
      >
        <Regras />
      </Secao>

      {/* 6. Atalhos */}
      <Secao
        id="atalhos"
        titulo="O que você quer fazer?"
        subtitulo="Atalhos para as funções principais."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {acoes.map((a, i) => (
            <Link
              key={a.to}
              to={a.to}
              onMouseMove={moverHolofote}
              style={atraso(100 + i * 80)}
              className="entrar holofote card group flex min-h-36 items-start gap-3 p-5 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground transition-all duration-300 group-hover:rotate-[-6deg] group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                <a.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between font-semibold">
                  {a.label}
                  <ArrowRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden
                  />
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{a.descricao}</span>
              </span>
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById("assistente")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="mx-auto rounded-lg px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          ↑ Voltar ao topo
        </button>
      </Secao>
    </div>
  );
}
