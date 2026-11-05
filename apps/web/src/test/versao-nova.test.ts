import { ehErroDeVersao, recarregarParaVersaoNova } from "@/lib/versao-nova";

describe("versão nova após deploy", () => {
  it("reconhece falha de import dinâmico (Chrome, Firefox, Safari e MIME errado)", () => {
    expect(ehErroDeVersao(new TypeError("Failed to fetch dynamically imported module: https://x/assets/inicio-abc.js"))).toBe(true);
    expect(ehErroDeVersao(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(ehErroDeVersao(new TypeError("Importing a module script failed."))).toBe(true);
    expect(ehErroDeVersao(new Error("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
  });

  it("não confunde com erros comuns", () => {
    expect(ehErroDeVersao(new Error("RN14: descanso mínimo"))).toBe(false);
    expect(ehErroDeVersao(undefined)).toBe(false);
  });

  it("recarrega só uma vez dentro da janela (evita loop)", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { value: { reload }, writable: true });
    sessionStorage.clear();
    expect(recarregarParaVersaoNova()).toBe(true);
    expect(recarregarParaVersaoNova()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
