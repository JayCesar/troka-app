// Web Worker: transcreve áudio com Whisper rodando no próprio navegador (transformers.js + ONNX/WASM).
// O áudio nunca sai do aparelho. O modelo é baixado na primeira vez e fica no cache do navegador.
import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from "@huggingface/transformers";

// Assinatura enxuta: o tipo genérico de `pipeline` (todas as tasks) estoura o TypeScript (TS2590)
type Dtype = "q8" | { encoder_model: "fp32"; decoder_model_merged: "q4" };
const criarPipeline = pipeline as unknown as (
  task: "automatic-speech-recognition",
  modelo: string,
  opcoes: { dtype: Dtype; device: "wasm" | "webgpu"; progress_callback: (p: ProgressInfo) => void },
) => Promise<AutomaticSpeechRecognitionPipeline>;

const MODELO = "onnx-community/whisper-base";

export type MensagemWorker =
  | { tipo: "progresso"; carregado: number; total: number }
  | { tipo: "pronto" }
  | { tipo: "carregado"; dispositivo: "webgpu" | "wasm" } // resposta ao pré-carregamento (sem id)
  | { tipo: "texto"; id: number; texto: string }
  | { tipo: "erro"; id: number; mensagem: string };

let transcritor: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
let dispositivo: "webgpu" | "wasm" = "wasm";
const arquivos = new Map<string, { carregado: number; total: number }>();

function progresso(p: ProgressInfo) {
  if (p.status !== "progress") return;
  arquivos.set(p.file, { carregado: p.loaded, total: p.total });
  let carregado = 0;
  let total = 0;
  for (const a of arquivos.values()) {
    carregado += a.carregado;
    total += a.total;
  }
  self.postMessage({ tipo: "progresso", carregado, total } satisfies MensagemWorker);
}

// GPU (WebGPU) é muitas vezes mais rápida que a CPU; sem ela (ou se falhar), cai no WASM.
async function temWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return !!(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

function carregar() {
  transcritor ??= (async () => {
    if (await temWebGPU()) {
      try {
        const t = await criarPipeline("automatic-speech-recognition", MODELO, {
          dtype: { encoder_model: "fp32", decoder_model_merged: "q4" }, // combinação recomendada para Whisper na GPU
          device: "webgpu",
          progress_callback: progresso,
        });
        dispositivo = "webgpu";
        return t;
      } catch (err) {
        console.warn("[transcrição] WebGPU falhou, usando CPU (WASM):", err);
        arquivos.clear();
      }
    }
    dispositivo = "wasm";
    return criarPipeline("automatic-speech-recognition", MODELO, { dtype: "q8", device: "wasm", progress_callback: progresso });
  })();
  return transcritor;
}

type Pedido = { tipo: "carregar" } | { id: number; audio: Float32Array };

self.onmessage = async (e: MessageEvent<Pedido>) => {
  // Pré-carregamento: baixa/compila o modelo enquanto a pessoa ainda está falando
  if ("tipo" in e.data) {
    try {
      await carregar();
      self.postMessage({ tipo: "carregado", dispositivo } satisfies MensagemWorker);
    } catch {
      transcritor = null; // a transcrição de verdade tenta de novo e reporta o erro
    }
    return;
  }
  const { id, audio } = e.data;
  try {
    const t = await carregar();
    self.postMessage({ tipo: "pronto" } satisfies MensagemWorker);
    // Fatiar só quando passa de 30 s: em áudio curto, o modo em janelas só adiciona trabalho
    const longo = audio.length > 30 * 16_000;
    const saida = await t(audio, {
      language: "portuguese",
      task: "transcribe",
      ...(longo ? { chunk_length_s: 30, stride_length_s: 5 } : {}),
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
