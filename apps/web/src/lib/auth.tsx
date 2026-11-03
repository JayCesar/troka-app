import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./supabase";
import type { Database } from "./database.types";

type PerfilRow = Database["public"]["Tables"]["perfil"]["Row"];
export type Papel = Database["public"]["Enums"]["papel"];
export type Perfil = PerfilRow & { setor: { nome: string } | null; hospital: { nome: string } | null };

interface AuthState {
  loading: boolean;
  session: Session | null;
  perfil: Perfil | null;
  signIn(email: string, password: string): Promise<{ error?: string; perfil?: Perfil | null }>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

// RLS garante que só o próprio hospital/setor volta (RN03, RN30).
async function fetchPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from("perfil")
    .select("*, setor(nome), hospital(nome)")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("Falha ao carregar perfil", error);
    return null;
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    let active = true;
    const apply = async (s: Session | null) => {
      const p = s ? await fetchPerfil(s.user.id) : null;
      if (!active) return;
      setSession(s);
      setPerfil(p);
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void apply(s);
      else setSession(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    loading,
    session,
    perfil,
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { error: error.message === "Invalid login credentials" ? "E-mail ou senha inválidos." : error.message };
      const p = await fetchPerfil(data.user.id);
      setSession(data.session);
      setPerfil(p);
      return { perfil: p };
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("Falha ao sair", error);
      setSession(null);
      setPerfil(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider ausente");
  return c;
}

// Destino após o login e nos redirecionamentos: a página inicial (assistente + ações do papel).
export const homeFor = (_papel: Papel) => "/inicio" as const;
