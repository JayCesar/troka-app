import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/AppShell";
import { useTroka } from "@/lib/troka";

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

function Login() {
  const { login, state } = useTroka();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const go = (e: string) => {
    const u = login(e);
    if (!u) return setError("E-mail não encontrado.");
    navigate({ to: u.role === "gestor" ? "/gestao" : "/plantoes" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-navy text-navy-foreground">
      <div className="px-6 pt-6">
        <Logo size={44} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <p className="max-w-xs text-center text-sm opacity-75">Troca e cobertura de plantões, com regras validadas e aprovação da coordenação.</p>
        <div className="card mt-6 w-full max-w-sm px-6 pt-8 pb-8 text-foreground">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!password) return setError("Informe a senha."); go(email); }}>
            <h2 className="text-2xl font-bold">Entrar</h2>
            <input className="field" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="field" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <button className="btn btn-primary w-full">Entrar</button>
            <div className="pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acesso de demonstração</p>
              <div className="flex flex-wrap gap-2">
                {state.users.filter((u) => ["g1", "d1", "d6"].includes(u.id)).map((u) => (
                  <button type="button" key={u.id} onClick={() => go(u.email)} className="chip bg-accent text-accent-foreground">
                    {u.name} · {u.role === "gestor" ? "Gestora" : "Médico"}
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
