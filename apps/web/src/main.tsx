import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { getRouter } from "./router";
import { recarregarParaVersaoNova } from "./lib/versao-nova";
import "./styles.css";

// Vite avisa quando um import dinâmico falha (pedaço de JS de uma versão já substituída por deploy novo)
window.addEventListener("vite:preloadError", (e) => {
  if (recarregarParaVersaoNova()) e.preventDefault();
});

const router = getRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
