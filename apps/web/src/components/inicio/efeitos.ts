import { useEffect, useRef, useState, type MouseEvent } from "react";

const reduzirMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Número que "conta" até o valor (easing), partindo do último exibido. */
export function useContagem(alvo: number | undefined, duracao = 800): number | undefined {
  const [valor, setValor] = useState<number | undefined>(alvo === undefined ? undefined : 0);
  const atual = useRef(0);
  useEffect(() => {
    if (alvo === undefined) return;
    if (reduzirMovimento()) {
      atual.current = alvo;
      setValor(alvo);
      return;
    }
    const de = atual.current;
    const ini = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - ini) / duracao);
      const v = Math.round(de + (alvo - de) * (1 - Math.pow(1 - p, 3)));
      atual.current = v;
      setValor(v);
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracao]);
  return valor;
}

/** "Agora" que atualiza a cada `ms` (contagem regressiva). */
export function useAgora(ms = 30_000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return agora;
}

/** Alterna itens de uma lista a cada `ms` enquanto `ativo`. */
export function useRotativo<T>(itens: T[], ms = 3500, ativo = true): { item: T | undefined; indice: number } {
  const [indice, setIndice] = useState(0);
  useEffect(() => {
    if (!ativo || itens.length < 2 || reduzirMovimento()) return;
    const id = setInterval(() => setIndice((i) => (i + 1) % itens.length), ms);
    return () => clearInterval(id);
  }, [ativo, itens.length, ms]);
  return { item: itens[indice % Math.max(1, itens.length)], indice };
}

/** Handler para o efeito `holofote` (posição do mouse em CSS vars). */
export function moverHolofote(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

/** "em 2d 5h", "em 3h 20min", "em 12min". */
export function falta(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `em ${d}d ${h}h`;
  if (h > 0) return `em ${h}h ${String(m).padStart(2, "0")}min`;
  return `em ${m}min`;
}
