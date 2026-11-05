import { gerarSugestoes, rotuloDia } from "@/components/inicio/sugestoes";

// quarta-feira, 04/11/2026, 20h (horário local do teste)
const QUARTA_NOITE = new Date(2026, 10, 4, 20, 0);
const SEXTA_MANHA = new Date(2026, 10, 6, 8, 0);
const fixo = () => 0; // sem sorteio: só o peso decide

describe("sugestões contextuais do Início", () => {
  it("rotula hoje, amanhã e o dia da semana", () => {
    expect(rotuloDia(new Date(2026, 10, 4, 22), QUARTA_NOITE)).toBe("hoje");
    expect(rotuloDia(new Date(2026, 10, 5, 7), QUARTA_NOITE)).toBe("amanhã");
    expect(rotuloDia(new Date(2026, 10, 6, 7), QUARTA_NOITE)).toBe("sexta");
  });

  it("profissional com plantão próximo e não anunciado recebe sugestão de anunciar", () => {
    const s = gerarSugestoes(
      {
        papel: "profissional",
        agora: QUARTA_NOITE,
        meusPlantoes: [{ inicio: new Date(2026, 10, 5, 7).toISOString(), anunciado: false }],
      },
      4,
      fixo,
    );
    expect(s[0]).toBe("Quero anunciar meu plantão de amanhã");
    expect(s).toContain("Qual o horário do meu plantão de amanhã?");
    expect(s).toHaveLength(4);
  });

  it("profissional com anúncio aberto pergunta se alguém assumiu", () => {
    const s = gerarSugestoes(
      {
        papel: "profissional",
        agora: QUARTA_NOITE,
        meusPlantoes: [{ inicio: new Date(2026, 10, 6, 7).toISOString(), anunciado: true }],
      },
      4,
      fixo,
    );
    expect(s).toContain("Alguém já assumiu meu anúncio de sexta?");
    expect(s).not.toContain("Quero anunciar meu plantão de sexta");
  });

  it("sexta de manhã sugere fim de semana e plantão de hoje", () => {
    const s = gerarSugestoes({ papel: "profissional", agora: SEXTA_MANHA }, 4, fixo);
    expect(s).toEqual(
      expect.arrayContaining(["Tenho plantão no fim de semana?", "Tenho plantão hoje?"]),
    );
  });

  it("gestor com pendências e alertas vê isso primeiro, com a contagem", () => {
    const s = gerarSugestoes(
      { papel: "gestor", agora: QUARTA_NOITE, pendencias: 3, alertas: 1, emAberto: 2 },
      4,
      fixo,
    );
    expect(s.slice(0, 3)).toEqual([
      "Resuma as 3 pendências de aprovação",
      "Quais plantões estão em risco agora?",
      "Quem pode cobrir os 2 plantões em aberto?",
    ]);
  });

  it("gestor sem nada pendente não recebe sugestão de pendência", () => {
    const s = gerarSugestoes(
      { papel: "gestor", agora: QUARTA_NOITE, pendencias: 0, alertas: 0, emAberto: 0 },
      6,
      fixo,
    );
    expect(s.join(" ")).not.toMatch(/pendênc|em risco|em aberto/);
  });

  it("varia a ordem entre chamadas, sem repetir sugestão", () => {
    let i = 0;
    const seq = [0.9, 0.1, 0.5, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6, 0.0];
    const rng = () => seq[i++ % seq.length]!;
    const a = gerarSugestoes({ papel: "profissional", agora: QUARTA_NOITE }, 4, rng);
    expect(new Set(a).size).toBe(4);
    const b = gerarSugestoes({ papel: "profissional", agora: QUARTA_NOITE }, 4, () => 0.99);
    expect(b).toHaveLength(4);
  });
});
