/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** URL pública do serviço do assistente (services/mcp). Sem ela, o chat mostra "não conectado". */
  readonly VITE_ASSISTENTE_URL?: string;
}
