import { useCallback, useEffect, useRef, useState } from "react";

// Gravação de voz para o chat da IA. Duas estratégias:
// 1) "fala": Web Speech API (Chrome/Android, Safari/iOS) transcreve no próprio navegador → onTexto.
// 2) "arquivo": MediaRecorder grava o áudio → onAudio(blob), para transcrição no backend.
// Atenção: no Chrome a Web Speech API processa o áudio em servidores do Google.

export type EstadoGravacao = "ocioso" | "gravando" | "processando";
export type ModoGravacao = "fala" | "arquivo" | "indisponivel";

const LIMITE_SEGUNDOS = 120;

// Tipagem mínima: SpeechRecognition ainda não está no lib.dom do TypeScript.
interface ResultadoFala { isFinal: boolean; 0: { transcript: string } }
interface EventoFala { resultIndex: number; results: ArrayLike<ResultadoFala> }
interface Reconhecedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EventoFala) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type ConstrutorReconhecedor = new () => Reconhecedor;

function reconhecedorDoNavegador(): ConstrutorReconhecedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, ConstrutorReconhecedor | undefined>;
  return w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null;
}

export function detectarModo(): ModoGravacao {
  if (reconhecedorDoNavegador()) return "fala";
  if (typeof window !== "undefined" && "MediaRecorder" in window) return "arquivo";
  return "indisponivel";
}

export function mensagemDeErro(codigo: string): string {
  switch (codigo) {
    case "not-allowed":
    case "NotAllowedError":
    case "service-not-allowed":
    case "SecurityError":
      return "Permissão de microfone negada. Libere o microfone para este site nas configurações do navegador e tente de novo.";
    case "audio-capture":
    case "NotFoundError":
    case "NotReadableError":
      return "Nenhum microfone disponível. Verifique se o microfone está conectado e não está em uso por outro app.";
    case "network":
      return "Sem conexão para transcrever o áudio. Verifique a internet ou digite a mensagem.";
    case "inseguro":
      return "A gravação de áudio só funciona em conexão segura (HTTPS).";
    case "indisponivel":
      return "Seu navegador não suporta gravação de áudio. Digite a mensagem ou use Chrome/Safari atualizados.";
    default:
      return "Não foi possível gravar o áudio. Tente de novo ou digite a mensagem.";
  }
}

export const fmtDuracao = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function mimeSuportado(): string | undefined {
  const opcoes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return opcoes.find((m) => MediaRecorder.isTypeSupported?.(m));
}

interface Opcoes {
  /** Texto transcrito até agora (modo "fala"); chamado a cada atualização. */
  onTexto: (texto: string) => void;
  /** Áudio gravado (modo "arquivo"). */
  onAudio: (audio: Blob) => Promise<void> | void;
  onErro: (mensagem: string) => void;
}

export function useGravacaoAudio({ onTexto, onAudio, onErro }: Opcoes) {
  const [estado, setEstado] = useState<EstadoGravacao>("ocioso");
  const [segundos, setSegundos] = useState(0);
  const [modo] = useState<ModoGravacao>(detectarModo);

  const cb = useRef({ onTexto, onAudio, onErro });
  cb.current = { onTexto, onAudio, onErro };
  const reconhecedor = useRef<Reconhecedor | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const limpar = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const parar = useCallback(() => {
    reconhecedor.current?.stop();
    if (gravador.current?.state === "recording") gravador.current.stop();
  }, []);

  const iniciarTimer = useCallback(() => {
    setSegundos(0);
    timer.current = setInterval(() => {
      setSegundos((s) => {
        if (s + 1 >= LIMITE_SEGUNDOS) parar();
        return s + 1;
      });
    }, 1000);
  }, [parar]);

  const falhar = useCallback(
    (codigo: string) => {
      limpar();
      setEstado("ocioso");
      cb.current.onErro(mensagemDeErro(codigo));
    },
    [limpar],
  );

  const iniciarFala = useCallback(
    (Construtor: ConstrutorReconhecedor) => {
      const r = new Construtor();
      r.lang = "pt-BR";
      r.continuous = true;
      r.interimResults = true;
      let finalizado = "";
      r.onresult = (e) => {
        let parcial = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]!;
          if (res.isFinal) finalizado += res[0].transcript;
          else parcial += res[0].transcript;
        }
        cb.current.onTexto((finalizado + parcial).trim());
      };
      r.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return; // silêncio/cancelado: não é erro
        falhar(e.error);
      };
      r.onend = () => {
        reconhecedor.current = null;
        limpar();
        setEstado("ocioso");
      };
      reconhecedor.current = r;
      r.start();
      setEstado("gravando");
      iniciarTimer();
    },
    [falhar, iniciarTimer, limpar],
  );

  const iniciarArquivo = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return falhar(window.isSecureContext ? "indisponivel" : "inseguro");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      return falhar((err as DOMException).name);
    }
    const mime = mimeSuportado();
    const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    const partes: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && partes.push(e.data);
    rec.onstop = async () => {
      limpar();
      gravador.current = null;
      if (partes.length === 0) return setEstado("ocioso");
      setEstado("processando");
      try {
        await cb.current.onAudio(new Blob(partes, { type: rec.mimeType || mime || "audio/webm" }));
      } finally {
        setEstado("ocioso");
      }
    };
    gravador.current = rec;
    rec.start();
    setEstado("gravando");
    iniciarTimer();
  }, [falhar, iniciarTimer, limpar]);

  const iniciar = useCallback(() => {
    if (estado !== "ocioso") return;
    if (!window.isSecureContext) return falhar("inseguro");
    const Fala = reconhecedorDoNavegador();
    if (Fala) {
      try {
        iniciarFala(Fala);
      } catch {
        void iniciarArquivo();
      }
      return;
    }
    if ("MediaRecorder" in window) return void iniciarArquivo();
    falhar("indisponivel");
  }, [estado, falhar, iniciarArquivo, iniciarFala]);

  const alternar = useCallback(() => (estado === "gravando" ? parar() : iniciar()), [estado, iniciar, parar]);

  // Desmontou (fechou o chat, trocou de página): libera o microfone.
  useEffect(
    () => () => {
      reconhecedor.current?.stop();
      if (gravador.current?.state === "recording") gravador.current.stop();
      limpar();
    },
    [limpar],
  );

  return { estado, segundos, modo, alternar, parar, gravando: estado === "gravando" };
}
