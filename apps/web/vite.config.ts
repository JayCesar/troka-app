import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // tanstackRouter precisa vir antes do react(): gera src/routeTree.gen.ts a partir de src/routes
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      // Nova versão só ativa quando o usuário aceita (AvisoAtualizacao)
      registerType: "prompt",
      includeAssets: ["favicon.png", "apple-touch-icon.png", "troka-icone.svg"],
      manifest: {
        name: "TroKa — Troca de plantões",
        short_name: "TroKa",
        description: "Troca e cobertura de plantões hospitalares.",
        lang: "pt-BR",
        start_url: "/inicio",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#0B1F3A",
        background_color: "#0B1F3A",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Só o shell estático vai para o cache. Supabase (dados, auth, functions) nunca é cacheado.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Transcrição local (Whisper): só baixa quem precisar (navegador sem voz nativa, ex.: Brave)
        globIgnores: ["**/whisper.worker-*.js", "**/*.wasm"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "fontes",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
