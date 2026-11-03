import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, CalendarCheck, CalendarDays, HandHelping, Home, Megaphone, ShieldCheck, LogOut, type LucideIcon } from "lucide-react";
// Logos oficiais: logo/troka-logo/ (cópias em public/). Ícone = "Troca + cuidado".
const ICONE_URL = "/troka-icone.svg";
import { fmtDateTime } from "@/lib/format";
import { homeFor, useAuth, type Papel } from "@/lib/auth";
import { useAvisos, useMarcarAvisosLidos } from "@/lib/api/avisos";
import { AssistenteProvider } from "@/components/AssistenteIA";
import { SeletorTema } from "@/components/SeletorTema";

export function Logo({ size = 36 }: { size?: number }) {
  return <img src={ICONE_URL} alt="TroKa" width={size} height={size} />;
}

// Logo completo (ícone + "TroKa") sobre superfície navy: texto branco; no tema Branco a superfície é clara → texto escuro.
// Proporção do SVG: 323×120.
export function LogoCompleto({ altura = 40 }: { altura?: number }) {
  const largura = Math.round((altura * 323) / 120);
  return (
    <>
      <img src="/troka-logo-escuro.svg" alt="TroKa" width={largura} height={altura} className="tema-branco:hidden" />
      <img src="/troka-logo-claro.svg" alt="TroKa" width={largura} height={altura} className="hidden tema-branco:block" />
    </>
  );
}

// Logo clicável: logado → /inicio (ações do usuário); deslogado → / (login).
export function LogoLink({ size = 36, completo }: { size?: number; completo?: boolean }) {
  const { session } = useAuth();
  return (
    <Link to={session ? "/inicio" : "/"} aria-label="TroKa — página inicial" className="flex shrink-0 items-center gap-3 rounded-xl transition-opacity hover:opacity-85">
      {completo ? <LogoCompleto altura={size} /> : <Logo size={size} />}
    </Link>
  );
}

export type Destino = "/inicio" | "/gestao" | "/calendario" | "/plantoes" | "/assumir" | "/anunciar";
export interface Acao { to: Destino; label: string; icon: LucideIcon; descricao: string }

// Funções principais por papel: usadas no menu (topo/rodapé) e nos cards do /inicio.
export function acoesDe(papel: Papel): Acao[] {
  return papel === "gestor"
    ? [
        { to: "/gestao", label: "Gestão", icon: ShieldCheck, descricao: "Pendências, equipe, plantões do setor e histórico." },
        { to: "/calendario", label: "Calendário", icon: CalendarDays, descricao: "Escala do setor; arraste para remanejar plantões." },
      ]
    : [
        { to: "/plantoes", label: "Meus plantões", icon: CalendarCheck, descricao: "Seus próximos plantões e pedidos de cobertura." },
        { to: "/calendario", label: "Calendário", icon: CalendarDays, descricao: "Sua escala por dia, semana ou mês." },
        { to: "/assumir", label: "Assumir", icon: HandHelping, descricao: "Plantões anunciados que você pode cobrir." },
        { to: "/anunciar", label: "Anunciar", icon: Megaphone, descricao: "Ofereça um plantão seu para troca." },
      ];
}

export function AppShell({ title, role, children }: { title: string; role?: Papel; children: ReactNode }) {
  const { loading, session, perfil, signOut } = useAuth();
  const avisos = useAvisos();
  const marcarLidos = useMarcarAvisosLidos();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/" });
    else if (perfil && role && perfil.papel !== role) navigate({ to: homeFor(perfil.papel) });
  }, [loading, session, perfil, role, navigate]);
  if (loading || !session || (perfil && role && perfil.papel !== role)) return null;

  const logout = async () => { await signOut(); navigate({ to: "/" }); };

  if (!perfil) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div className="space-y-3">
          <p className="font-semibold">Seu usuário não tem vínculo com hospital.</p>
          <button className="btn btn-primary" onClick={() => void logout()}>Sair</button>
        </div>
      </div>
    );
  }

  const mine = avisos.data ?? [];
  const unread = mine.filter((n) => !n.lido_em).length;
  const tabs: Pick<Acao, "to" | "label" | "icon">[] = [{ to: "/inicio", label: "Início", icon: Home }, ...acoesDe(perfil.papel)];

  return (
    <AssistenteProvider>
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="sticky top-0 z-20 border-b border-navy-foreground/10 bg-navy text-navy-foreground shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 md:px-8">
          <LogoLink size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs opacity-70">{perfil.nome} · {perfil.setor?.nome} · {perfil.hospital?.nome}</p>
            <h1 className="truncate text-lg font-bold">{title}</h1>
          </div>
          {/* Desktop: menu fixo no topo com as funções principais */}
          <nav aria-label="Menu principal" className="hidden items-center gap-1 md:flex">
            {tabs.map((t) => (
              <Link key={t.to} to={t.to}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-navy-foreground/75 transition-colors hover:bg-navy-foreground/10 hover:text-navy-foreground"
                activeProps={{ className: "!bg-primary/20 !text-navy-foreground", "aria-current": "page" }}>
                <t.icon className="h-4 w-4" aria-hidden />{t.label}
              </Link>
            ))}
          </nav>
          <SeletorTema />
          <button aria-label="Notificações" onClick={() => { setOpen(!open); if (!open && unread > 0) setTimeout(() => marcarLidos.mutate(), 1500); }} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-navy-foreground/15">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread}</span>}
          </button>
          <button aria-label="Sair" title="Sair" onClick={() => void logout()} className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full transition-colors hover:bg-navy-foreground/15 md:rounded-lg md:border md:border-navy-foreground/20 md:px-3">
            <LogOut className="h-5 w-5" aria-hidden /><span className="hidden text-sm font-semibold md:inline">Sair</span>
          </button>
        </div>
        {open && (
          <div className="px-4 pb-3 md:flex md:justify-end md:px-8">
            <div className="card max-h-80 overflow-auto p-2 text-foreground md:w-96">
              {mine.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhuma notificação.</p>}
              {mine.map((n) => (
                <button key={n.id} type="button" onClick={() => { setOpen(false); if (n.link) navigate({ to: n.link }); }} className="flex w-full gap-3 rounded-lg p-3 text-left text-sm transition-colors hover:bg-accent">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lido_em ? "bg-border" : "bg-primary"}`} />
                  <div><p className="font-medium">{n.texto}</p><p className="text-xs text-muted-foreground">{fmtDateTime(new Date(n.criado_em).getTime())}</p></div>
                </button>
              ))}
            </div>
          </div>
        )}
      </header>
      <main className="w-full px-4 py-5 md:px-8">{children}</main>
      {/* Celular: barra de abas no rodapé (no desktop o menu fica no topo) */}
      {tabs.length > 1 && (
        <nav aria-label="Menu principal" className="fixed inset-x-0 bottom-0 z-20 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="mx-auto grid max-w-3xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((t) => (
              <Link key={t.to} to={t.to} className="flex flex-col items-center gap-1 py-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" activeProps={{ className: "!text-primary", "aria-current": "page" }}>
                <t.icon className="h-5 w-5" />{t.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
    </AssistenteProvider>
  );
}

