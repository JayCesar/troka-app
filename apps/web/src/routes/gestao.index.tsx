import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarRange, ClipboardCheck, History, Megaphone, ShieldCheck, Users, type LucideIcon } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Alertas } from "@/components/gestao/Alertas";
import { Painel } from "@/components/gestao/Painel";
import { usePlantoesSetor } from "@/lib/api/plantoes";
import { useAnunciosSetor } from "@/lib/api/anuncios";
import { useEquipe, usePendencias } from "@/lib/api/gestao";
import { usePedidosAcesso } from "@/lib/api/pedidos";

export const Route = createFileRoute("/gestao/")({
  head: () => ({
    meta: [
      { title: "Gestão — TroKa" },
      { name: "description", content: "Aprovação de trocas, cadastro de profissionais e histórico auditável." },
    ],
  }),
  component: () => <AppShell title="Gestão" role="gestor"><Hub /></AppShell>,
});

type Destino = "/gestao/aprovacoes" | "/gestao/anuncios" | "/gestao/plantoes" | "/gestao/equipe" | "/gestao/confianca" | "/gestao/historico";
interface Opcao { to: Destino; titulo: string; descricao: string; icon: LucideIcon; cor: string; contador?: number | undefined; rotuloContador: string }

const soma = (...n: (number | undefined)[]) => (n.every((x) => x === undefined) ? undefined : n.reduce<number>((a, x) => a + (x ?? 0), 0));

function Hub() {
  // Contadores reaproveitam as mesmas consultas das páginas (cache do React Query)
  const pendencias = usePendencias();
  const pedidos = usePedidosAcesso();
  const anuncios = useAnunciosSetor();
  const plantoes = usePlantoesSetor();
  const equipe = useEquipe();

  const opcoes: Opcao[] = [
    { to: "/gestao/aprovacoes", titulo: "Aprovações aguardando aceite", descricao: "Trocas, candidaturas e pedidos de acesso para decidir.", icon: ClipboardCheck, cor: "#f59e0b",
      contador: soma(pendencias.data?.length, pedidos.data?.length), rotuloContador: "pendentes" },
    { to: "/gestao/anuncios", titulo: "Anúncios do setor", descricao: "Plantões oferecidos para troca, urgência e adicional.", icon: Megaphone, cor: "#d946ef",
      contador: anuncios.data?.length, rotuloContador: "em aberto" },
    { to: "/gestao/plantoes", titulo: "Plantões do setor", descricao: "Lista ou tabela, filtro por nome e CRM/COREN, criar e editar.", icon: CalendarRange, cor: "#14a9a0",
      contador: plantoes.data?.length, rotuloContador: "futuros" },
    { to: "/gestao/equipe", titulo: "Equipe do setor", descricao: "Profissionais, lista de confiança e cadastro com convite.", icon: Users, cor: "#22d3ee",
      contador: equipe.data?.length, rotuloContador: "pessoas" },
    { to: "/gestao/confianca", titulo: "Lista de confiança", descricao: "Quem tem troca e candidatura aprovadas automaticamente (RN19b).", icon: ShieldCheck, cor: "#22c55e",
      contador: equipe.data?.filter((m) => m.confiavel).length, rotuloContador: "na lista" },
    { to: "/gestao/historico", titulo: "Histórico do setor", descricao: "Tudo o que mudou, imutável, com exportação CSV.", icon: History, cor: "#8b5cf6", rotuloContador: "" },
  ];

  return (
    <div className="space-y-8">
      <Painel />
      <Alertas />
      <section aria-label="Áreas da gestão" className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {opcoes.map((o) => (
          <Link key={o.to} to={o.to} className="card-escuro group">
            <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${o.cor} 18%, transparent)`, color: o.cor }}>
              <o.icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="flex-1">
              <h2 className="font-bold leading-tight">{o.titulo}</h2>
              <p className="mt-1 text-sm text-white/60">{o.descricao}</p>
            </div>
            {o.rotuloContador && (
              <p className="text-sm text-white/70">
                <span className="text-2xl font-bold tabular-nums text-white">{o.contador ?? "–"}</span> {o.rotuloContador}
              </p>
            )}
            <span className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white/5 text-sm font-semibold text-white/80 transition-colors group-hover:bg-white/10 group-hover:text-white">
              Abrir<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
