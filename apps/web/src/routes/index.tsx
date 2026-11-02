import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/AppShell";
import { homeFor, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TroKa — Entrar" },
      { name: "description", content: "TroKa: troca e cobertura de plantões hospitalares com regras validadas e histórico auditável." },
      { property: "og:title", content: "TroKa — Troca de plantões" },
      { property: "og:description", content: "Troca e cobertura de plantões com validação de regras e aprovação da coordenação." },
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

function Login() {
  const { signIn, perfil, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && perfil) navigate({ to: homeFor(perfil.papel) });
  }, [loading, perfil, navigate]);

  const go = async (e: string, p: string) => {
    setError("");
    if (!e || !p) return setError("Informe e-mail e senha.");
    setBusy(true);
    const r = await signIn(e, p);
    setBusy(false);
    if (r.error) return setError(r.error);
    if (!r.perfil) return setError("Usuário sem vínculo com hospital. Procure a gestão.");
    navigate({ to: homeFor(r.perfil.papel) });
  };

  return (
    <div className="flex min-h-screen flex-col bg-navy text-navy-foreground">
      <div className="px-6 pt-6">
        <Logo size={44} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <p className="max-w-xs text-center text-sm opacity-75">Troca e cobertura de plantões, com regras validadas e aprovação da coordenação.</p>
        <div className="card mt-6 w-full max-w-sm px-6 pt-8 pb-8 text-foreground">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void go(email, password); }}>
            <h2 className="text-2xl font-bold">Entrar</h2>
            <input className="field" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="field" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
            <div className="pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acesso de demonstração</p>
              <div className="flex flex-wrap gap-2">
                {import.meta.env.DEV && DEMO.map((u) => (
                  <button type="button" key={u.email} disabled={busy} onClick={() => void go(u.email, DEMO_PASSWORD)} className="chip bg-accent text-accent-foreground">
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
