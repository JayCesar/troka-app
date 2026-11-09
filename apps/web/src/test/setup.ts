import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom não implementa scrollIntoView. Devolve Promise como o Chrome novo: um useEffect que retorne
// esse valor quebra o React no cleanup ("is not a function"), e os testes passam a pegar isso.
Element.prototype.scrollIntoView = (() => Promise.resolve()) as unknown as Element["scrollIntoView"];
