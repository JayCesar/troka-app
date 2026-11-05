// Depois de um deploy, uma aba aberta com a versão antiga pode pedir um pedaço de JS que não existe mais.
// Nesse caso recarregamos UMA vez para pegar a versão nova (a trava evita loop se o erro for outro).
const CHAVE = "troka.recarregou-versao";
const JANELA_MS = 30_000;

const PADROES = [
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
  "is not a valid JavaScript MIME type",
  "Unable to preload CSS",
];

export function ehErroDeVersao(erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : String(erro ?? "");
  return PADROES.some((p) => msg.includes(p));
}

/** Recarrega a página se ainda não recarregou nos últimos 30 s. Devolve true se recarregou. */
export function recarregarParaVersaoNova(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) ?? 0);
    if (Date.now() - ultima < JANELA_MS) return false;
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // storage bloqueado: recarrega mesmo assim (no pior caso cai na tela de erro)
  }
  window.location.reload();
  return true;
}
