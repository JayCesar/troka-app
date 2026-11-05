// Transcrição local (fallback quando o navegador não tem reconhecimento de voz próprio, ex.: Brave).
import type { MensagemWorker } from "./whisper.worker";

export type ProgressoTranscricao =
  | { fase: "baixando"; percentual: number } // só na primeira vez (modelo ~80 MB, depois fica em cache)
  | { fase: "transcrevendo" };

const TAXA = 16_000; // Whisper espera mono 16 kHz
const LIMITE_MS = 180_000;

let worker: Worker | null = null;
let proximoId = 0;

function obterWorker(): Worker {
  worker ??= new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

/** Decodifica webm/mp4/ogg do MediaRecorder em Float32 mono 16 kHz (o navegador reamostra). */
export async function decodificar(audio: Blob): Promise<Float32Array> {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx({ sampleRate: TAXA });
  try {
    const buffer = await ctx.decodeAudioData(await audio.arrayBuffer());
    // Cópia: o worker recebe o buffer por transferência (o do AudioBuffer não pode ser transferido)
    if (buffer.numberOfChannels === 1) return new Float32Array(buffer.getChannelData(0));
    // Média dos canais → mono
    const mono = new Float32Array(buffer.length);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const canal = buffer.getChannelData(c);
      for (let i = 0; i < mono.length; i++) mono[i]! += canal[i]! / buffer.numberOfChannels;
    }
    return mono;
  } finally {
    void ctx.close();
  }
}

/** Percentual agregado do download (0–100). */
export const percentual = (carregado: number, total: number) =>
  total > 0 ? Math.min(100, Math.round((carregado / total) * 100)) : 0;

export async function transcreverLocal(
  audio: Blob,
  onProgresso?: (p: ProgressoTranscricao) => void,
): Promise<string> {
  const amostras = await decodificar(audio);
  const w = obterWorker();
  const id = ++proximoId;

  return new Promise<string>((resolve, reject) => {
    const tempo = setTimeout(() => {
      w.removeEventListener("message", ouvir);
      reject(
        new Error("A transcrição demorou demais. Tente um áudio mais curto ou digite a mensagem."),
      );
    }, LIMITE_MS);

    function ouvir(e: MessageEvent<MensagemWorker>) {
      const m = e.data;
      if (m.tipo === "progresso")
        return onProgresso?.({ fase: "baixando", percentual: percentual(m.carregado, m.total) });
      if (m.tipo === "pronto") return onProgresso?.({ fase: "transcrevendo" });
      if (m.id !== id) return;
      clearTimeout(tempo);
      w.removeEventListener("message", ouvir);
      if (m.tipo === "texto") resolve(m.texto);
      else
        reject(
          new Error("Não foi possível transcrever o áudio neste aparelho. Digite a mensagem."),
        );
    }

    w.addEventListener("message", ouvir);
    w.postMessage({ id, audio: amostras }, [amostras.buffer]);
  });
}
