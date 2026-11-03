import { useCallback, useState } from "react";

// Tema visual: TroKa (padrão: fundo claro + cabeçalho/login azul-marinho), Branco e Escuro.
// Aplicado como data-theme no <html> (ver styles.css). O index.html aplica antes do React para não piscar.
export type Tema = "troka" | "branco" | "escuro";
export const TEMAS: { id: Tema; label: string }[] = [
  { id: "troka", label: "TroKa" },
  { id: "branco", label: "Branco" },
  { id: "escuro", label: "Escuro" },
];
const CHAVE = "troka.tema";
const COR_BARRA: Record<Tema, string> = { troka: "#031334", branco: "#ffffff", escuro: "#020c22" };

export function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "branco" || t === "escuro" ? t : "troka";
  } catch {
    return "troka";
  }
}

export function aplicarTema(t: Tema) {
  const html = document.documentElement;
  if (t === "troka") html.removeAttribute("data-theme");
  else html.dataset["theme"] = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COR_BARRA[t]);
  try {
    localStorage.setItem(CHAVE, t);
  } catch {
    /* sem storage: vale só nesta aba */
  }
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(lerTema);
  const mudar = useCallback((t: Tema) => {
    aplicarTema(t);
    setTema(t);
  }, []);
  return { tema, mudar };
}
