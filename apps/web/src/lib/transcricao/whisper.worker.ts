// Web Worker: transcreve áudio com Whisper rodando no próprio navegador (transformers.js + ONNX/WASM).
// O áudio nunca sai do aparelho. O modelo é baixado na primeira vez e fica no cache do navegador.
import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from "@huggingface/transformers";

// Assinatura enxuta: o tipo genérico de `pipeline` (todas as tasks) estoura o TypeScript (TS2590)
const criarPipeline = pipeline as unknown as (
  task: "automatic-speech-recognition",
  modelo: string,
  opcoes: { dtype: "q8"; device: "wasm"; progress_callback: (p: ProgressInfo) => void },
) => Promise<AutomaticSpeechRecognitionPipeline>;

const MODELO = "onnx-community/whisper-base";

export type MensagemWorker =
  | { tipo: "progresso"; carregado: number; total: number }
  | { tipo: "pronto" }
  | { tipo: "texto"; id: number; texto: string }
  | { tipo: "erro"; id: number; mensagem: string };

let transcritor: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
const arquivos = new Map<string, { carregado: number; total: number }>();

function carregar() {
  transcritor ??= criarPipeline("automatic-speech-recognition", MODELO, {
    dtype: "q8",
    device: "wasm",
    progress_callback: (p) => {
      if (p.status !== "progress") return;
      arquivos.set(p.file, { carregado: p.loaded, total: p.total });
      let carregado = 0;
      let total = 0;
      for (const a of arquivos.values()) {
        carregado += a.carregado;
        total += a.total;
      }
      self.postMessage({ tipo: "progresso", carregado, total } satisfies MensagemWorker);
    },
  });
  return transcritor;
}

self.onmessage = async (e: MessageEvent<{ id: number; audio: Float32Array }>) => {
  const { id, audio } = e.data;
  try {
    const t = await carregar();
    self.postMessage({ tipo: "pronto" } satisfies MensagemWorker);
    const saida = await t(audio, {
      language: "portuguese",
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const texto = (Array.isArray(saida) ? saida.map((s) => s.text).join(" ") : saida.text).trim();
    self.postMessage({ tipo: "texto", id, texto } satisfies MensagemWorker);
  } catch (err) {
    transcritor = null; // permite tentar de novo (ex.: download interrompido)
    self.postMessage({
      tipo: "erro",
      id,
      mensagem: (err as Error).message,
    } satisfies MensagemWorker);
  }
};
