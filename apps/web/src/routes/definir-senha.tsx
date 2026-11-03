import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { LogoCompleto } from "@/components/AppShell";
import { homeFor, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Destino do link do convite (B10/P1): o supabase-js lê o token da URL e abre a sessão; aqui a pessoa cria a senha.
export const Route = createFileRoute("/definir-senha")({
  head: () => ({ meta: [{ title: "Definir senha — TroKa" }] }),
  component: DefinirSenha,
});

const MIN = 8;

function DefinirSenha() {
  const { loading, session, perfil } = useAuth();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < MIN) return setErro(`A senha precisa ter pelo menos ${MIN} caracteres.`);
    if (senha !== confirma) return setErro("As senhas não conferem.");
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) return setErro(error.message);
    toast.success("Senha criada. Bem-vindo(a) ao TroKa!");
    navigate({ to: perfil ? homeFor(perfil.papel) : "/" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 text-navy-foreground">
      <LogoCompleto altura={48} />
      <div className="card mt-6 w-full max-w-sm p-6 text-foreground">
        {loading ? (
          <p className="text-center text-muted-foreground">Abrindo seu convite…</p>
        ) : !session ? (
          <p className="text-center text-sm">Link inválido ou expirado. Peça um novo convite à gestão do seu setor.</p>
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            <h2 className="text-2xl font-bold">Crie sua senha</h2>
            {perfil && <p className="text-sm text-muted-foreground">{perfil.nome} · {perfil.setor?.nome} · {perfil.hospital?.nome}</p>}
            <input className="field" type="password" autoComplete="new-password" placeholder={`Nova senha (mín. ${MIN})`} value={senha} onChange={(e) => setSenha(e.target.value)} />
            <input className="field" type="password" autoComplete="new-password" placeholder="Repita a senha" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
            {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
            <button className="btn btn-primary w-full" disabled={salvando}>{salvando ? "Salvando…" : "Salvar e entrar"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
