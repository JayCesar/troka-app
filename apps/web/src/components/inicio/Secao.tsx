import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ItemSecao { id: string; label: string }

// Altura útil da tela: desconta o cabeçalho (≈4.5rem) e, no celular, a barra de abas (≈4.5rem).
const ALTURA = "min-h-[calc(100dvh-9rem)] md:min-h-[calc(100dvh-4.5rem)]";

/** Seção do Início que ocupa a tela; as animações `entrar` de dentro só começam quando ela aparece. */
export function Secao({ id, titulo, subtitulo, children, className = "" }: { id: string; titulo?: string; subtitulo?: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setVisivel(true);
    const obs = new IntersectionObserver(([e]) => e?.isIntersecting && (setVisivel(true), obs.disconnect()), { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <section
      ref={ref}
      id={id}
      data-secao
      {...(visivel ? { "data-visivel": "" } : {})}
      aria-labelledby={titulo ? `${id}-titulo` : undefined}
      className={`flex snap-start flex-col justify-center gap-6 py-8 ${ALTURA} ${className}`}
    >
      {titulo && (
        <header className="entrar space-y-1">
          <h2 id={`${id}-titulo`} className="text-2xl font-bold md:text-3xl">{titulo}</h2>
          {subtitulo && <p className="text-muted-foreground">{subtitulo}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Pontos de navegação fixos à direita (desktop) + snap suave entre seções enquanto o Início está aberto. */
export function NavSecoes({ itens }: { itens: ItemSecao[] }) {
  const [ativa, setAtiva] = useState(itens[0]?.id);

  useEffect(() => {
    const html = document.documentElement;
    const antes = { snap: html.style.scrollSnapType, pad: html.style.scrollPaddingTop };
    html.style.scrollSnapType = "y proximity";
    html.style.scrollPaddingTop = "4.5rem"; // cabeçalho fixo
    return () => {
      html.style.scrollSnapType = antes.snap;
      html.style.scrollPaddingTop = antes.pad;
    };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const v = entradas.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (v) setAtiva(v.target.id);
      },
      { threshold: [0.3, 0.6] },
    );
    itens.forEach((i) => {
      const el = document.getElementById(i.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [itens]);

  return (
    <nav aria-label="Seções do início" className="fixed right-4 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
      {itens.map((i) => (
        <a
          key={i.id}
          href={`#${i.id}`}
          aria-current={ativa === i.id ? "true" : undefined}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="group flex items-center justify-end gap-2"
        >
          <span className="pointer-events-none rounded-md bg-card px-2 py-1 text-xs font-semibold opacity-0 shadow-sm ring-1 ring-border transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {i.label}
          </span>
          <span className={`block rounded-full transition-all ${ativa === i.id ? "h-3 w-3 bg-primary" : "h-2 w-2 bg-muted-foreground/40 group-hover:bg-muted-foreground"}`} />
        </a>
      ))}
    </nav>
  );
}

/** Botão "próxima seção" no rodapé de uma seção. */
export function ProximaSecao({ para, label }: { para: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => document.getElementById(para)?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className="mx-auto mt-2 flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
      <span aria-hidden className="animate-bounce text-lg leading-none">↓</span>
    </button>
  );
}
