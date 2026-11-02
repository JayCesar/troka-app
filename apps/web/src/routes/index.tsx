import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Logo } from "@/components/AppShell";
import { homeFor, useAuth } from "@/lib/auth";
import { lembrarSessao, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TroKa — Entrar" },
      { name: "description", content: "TroKa: troca e cobertura de plantões hospitalares com regras validadas e histórico auditável." },
    ],
  }),
  component: Login,
});

const DEMO = [
  { email: "ana@vilanova.com.br", label: "Ana Ribeiro · Gestora" },
  { email: "carlos@troka.app", label: "Dr. Carlos Mendes · Médico" },
  { email: "fernanda@troka.app", label: "Enf. Fernanda Rocha · Enfermeira" },
];
const DEMO_PASSWORD = "troka123"; // só existe no seed local

// Campos no tema escuro da tela (reaproveita .field e só ajusta as cores)
const CAMPO = "field border-white/10 bg-white/5 text-navy-foreground placeholder:text-navy-foreground/40 focus:border-primary";

function Login() {
  const { signIn, perfil, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [lembrar, setLembrar] = useState(() => lembrarSessao.get());
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && perfil) navigate({ to: homeFor(perfil.papel) });
  }, [loading, perfil, navigate]);

  const go = async (e: string, p: string) => {
    setError("");
    setInfo("");
    if (!e || !p) return setError("Informe e-mail e senha.");
    lembrarSessao.set(lembrar); // decide onde a sessão fica guardada (lib/supabase.ts)
    setBusy(true);
    const r = await signIn(e, p);
    setBusy(false);
    if (r.error) return setError(r.error);
    if (!r.perfil) return setError("Usuário sem vínculo com hospital. Procure a gestão.");
    navigate({ to: homeFor(r.perfil.papel) });
  };

  // Reaproveita /definir-senha (o link de recuperação abre a sessão como o convite)
  const esqueci = async () => {
    setError("");
    if (!email.includes("@")) return setError("Digite seu e-mail acima para receber o link de redefinição.");
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/definir-senha` });
    setBusy(false);
    if (err) return setError(err.message);
    setInfo("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
  };

  return (
    <div className="min-h-screen bg-navy text-navy-foreground md:grid md:grid-cols-2">
      {/* Painel ilustrativo — só a partir de tablet/desktop */}
      <aside className="relative hidden flex-col justify-center gap-6 overflow-hidden border-r border-white/5 p-10 md:flex">
        <div className="absolute left-10 top-8 flex items-center gap-3"><Logo size={40} /><span className="text-lg font-bold">TroKa</span></div>
        <span className="w-fit rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">● Trocas em tempo real</span>
        <h1 className="max-w-md text-4xl font-bold leading-tight">Plantões e trocas, sempre em dia.</h1>
        <p className="max-w-md text-navy-foreground/70">Consulte sua escala, anuncie e assuma plantões, e deixe as regras de descanso e especialidade com o sistema.</p>
        <EscalaIlustrativa />
      </aside>

      <main className="flex min-h-screen flex-col justify-center px-6 py-10 md:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 md:hidden"><Logo size={40} /><span className="text-lg font-bold">TroKa</span></div>
          <h2 className="text-2xl font-bold">Acesse sua conta</h2>
          <p className="mt-1 text-sm text-navy-foreground/70">Entre com seu e-mail e senha. Suas permissões são carregadas automaticamente.</p>

          <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); void go(email, password); }} noValidate>
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-sm font-semibold">E-mail</label>
              <input id="login-email" className={CAMPO} type="email" autoComplete="email" inputMode="email" placeholder="nome@hospital.com.br"
                value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-senha" className="text-sm font-semibold">Senha</label>
                <button type="button" onClick={() => void esqueci()} disabled={busy} className="text-sm font-semibold text-primary hover:underline">Esqueceu a senha?</button>
              </div>
              <div className="relative">
                <input id="login-senha" className={`${CAMPO} pr-12`} type={verSenha ? "text" : "password"} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} />
                <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"} aria-pressed={verSenha}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-navy-foreground/60 hover:text-navy-foreground">
                  {verSenha ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-navy-foreground/80">
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-primary)]" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
              Manter-me conectado
            </label>

            <div aria-live="polite">
              {error && <p className="rounded-lg bg-destructive/15 p-3 text-sm font-medium text-red-300">{error}</p>}
              {info && <p className="rounded-lg bg-primary/15 p-3 text-sm font-medium text-primary">{info}</p>}
            </div>

            <button className="btn btn-primary min-h-12 w-full text-base shadow-[0_8px_30px_-8px_var(--color-primary)]" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-foreground/50">Acesso de demonstração (local)</p>
              <div className="flex flex-wrap gap-2">
                {DEMO.map((u) => (
                  <button type="button" key={u.email} disabled={busy} onClick={() => void go(u.email, DEMO_PASSWORD)} className="chip bg-white/10 text-navy-foreground hover:bg-white/15">
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Decorativo (sem dados reais): grade de escala semanal como na referência
function EscalaIlustrativa() {
  const linhas: [string, number[]][] = [
    ["Ana", [2, 2, 0, 1, 2, 0, 0]],
    ["Bruno", [0, 1, 2, 2, 0, 2, 1]],
    ["Carla", [2, 0, 1, 0, 2, 2, 0]],
    ["Diego", [1, 2, 0, 2, 0, 1, 2]],
  ];
  const cor = ["bg-white/5", "bg-primary/40", "bg-primary"];
  return (
    <div aria-hidden className="max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex justify-between text-sm"><span className="font-semibold">Escala da semana</span><span className="text-xs tracking-wider text-navy-foreground/50">SEG – DOM</span></div>
      <div className="space-y-2">
        {linhas.map(([nome, dias]) => (
          <div key={nome} className="grid grid-cols-[4rem_repeat(7,1fr)] items-center gap-1.5">
            <span className="text-xs text-navy-foreground/70">{nome}</span>
            {dias.map((d, i) => <span key={i} className={`h-6 rounded-md ${cor[d]}`} />)}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 border-t border-white/10 pt-3 text-xs text-navy-foreground/60">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Plantão</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/40" />Troca</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-white/5" />Livre</span>
      </div>
    </div>
  );
}
