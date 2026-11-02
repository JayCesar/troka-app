import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, CalendarCheck, HandHelping, Megaphone, ShieldCheck, LogOut } from "lucide-react";
const LOGO_URL = "/favicon.png"; // TODO: trocar pelo logo final em public/troka-logo.png
import { fmtDateTime, useTroka } from "@/lib/troka";
import { homeFor, useAuth, type Papel } from "@/lib/auth";

export function Logo({ size = 36 }: { size?: number }) {
  return <img src={LOGO_URL} alt="TroKa" width={size} height={size} className="rounded-xl" />;
}

export function AppShell({ title, role, children }: { title: string; role?: Papel; children: ReactNode }) {
  const { loading, session, perfil, signOut } = useAuth();
  const { user, state, markRead } = useTroka();
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

  const mine = user ? state.notices.filter((n) => n.userId === user.id) : [];
  const unread = mine.filter((n) => !n.read).length;
  const tabs = perfil.papel === "gestor"
    ? [{ to: "/gestao" as const, label: "Gestão", icon: ShieldCheck }]
    : [
        { to: "/plantoes" as const, label: "Meus plantões", icon: CalendarCheck },
        { to: "/assumir" as const, label: "Assumir", icon: HandHelping },
        { to: "/anunciar" as const, label: "Anunciar", icon: Megaphone },
      ];

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Logo size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs opacity-70">{perfil.nome} · {perfil.setor?.nome} · {perfil.hospital?.nome}</p>
            <h1 className="truncate text-lg font-bold">{title}</h1>
          </div>
          <button aria-label="Notificações" onClick={() => { setOpen(!open); if (!open) setTimeout(markRead, 1500); }} className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-navy-foreground/10">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread}</span>}
          </button>
          <button aria-label="Sair" onClick={() => void logout()} className="grid h-11 w-11 place-items-center rounded-full hover:bg-navy-foreground/10">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        {open && (
          <div className="mx-auto max-w-3xl px-4 pb-3">
            <div className="card max-h-80 overflow-auto p-2 text-foreground">
              {mine.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhuma notificação.</p>}
              {mine.map((n) => (
                <div key={n.id} className="flex gap-3 rounded-lg p-3 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-border" : "bg-primary"}`} />
                  <div><p className="font-medium">{n.text}</p><p className="text-xs text-muted-foreground">{fmtDateTime(n.at)}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      {tabs.length > 1 && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-card">
          <div className="mx-auto grid max-w-3xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((t) => (
              <Link key={t.to} to={t.to} className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-muted-foreground" activeProps={{ className: "!text-primary" }}>
                <t.icon className="h-5 w-5" />{t.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

// TEMPORÁRIO: envolve telas que ainda leem o store mock (removido quando o bolt da tela chegar).
export function MockOnly({ bolt, children }: { bolt: string; children: ReactNode }) {
  const { user } = useTroka();
  if (!user) {
    return (
      <p className="card p-5 text-sm text-muted-foreground">
        Esta seção ainda usa dados de demonstração, que não incluem o seu usuário. Ela passa a vir do banco no {bolt}.
      </p>
    );
  }
  return <>{children}</>;
}
