import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias (veja apps/web/.env.example).");
}

// "Manter-me conectado": sessão no localStorage (persiste) ou sessionStorage (some ao fechar o navegador).
const CHAVE_LEMBRAR = "troka.lembrar";
const seguro = <T,>(fn: () => T, padrao: T): T => {
  try {
    return fn();
  } catch {
    return padrao; // navegação privada / storage bloqueado
  }
};
export const lembrarSessao = {
  get: () => seguro(() => localStorage.getItem(CHAVE_LEMBRAR) !== "0", true),
  set: (v: boolean) => seguro(() => localStorage.setItem(CHAVE_LEMBRAR, v ? "1" : "0"), undefined),
};
const armazenamento = {
  getItem: (k: string) => seguro(() => localStorage.getItem(k) ?? sessionStorage.getItem(k), null),
  setItem: (k: string, v: string) =>
    seguro(() => {
      (lembrarSessao.get() ? localStorage : sessionStorage).setItem(k, v);
      (lembrarSessao.get() ? sessionStorage : localStorage).removeItem(k);
    }, undefined),
  removeItem: (k: string) => seguro(() => (localStorage.removeItem(k), sessionStorage.removeItem(k)), undefined),
};

// Só a chave anon (pública) no front. Quem protege os dados é a RLS do banco.
export const supabase = createClient(url, anonKey, { auth: { storage: armazenamento } });
