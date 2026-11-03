import { useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Table2 } from "lucide-react";

// Gráficos simples em HTML (sem lib): marcas finas, topo arredondado de 4px ancorado na base,
// 2px de folga entre segmentos, grade discreta, tooltip no hover/foco e visão em tabela.
// Cores: tokens --grafico-* (validados). Texto sempre em tokens de texto, nunca na cor da série.

export interface Serie { id: string; label: string; cor: string; estado?: boolean }
export interface Ponto { rotulo: string; detalhe?: string; valores: Record<string, number> }

function Moldura({ titulo, descricao, legenda, tabela, children }: { titulo: string; descricao?: string | undefined; legenda?: ReactNode; tabela: ReactNode; children: ReactNode }) {
  const [verTabela, setVerTabela] = useState(false);
  return (
    <figure className="entrar card flex flex-col gap-3 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <figcaption>
          <p className="font-semibold">{titulo}</p>
          {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
        </figcaption>
        <button
          type="button"
          onClick={() => setVerTabela((v) => !v)}
          aria-pressed={verTabela}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {verTabela ? <BarChart3 className="h-3.5 w-3.5" aria-hidden /> : <Table2 className="h-3.5 w-3.5" aria-hidden />}
          {verTabela ? "Gráfico" : "Tabela"}
        </button>
      </div>
      {legenda}
      {verTabela ? <div className="overflow-x-auto">{tabela}</div> : children}
    </figure>
  );
}

function Legenda({ series }: { series: Serie[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {series.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} />
          {s.estado && <AlertTriangle className="h-3 w-3" aria-hidden />}
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function Tabela({ series, pontos, unidade }: { series: Serie[]; pontos: Ponto[]; unidade: string }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs text-muted-foreground">
        <tr>
          <th scope="col" className="py-1.5 pr-3 font-semibold">Período</th>
          {series.map((s) => <th key={s.id} scope="col" className="py-1.5 pr-3 text-right font-semibold">{s.label}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y">
        {pontos.map((p) => (
          <tr key={p.rotulo + (p.detalhe ?? "")}>
            <td className="py-1.5 pr-3">{p.detalhe ?? p.rotulo}</td>
            {series.map((s) => <td key={s.id} className="py-1.5 pr-3 text-right tabular-nums">{p.valores[s.id] ?? 0} {unidade}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const total = (p: Ponto, series: Serie[]) => series.reduce((a, s) => a + (p.valores[s.id] ?? 0), 0);

/** Colunas verticais; com 2 séries, empilhadas (a 1ª embaixo). Rótulo de total no topo de cada coluna. */
export function GraficoColunas({ titulo, descricao, series, pontos, unidade, altura = 180 }: { titulo: string; descricao?: string; series: Serie[]; pontos: Ponto[]; unidade: string; altura?: number }) {
  const [foco, setFoco] = useState<number | null>(null);
  const max = Math.max(1, ...pontos.map((p) => total(p, series)));
  const passo = max <= 4 ? 1 : Math.ceil(max / 4);
  const topo = Math.ceil(max / passo) * passo;
  const linhas = Array.from({ length: topo / passo + 1 }, (_, i) => i * passo);

  return (
    <Moldura titulo={titulo} descricao={descricao} legenda={<Legenda series={series} />} tabela={<Tabela series={series} pontos={pontos} unidade={unidade} />}>
      <div className="relative" style={{ height: altura }} onMouseLeave={() => setFoco(null)}>
        {/* grade recessiva + eixo */}
        {linhas.map((v) => (
          <div key={v} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(v / topo) * 100}%` }}>
            <span className="w-6 -translate-y-1/2 text-right text-[10px] tabular-nums text-muted-foreground">{v}</span>
            <span className="h-px flex-1 -translate-y-1/2 bg-grafico-grade" />
          </div>
        ))}
        <div className="absolute inset-y-0 left-8 right-0 flex items-end gap-1 sm:gap-2">
          {pontos.map((p, i) => {
            const t = total(p, series);
            return (
              <div
                key={i}
                tabIndex={0}
                role="img"
                aria-label={`${p.detalhe ?? p.rotulo}: ${series.map((s) => `${s.label} ${p.valores[s.id] ?? 0} ${unidade}`).join(", ")}`}
                onMouseEnter={() => setFoco(i)}
                onFocus={() => setFoco(i)}
                onBlur={() => setFoco(null)}
                className="relative flex h-full flex-1 cursor-default flex-col justify-end rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {/* alvo de hover maior que a marca: a faixa inteira */}
                {foco === i && <span aria-hidden className="absolute inset-0 rounded-md bg-muted/60" />}
                <span className="relative mb-1 text-center text-[10px] font-semibold tabular-nums text-muted-foreground">{t > 0 ? t : ""}</span>
                <div className="relative mx-auto flex w-full max-w-7 flex-col-reverse gap-[2px]" style={{ height: `${(t / topo) * 100}%` }}>
                  {series.map((s, si) => {
                    const v = p.valores[s.id] ?? 0;
                    if (!v) return null;
                    const ehTopo = series.slice(si + 1).every((x) => !(p.valores[x.id] ?? 0));
                    return <span key={s.id} className={`w-full transition-[height] duration-700 ${ehTopo ? "rounded-t-[4px]" : ""}`} style={{ height: `${(v / t) * 100}%`, background: s.cor }} />;
                  })}
                </div>
                {foco === i && (
                  <div role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                    <p className="mb-1 font-semibold">{p.detalhe ?? p.rotulo}</p>
                    {series.map((s) => (
                      <p key={s.id} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ background: s.cor }} />
                        {s.label}: <span className="font-semibold tabular-nums">{p.valores[s.id] ?? 0} {unidade}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-8 flex gap-1 sm:gap-2">
        {pontos.map((p, i) => <span key={i} className="flex-1 truncate text-center text-[10px] text-muted-foreground">{p.rotulo}</span>)}
      </div>
    </Moldura>
  );
}

/** Barras horizontais de uma série, com o valor escrito no fim de cada barra. */
export function BarrasHorizontais({ titulo, descricao, itens, unidade, vazio = "Sem dados no período." }: { titulo: string; descricao?: string; itens: { rotulo: string; valor: number }[]; unidade: string; vazio?: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const serie: Serie = { id: "v", label: titulo, cor: "var(--grafico-1)" };
  return (
    <Moldura
      titulo={titulo}
      descricao={descricao}
      tabela={<Tabela series={[{ ...serie, label: unidade }]} pontos={itens.map((i) => ({ rotulo: i.rotulo, valores: { v: i.valor } }))} unidade="" />}
    >
      {itens.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="space-y-2.5">
          {itens.map((i) => (
            <li key={i.rotulo} className="group grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 text-sm" title={`${i.rotulo}: ${i.valor} ${unidade}`}>
              <span className="truncate text-muted-foreground transition-colors group-hover:text-foreground">{i.rotulo}</span>
              <span className="flex items-center gap-2">
                <span className="h-3 rounded-r-[4px] transition-[width,filter] duration-700 group-hover:brightness-110" style={{ width: `${Math.max(2, (i.valor / max) * 100)}%`, background: serie.cor }} />
                <span className="shrink-0 text-xs font-semibold tabular-nums">{i.valor} {unidade}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Moldura>
  );
}

/** Número em destaque (hero number) — quando a resposta é um número, não um gráfico. */
export function NumeroDestaque({ rotulo, valor, sufixo, nota, estado }: { rotulo: string; valor: string; sufixo?: string; nota?: string; estado?: "ok" | "atencao" }) {
  return (
    <div className="entrar card flex flex-col justify-between gap-2 p-4 md:p-5">
      <p className="text-sm font-medium text-muted-foreground">{rotulo}</p>
      <p className="text-4xl font-bold tabular-nums md:text-5xl">
        {valor}
        {sufixo && <span className="ml-1 text-lg font-semibold text-muted-foreground">{sufixo}</span>}
      </p>
      {nota && (
        <p className={`flex items-center gap-1.5 text-xs ${estado === "atencao" ? "font-semibold text-warning" : "text-muted-foreground"}`}>
          {estado === "atencao" && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
          {nota}
        </p>
      )}
    </div>
  );
}
