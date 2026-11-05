// Sugestões de perguntas para o assistente, montadas a partir do contexto (papel, dia, hora e dados do usuário).
// Função pura: o componente passa os dados e um gerador aleatório (testável com um rng fixo).
import { differenceInHours, format, getDate, getDay, getHours, isSameDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PlantaoCtx {
  inicio: string;
  anunciado: boolean;
}

export interface ContextoSugestoes {
  papel: "gestor" | "profissional";
  agora: Date;
  // profissional
  meusPlantoes?: PlantaoCtx[] | undefined;
  ofertas?: number | undefined;
  ofertasUrgentes?: number | undefined;
  // gestor
  pendencias?: number | undefined;
  alertas?: number | undefined;
  emAberto?: number | undefined;
}

interface Candidata {
  texto: string;
  peso: number; // maior = mais pertinente agora
}

/** "hoje", "amanhã" ou o dia da semana curto ("sexta"). */
export function rotuloDia(d: Date, agora: Date): string {
  if (isSameDay(d, agora)) return "hoje";
  if (isSameDay(d, addDays(agora, 1))) return "amanhã";
  return format(d, "EEEE", { locale: ptBR }).replace("-feira", "");
}

function candidatasProfissional(c: ContextoSugestoes): Candidata[] {
  const { agora } = c;
  const lista: Candidata[] = [];
  const futuros = (c.meusPlantoes ?? [])
    .map((p) => ({ ...p, data: new Date(p.inicio) }))
    .filter((p) => p.data > agora)
    .sort((a, b) => +a.data - +b.data);

  const proximo = futuros[0];
  if (proximo) {
    const dia = rotuloDia(proximo.data, agora);
    const horas = differenceInHours(proximo.data, agora);
    if (horas <= 72 && !proximo.anunciado)
      lista.push({ texto: `Quero anunciar meu plantão de ${dia}`, peso: 9 });
    if (horas <= 24) lista.push({ texto: `Qual o horário do meu plantão de ${dia}?`, peso: 8 });
  }
  const anunciado = futuros.find((p) => p.anunciado);
  if (anunciado)
    lista.push({
      texto: `Alguém já assumiu meu anúncio de ${rotuloDia(anunciado.data, agora)}?`,
      peso: 9,
    });

  if ((c.ofertasUrgentes ?? 0) > 0)
    lista.push({ texto: "Quais plantões urgentes eu posso cobrir?", peso: 8 });
  else if ((c.ofertas ?? 0) > 0)
    lista.push({ texto: "Tem plantão disponível pra mim essa semana?", peso: 7 });

  const dow = getDay(agora); // 0 = domingo
  const hora = getHours(agora);
  if (dow === 5 || dow === 6) lista.push({ texto: "Tenho plantão no fim de semana?", peso: 6 });
  if (dow === 1) lista.push({ texto: "Como está minha semana de plantões?", peso: 6 });
  if (dow === 0 && hora >= 15)
    lista.push({ texto: "Quais meus plantões na próxima semana?", peso: 6 });
  if (hora >= 18) lista.push({ texto: "Tenho plantão amanhã?", peso: 5 });
  else if (hora < 10) lista.push({ texto: "Tenho plantão hoje?", peso: 5 });
  if (getDate(agora) >= 25) lista.push({ texto: "Quais meus plantões no próximo mês?", peso: 5 });

  // Sempre úteis (regras e dúvidas comuns)
  lista.push(
    { texto: "Quais são meus próximos plantões?", peso: 4 },
    { texto: "Como funciona o descanso mínimo de 11 horas?", peso: 2 },
    { texto: "Quanto tempo meu anúncio fica aberto?", peso: 2 },
    { texto: "Posso assumir um plantão de outra especialidade?", peso: 2 },
    { texto: "Até quando posso desistir de uma troca?", peso: 2 },
  );
  return lista;
}

function candidatasGestor(c: ContextoSugestoes): Candidata[] {
  const { agora } = c;
  const lista: Candidata[] = [];
  const pend = c.pendencias ?? 0;
  const alertas = c.alertas ?? 0;
  const aberto = c.emAberto ?? 0;
  if (pend > 0)
    lista.push({
      texto:
        pend === 1
          ? "Resuma a pendência de aprovação"
          : `Resuma as ${pend} pendências de aprovação`,
      peso: 10,
    });
  if (alertas > 0) lista.push({ texto: "Quais plantões estão em risco agora?", peso: 9 });
  if (aberto > 0)
    lista.push({
      texto:
        aberto === 1
          ? "Quem pode cobrir o plantão em aberto?"
          : `Quem pode cobrir os ${aberto} plantões em aberto?`,
      peso: 8,
    });

  const dow = getDay(agora);
  if (dow === 4 || dow === 5)
    lista.push({ texto: "Quais plantões do fim de semana estão sem cobertura?", peso: 7 });
  if (dow === 1) lista.push({ texto: "Resuma o que mudou no setor desde sexta", peso: 6 });
  if (getHours(agora) >= 17) lista.push({ texto: "Como está a cobertura de amanhã?", peso: 5 });
  if (getDate(agora) >= 25) lista.push({ texto: "Como está a escala do próximo mês?", peso: 6 });

  lista.push(
    { texto: "Quais anúncios de troca estão abertos?", peso: 4 },
    { texto: "Mostre as últimas mudanças do setor", peso: 3 },
    { texto: "Quem está na lista de confiança?", peso: 2 },
    { texto: "Como funciona a aprovação automática?", peso: 2 },
    { texto: "Quais plantões estão sem cobertura?", peso: 3 },
  );
  return lista;
}

/**
 * Até `quantidade` sugestões, priorizando as mais pertinentes e sorteando entre as de peso próximo.
 * `rng` em [0, 1): o componente usa Math.random; os testes passam um valor fixo.
 */
export function gerarSugestoes(
  c: ContextoSugestoes,
  quantidade = 4,
  rng: () => number = Math.random,
): string[] {
  const candidatas = c.papel === "gestor" ? candidatasGestor(c) : candidatasProfissional(c);
  const vistas = new Set<string>();
  return candidatas
    .map((x) => ({ ...x, ordem: x.peso + rng() * 3 })) // jitter: varia a ordem sem trazer o irrelevante para o topo
    .sort((a, b) => b.ordem - a.ordem)
    .filter((x) => !vistas.has(x.texto) && vistas.add(x.texto))
    .slice(0, quantidade)
    .map((x) => x.texto);
}
