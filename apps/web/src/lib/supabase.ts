import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias (veja apps/web/.env.example).");
}

// Só a chave anon (pública) no front. Quem protege os dados é a RLS do banco.
export const supabase = createClient(url, anonKey);
