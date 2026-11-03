import { useMemo } from "react";

import { BarrasHorizontais, GraficoColunas, NumeroDestaque, type Ponto, type Serie } from "@/components/inicio/Graficos";
import { useMeusPlantoes, usePlantoesSetor, type Plantao } from "@/lib/api/plantoes";

const DIA = 86_400_000;
const horas = (p: Plantao) => (new Date(p.fim).getTime() - new Date(p.inicio).getTime()) / 3_600_000;
const noturno = (p: Plantao) => {
  const h = new Date(p.inicio).getHours();
  return h >= 17 || h < 5;
};
const inicioDoDia = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
};
const dm = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Agrupa e devolve top N + "Outros" (nunca gera cor nova por item: barra única). */
function topN(mapa: Map<string, number>, n: number) {
  const ord = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  const top = ord.slice(0, n).map(([rotulo, valor]) => ({ rotulo, valor: r1(valor) }));
  const resto = ord.slice(n).reduce((a, [, v]) => a + v, 0);
  return resto > 0 ? [...top, { rotulo: "Outros", valor: r1(resto) }] : top;
}

// ---------------------------------------------------------------------------
// Profissional: horas por semana, turnos e menor descanso (RN14)
// ---------------------------------------------------------------------------
export function IndicadoresProfissional({ userId }: { userId: string }) {
  const { data } = useMeusPlantoes(userId);
  const calc = useMemo(() => {
    const ps = (data ?? []).filter((p) => new Date(p.fim).getTime() > Date.now());
    const hoje = inicioDoDia(Date.now()).getTime();
    const semanas: Ponto[] = Array.from({ length: 6 }, (_, i) => {
      const ini = hoje + i * 7 * DIA;
      const h = ps.filter((p) => {
        const t = new Date(p.inicio).getTime();
        return t >= ini && t < ini + 7 * DIA;
      }).reduce((a, p) => a + horas(p), 0);
      return { rotulo: i === 0 ? "Esta" : dm(new Date(ini)), detalhe: `Semana de ${dm(new Date(ini))}`, valores: { h: r1(h) } };
    });
    const mes = ps.filter((p) => new Date(p.inicio).getTime() < hoje + 30 * DIA);
    const horasMes = mes.reduce((a, p) => a + horas(p), 0);
    const noturnos = mes.filter(noturno).length;
    // menor intervalo entre o fim de um plantão e o início do próximo
    let menor: number | null = null;
    for (let i = 1; i < ps.length; i++) {
      const gap = (new Date(ps[i]!.inicio).getTime() - new Date(ps[i - 1]!.fim).getTime()) / 3_600_000;
      if (menor === null || gap < menor) menor = gap;
    }
    return { semanas, horasMes, noturnos, diurnos: mes.length - noturnos, menor };
  }, [data]);

  const serie: Serie[] = [{ id: "h", label: "Horas", cor: "var(--grafico-1)" }];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
        <NumeroDestaque rotulo="Horas agendadas nos próximos 30 dias" valor={String(Math.round(calc.horasMes))} sufixo="h" />
        <NumeroDestaque
          rotulo="Menor descanso entre plantões"
          valor={calc.menor === null ? "—" : String(Math.round(calc.menor))}
          sufixo={calc.menor === null ? "" : "h"}
          nota={calc.menor !== null && calc.menor < 11 ? "Abaixo do mínimo de 11h (RN14). Fale com a gestão." : "Mínimo exigido: 11h (RN14)"}
          estado={calc.menor !== null && calc.menor < 11 ? "atencao" : "ok"}
        />
        <NumeroDestaque rotulo="Plantões noturnos (30 dias)" valor={String(calc.noturnos)} nota={`${calc.diurnos} diurno(s) no mesmo período`} />
      </div>
      <div className="lg:col-span-2">
        <GraficoColunas titulo="Horas por semana" descricao="Próximas 6 semanas, a partir de hoje" series={serie} pontos={calc.semanas} unidade="h" />
      </div>
      <BarrasHorizontais
        titulo="Distribuição por turno"
        descricao="Próximos 30 dias"
        unidade="plantões"
        itens={calc.diurnos + calc.noturnos ? [{ rotulo: "Diurno", valor: calc.diurnos }, { rotulo: "Noturno", valor: calc.noturnos }] : []}
        vazio="Nenhum plantão nos próximos 30 dias."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gestor: cobertura de 14 dias, carga por profissional e especialidades
// ---------------------------------------------------------------------------
export function IndicadoresGestor() {
  const { data } = usePlantoesSetor();
  const calc = useMemo(() => {
    const hoje = inicioDoDia(Date.now()).getTime();
    const janela = (data ?? []).filter((p) => new Date(p.inicio).getTime() < hoje + 14 * DIA);
    const dias: Ponto[] = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(hoje + i * DIA);
      const doDia = janela.filter((p) => inicioDoDia(new Date(p.inicio).getTime()).getTime() === d.getTime());
      const abertos = doDia.filter((p) => !p.profissional_id).length;
      return {
        rotulo: i === 0 ? "Hoje" : String(d.getDate()),
        detalhe: d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }),
        valores: { com: doDia.length - abertos, sem: abertos },
      };
    });
    const carga = new Map<string, number>();
    const esp = new Map<string, number>();
    let horasSem = 0;
    for (const p of janela) {
      if (p.profissional) carga.set(p.profissional.nome, (carga.get(p.profissional.nome) ?? 0) + horas(p));
      else horasSem += horas(p);
      const e = p.especialidade?.nome ?? "—";
      esp.set(e, (esp.get(e) ?? 0) + 1);
    }
    const cobertos = janela.filter((p) => p.profissional_id).length;
    return {
      dias,
      taxa: janela.length ? Math.round((cobertos / janela.length) * 100) : null,
      horasSem,
      total: janela.length,
      carga: topN(carga, 7),
      esp: topN(esp, 6),
    };
  }, [data]);

  const series: Serie[] = [
    { id: "com", label: "Com profissional", cor: "var(--grafico-1)" },
    { id: "sem", label: "Sem profissional", cor: "var(--grafico-alerta)", estado: true },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
        <NumeroDestaque
          rotulo="Cobertura (14 dias)"
          valor={calc.taxa === null ? "—" : String(calc.taxa)}
          sufixo={calc.taxa === null ? "" : "%"}
          nota={calc.taxa !== null && calc.taxa < 90 ? "Há plantões sem profissional no período." : `${calc.total} plantões no período`}
          estado={calc.taxa !== null && calc.taxa < 90 ? "atencao" : "ok"}
        />
        <NumeroDestaque rotulo="Horas sem cobertura" valor={String(Math.round(calc.horasSem))} sufixo="h" nota="Plantões em aberto nos próximos 14 dias" estado={calc.horasSem > 0 ? "atencao" : "ok"} />
        <NumeroDestaque rotulo="Profissionais escalados" valor={String(calc.carga.filter((c) => c.rotulo !== "Outros").length)} nota="Com plantão nos próximos 14 dias" />
      </div>
      <div className="lg:col-span-3">
        <GraficoColunas titulo="Cobertura por dia" descricao="Plantões dos próximos 14 dias" series={series} pontos={calc.dias} unidade="plantões" />
      </div>
      <div className="lg:col-span-2">
        <BarrasHorizontais titulo="Carga por profissional" descricao="Horas nos próximos 14 dias" itens={calc.carga} unidade="h" vazio="Ninguém escalado no período." />
      </div>
      <BarrasHorizontais titulo="Plantões por especialidade" descricao="Próximos 14 dias" itens={calc.esp} unidade="plantões" />
    </div>
  );
}
