import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, CalendarCheck, HandHelping, Megaphone, ShieldCheck, LogOut } from "lucide-react";
const LOGO_URL = "/favicon.png"; // TODO: trocar pelo logo final em public/troka-logo.png
import { fmtDateTime, useTroka } from "@/lib/troka";

export function Logo({ size = 36 }: { size?: number }) {
  return <img src={LOGO_URL} alt="TroKa" width={size} height={size} className="rounded-xl" />;
}

export function AppShell({ title, role, children }: { title: string; role?: "medico" | "gestor"; children: ReactNode }) {
  const { user, state, logout, markRead } = useTroka();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    if (!user) navigate({ to: "/" });
    else if (role && user.role !== role) navigate({ to: user.role === "gestor" ? "/gestao" : "/plantoes" });
  }, [mounted, user, role, navigate]);
  if (!mounted || !user || (role && user.role !== role)) return null;

  const mine = state.notices.filter((n) => n.userId === user.id);
  const unread = mine.filter((n) => !n.read).length;
  const tabs = user.role === "gestor"
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
            <p className="text-xs opacity-70">{user.name}</p>
            <h1 className="truncate text-lg font-bold">{title}</h1>
          </div>
          <button aria-label="Notificações" onClick={() => { setOpen(!open); if (!open) setTimeout(markRead, 1500); }} className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-navy-foreground/10">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread}</span>}
          </button>
          <button aria-label="Sair" onClick={() => { logout(); navigate({ to: "/" }); }} className="grid h-11 w-11 place-items-center rounded-full hover:bg-navy-foreground/10">
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
