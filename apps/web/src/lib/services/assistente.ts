// PONTO DE INTEGRAÇÃO — assistente de IA (B11, ainda sem escopo: Q10, Q13, Q14 em aberto).
// A UI do chat já chama `enviarAoAssistente`. Para conectar: implementar a chamada (ex.: Edge Function
// `assistente` via supabase.functions.invoke) devolvendo a resposta. Nunca chamar um provedor de IA direto do front
// (a chave ficaria exposta) — sempre pelo backend.

export type Autor = "usuario" | "assistente" | "sistema";
export interface MensagemChat {
  id: string;
  autor: Autor;
  texto: string;
  em: number; // epoch ms
}

export class AssistenteNaoConectadoError extends Error {
  constructor() {
    super("O assistente ainda não está conectado. Em breve você poderá tirar dúvidas e pedir ajuda com trocas por aqui.");
    this.name = "AssistenteNaoConectadoError";
  }
}

/** Envia o histórico e devolve a resposta do assistente. */
export async function enviarAoAssistente(_historico: MensagemChat[]): Promise<string> {
  // TODO(B11): integrar com o backend do assistente.
  throw new AssistenteNaoConectadoError();
}
