import { Download } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { unwrap } from "@/lib/api/plantoes";
import { fmtDateTime } from "@/lib/format";

interface LinhaHistorico {
  ocorrido_em: string;
  ator: string;
  entidade: string;
  resumo: string;
  plantao: string | null;
}

const buscar = async (limite: number | null) =>
  unwrap(await supabase.rpc("historico_do_setor", limite === null ? {} : { p_limite: limite })) as unknown as LinhaHistorico[];

// RN27: CSV com ";" e BOM para abrir direto no Excel em pt-BR. Exporta o histórico completo do setor.
async function exportarCsv() {
  const linhas = await buscar(null); // null = sem limite
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [
    ["Data/hora", "Quem", "Entidade", "O que aconteceu", "Plantão"],
    ...linhas.map((l) => [new Date(l.ocorrido_em).toLocaleString("pt-BR"), l.ator, l.entidade, l.resumo, l.plantao ?? ""]),
  ]
    .map((r) => r.map(esc).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `troka-historico-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// RN25/RN26: histórico gravado pelo banco (triggers), imutável; visível só à gestão do setor
export function Historico() {
  const { data, isLoading, error } = useQuery({ queryKey: ["historico"], queryFn: () => buscar(50) });
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Histórico do setor</h2>
        <button className="btn btn-outline min-h-10 text-sm" onClick={() => exportarCsv().catch((e: Error) => toast.error(e.message))}>
          <Download className="h-4 w-4" />CSV completo
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Registro imutável de todas as mudanças (últimas 50 aqui; o CSV traz tudo).</p>
      {isLoading && <p className="card p-5 text-center text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="card p-5 text-center text-sm text-destructive">Erro: {error.message}</p>}
      <ol className="card divide-y">
        {data?.map((h, i) => (
          <li key={i} className="p-4 text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-bold">{h.resumo}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(new Date(h.ocorrido_em).getTime())}</span>
            </div>
            {h.plantao && <p className="text-muted-foreground">{h.plantao}</p>}
            <p className="text-xs">por {h.ator}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
