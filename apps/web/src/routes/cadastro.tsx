import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Home, LogIn } from "lucide-react";

import { LogoLink } from "@/components/AppShell";
import { SeletorTema } from "@/components/SeletorTema";
import { useAuth } from "@/lib/auth";
import { solicitarAcesso, useHospitaisCadastro, type Funcao } from "@/lib/api/pedidos";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "TroKa — Cadastre-se" }] }),
  component: Cadastro,
});

// RN01/RN01b: a conta é criada pela gestão do hospital (convite + validação CRM/COREN).
// Esta tela grava um pedido de acesso (RPC `solicitar_acesso`) que aparece na gestão do hospital; não cria usuário.
const CAMPO = "field border-navy-foreground/10 bg-navy-foreground/5 text-navy-foreground placeholder:text-navy-foreground/40 focus:border-primary";

interface Pedido { nome: string; email: string; hospital: string; categoria: Funcao; conselho: string }
const VAZIO: Pedido = { nome: "", email: "", hospital: "", categoria: "medico", conselho: "" };
const ROTULO = { medico: "Médico(a)", enfermeiro: "Enfermeiro(a)", gestor: "Gestor(a) de escala" } as const;

function Cadastro() {
  const { session } = useAuth();
  const [f, setF] = useState<Pedido>(VAZIO);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const hospitais = useHospitaisCadastro();
  const set = <K extends keyof Pedido>(k: K, v: Pedido[K]) => setF((s) => ({ ...s, [k]: v }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const faltando = f.nome.trim().length < 3 ? "Informe seu nome completo."
      : !f.email.includes("@") ? "Informe um e-mail válido."
      : !f.hospital ? "Escolha o hospital onde trabalha."
      : "";
    if (faltando) return setErro(faltando);
    setErro("");
    setEnviando(true);
    try {
      await solicitarAcesso({ hospitalId: f.hospital, nome: f.nome, email: f.email, funcao: f.categoria, conselho: f.conselho });
      setEnviado(true);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy text-navy-foreground">
      <header className="sticky top-0 z-20 border-b border-navy-foreground/5 bg-navy/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <LogoLink size={36} completo />
          <div className="flex items-center gap-2">
          <SeletorTema />
          {/* Entrar (deslogado) ↔ Início (logado) */}
          {session ? (
            <Link to="/inicio" className="btn min-h-10 border border-navy-foreground/20 px-4 text-sm hover:bg-navy-foreground/10"><Home className="h-4 w-4" aria-hidden />Início</Link>
          ) : (
            <Link to="/" className="btn min-h-10 border border-navy-foreground/20 px-4 text-sm hover:bg-navy-foreground/10"><LogIn className="h-4 w-4" aria-hidden />Entrar</Link>
          )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-6 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-navy-foreground/70 transition-colors hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden />Voltar ao login
        </Link>
        <h1 className="text-2xl font-bold">Cadastre-se no TroKa</h1>
        <p className="mt-2 text-sm text-navy-foreground/70">
          As contas são criadas pela gestão do seu hospital, que valida seu CRM/COREN. Envie seus dados: a gestão recebe o
          pedido e, ao aprovar, você recebe um convite por e-mail para definir sua senha.
        </p>

        {enviado ? (
          <div role="status" className="mt-8 space-y-4 rounded-2xl border border-primary/40 bg-primary/10 p-5">
            <p className="flex items-center gap-2 font-semibold text-primary"><CheckCircle2 className="h-5 w-5" aria-hidden />Pedido enviado</p>
            <p className="text-sm text-navy-foreground/80">
              A gestão do hospital vai analisar seus dados. Quando aprovar, o convite chega em <strong>{f.email.trim()}</strong>{" "}
              (confira também o spam). Se demorar, fale com a gestão do seu setor.
            </p>
            <Link to="/" className="btn btn-primary w-full">Voltar ao login</Link>
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={(e) => void enviar(e)} noValidate>
            <div className="space-y-1.5">
              <label htmlFor="cad-nome" className="text-sm font-semibold">Nome completo</label>
              <input id="cad-nome" className={CAMPO} autoComplete="name" value={f.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cad-email" className="text-sm font-semibold">E-mail</label>
              <input id="cad-email" className={CAMPO} type="email" inputMode="email" autoComplete="email" placeholder="nome@hospital.com.br"
                value={f.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cad-hospital" className="text-sm font-semibold">Hospital</label>
              <select id="cad-hospital" className={`${CAMPO} [&>option]:text-foreground`} value={f.hospital} disabled={hospitais.isLoading}
                onChange={(e) => set("hospital", e.target.value)}>
                <option value="">{hospitais.isLoading ? "Carregando…" : "Selecione…"}</option>
                {hospitais.data?.map((h) => <option key={h.id} value={h.id}>{h.nome}</option>)}
              </select>
              {hospitais.error && <p className="text-xs text-navy-erro">Não foi possível carregar os hospitais. Tente recarregar a página.</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cad-categoria" className="text-sm font-semibold">Função</label>
              <select id="cad-categoria" className={`${CAMPO} [&>option]:text-foreground`} value={f.categoria}
                onChange={(e) => set("categoria", e.target.value as Pedido["categoria"])}>
                {(Object.keys(ROTULO) as Pedido["categoria"][]).map((k) => <option key={k} value={k}>{ROTULO[k]}</option>)}
              </select>
            </div>
            {f.categoria !== "gestor" && (
              <div className="space-y-1.5">
                <label htmlFor="cad-conselho" className="text-sm font-semibold">{f.categoria === "medico" ? "CRM" : "COREN"} e UF <span className="font-normal text-navy-foreground/50">(opcional)</span></label>
                <input id="cad-conselho" className={CAMPO} placeholder="123456/SP" value={f.conselho} onChange={(e) => set("conselho", e.target.value)} />
              </div>
            )}
            <div aria-live="polite">{erro && <p className="rounded-lg bg-destructive/15 p-3 text-sm font-medium text-navy-erro">{erro}</p>}</div>
            <button className="btn btn-primary min-h-12 w-full text-base" disabled={enviando}>{enviando ? "Enviando…" : "Solicitar acesso"}</button>
            <p className="text-center text-sm text-navy-foreground/70">
              Já tem conta? <Link to="/" className="font-semibold text-primary hover:underline">Entrar</Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
