// Assistente de IA (B11/I5). O front só conversa com o serviço `services/mcp` (rota /chat), mandando o JWT
// da sessão. Chaves de modelos (Anthropic, OpenRouter) ficam só no serviço; nunca aqui.
import { supabase } from "@/lib/supabase";
import type { ProgressoTranscricao } from "@/lib/transcricao";

export type Autor = "usuario" | "assistente" | "sistema" | "confirmacao";

/** Ação de escrita que a IA quer executar e espera o "Confirmar" do usuário. */
export interface AcaoPendente {
  id: string;
  nome: string;
  descricao: string;
  args: Record<string, unknown>;
}

export interface MensagemChat {
  id: string;
  autor: Autor;
  texto: string;
  em: number; // epoch ms
  modelo?: string | undefined; // quem respondeu (ex.: "anthropic:claude-opus-5-5")
  pendentes?: AcaoPendente[]; // autor "confirmacao"
  estado?: "aberta" | "confirmada" | "cancelada"; // autor "confirmacao"
}

/** Histórico no formato do serviço (opaco para o front: só guardamos e devolvemos). */
export type HistoricoIA = unknown[];

export interface RespostaIA {
  historico: HistoricoIA;
  tipo: "texto" | "confirmacao" | "erro";
  texto: string | null;
  pendentes: AcaoPendente[];
  modelo: string | null;
  trocas: string[];
}

export class AssistenteNaoConectadoError extends Error {
  constructor(
    msg = "O assistente ainda não está conectado. Em breve você poderá tirar dúvidas e pedir ajuda com trocas por aqui.",
  ) {
    super(msg);
    this.name = "AssistenteNaoConectadoError";
  }
}

const URL_ASSISTENTE = import.meta.env.VITE_ASSISTENTE_URL?.replace(/\/$/, "");
const ERRO_REDE = "Não consegui falar com o assistente agora. Tente de novo em instantes.";

/** Um passo da conversa: nova mensagem e/ou resposta à confirmação pendente (`aprovar`). */
export async function conversar(p: {
  historico: HistoricoIA;
  mensagem?: string;
  aprovar?: boolean;
}): Promise<RespostaIA> {
  if (!URL_ASSISTENTE) throw new AssistenteNaoConectadoError();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre de novo para usar o assistente.");

  const enviar = () =>
    fetch(`${URL_ASSISTENTE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(p),
    });
  let r: Response;
  try {
    r = await enviar();
  } catch {
    // Falha de rede (ex.: serviço gratuito acordando): tenta mais uma vez. Nunca repete uma
    // confirmação de ação (`aprovar`), para não arriscar executar a mesma escrita duas vezes.
    if (p.aprovar !== undefined) throw new AssistenteNaoConectadoError(ERRO_REDE);
    await new Promise((ok) => setTimeout(ok, 2500));
    try {
      r = await enviar();
    } catch {
      throw new AssistenteNaoConectadoError(ERRO_REDE);
    }
  }
  const corpo = await r.json().catch(() => ({}));
  if (r.status === 401)
    throw new Error("Sua sessão expirou. Entre de novo para usar o assistente.");
  if (r.status === 503) throw new AssistenteNaoConectadoError(corpo.erro ?? undefined);
  if (!r.ok) throw new Error(corpo.erro ?? "O assistente não conseguiu responder.");
  return corpo as RespostaIA;
}

/**
 * Transcrição do áudio gravado quando o navegador não transcreve sozinho (ex.: Brave).
 * Roda o Whisper no próprio aparelho: o áudio não sai do dispositivo e não há custo.
 * Carregado sob demanda: quem usa Chrome/Safari (fala nativa) nunca baixa o modelo.
 */
export async function transcreverAudio(
  audio: Blob,
  onProgresso?: (p: ProgressoTranscricao) => void,
): Promise<string> {
  const { transcreverLocal } = await import("@/lib/transcricao");
  return transcreverLocal(audio, onProgresso);
}

/** Acorda o serviço (o plano grátis do host dorme após 15 min parado e leva ~1 min para voltar).
 *  Chamado ao abrir o app, para a primeira pergunta não pagar essa espera. Falha silenciosa. */
export function despertarAssistente(): void {
  if (URL_ASSISTENTE) void fetch(`${URL_ASSISTENTE}/health`).catch(() => {});
}
