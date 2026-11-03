import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Clock, Coins, HandHelping, History } from "lucide-react";

import { useAvisos } from "@/lib/api/avisos";
import { useOfertas } from "@/lib/api/ofertas";
import { unwrap } from "@/lib/api/plantoes";
import { supabase } from "@/lib/supabase";
import { fmtBRL, fmtDay, fmtTime } from "@/lib/format";

const ha = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} d`;
};

function Lista({ titulo, icone: Icone, vazio, link, children, n }: { titulo: string; icone: typeof Bell; vazio: string; link?: { to: "/assumir" | "/gestao/historico"; label: string }; children: React.ReactNode; n: number }) {
  return (
    <div className="entrar card flex flex-col p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold"><Icone className="h-4 w-4 text-primary" aria-hidden />{titulo}</p>
        {link && <Link to={link.to} className="text-xs font-semibold text-primary hover:underline">{link.label}</Link>}
      </div>
      {n === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{vazio}</p> : <ul className="-mx-2 divide-y">{children}</ul>}
    </div>
  );
}

function Avisos() {
  const { data } = useAvisos();
  const navigate = useNavigate();
  const itens = (data ?? []).slice(0, 6);
  return (
    <Lista titulo="Avisos recentes" icone={Bell} vazio="Nenhum aviso por enquanto." n={itens.length}>
      {itens.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            disabled={!a.link}
            onClick={() => a.link && navigate({ to: a.link })}
            className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors enabled:hover:bg-muted"
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.lido_em ? "bg-border" : "bg-primary"}`} aria-label={a.lido_em ? "lido" : "não lido"} />
            <span className="min-w-0 flex-1">
              <span className="block">{a.texto}</span>
              <span className="text-xs text-muted-foreground">{ha(a.criado_em)}</span>
            </span>
          </button>
        </li>
      ))}
    </Lista>
  );
}

interface LinhaHistorico { ocorrido_em: string; ator: string; resumo: string; plantao: string | null }

export function AtividadeGestor() {
  const { data } = useQuery({
    queryKey: ["historico", "inicio"],
    queryFn: async () => unwrap(await supabase.rpc("historico_do_setor", { p_limite: 6 })) as unknown as LinhaHistorico[],
  });
  const itens = data ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Avisos />
      <Lista titulo="Últimas mudanças no setor" icone={History} vazio="Nada registrado ainda." n={itens.length} link={{ to: "/gestao/historico", label: "Histórico completo" }}>
        {itens.map((h, i) => (
          <li key={i} className="flex gap-3 px-2 py-2.5 text-sm">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{h.resumo}</span>
              <span className="text-xs text-muted-foreground">{h.ator} · {ha(h.ocorrido_em)}{h.plantao ? ` · ${h.plantao}` : ""}</span>
            </span>
          </li>
        ))}
      </Lista>
    </div>
  );
}

export function AtividadeProfissional() {
  const { data } = useOfertas();
  const elegiveis = (data ?? []).filter((o) => o.motivos.length === 0).slice(0, 5);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Avisos />
      <Lista titulo="Oportunidades para você" icone={HandHelping} vazio="Nenhum plantão disponível que você possa assumir agora." n={elegiveis.length} link={{ to: "/assumir", label: "Ver todas" }}>
        {elegiveis.map((o) => {
          const i = new Date(o.inicio).getTime();
          return (
            <li key={(o.anuncio_id ?? "") + o.plantao_id}>
              <Link to="/assumir" className="flex items-start gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{o.especialidade} · {fmtDay(i)} {fmtTime(i)}–{fmtTime(new Date(o.fim).getTime())}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {o.tipo === "anuncio" ? `Anúncio de ${o.anunciante ?? "colega"}` : "Plantão em aberto"}
                    {o.urgencia === "urgente" && <span className="chip bg-destructive/15 text-destructive">Urgente</span>}
                    {o.adicional && <span className="chip bg-accent text-accent-foreground"><Coins className="h-3 w-3" aria-hidden />{fmtBRL(o.adicional)}</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </Lista>
    </div>
  );
}
