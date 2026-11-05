import { act, renderHook } from "@testing-library/react";

import { falaDoNavegadorQuebrada, useGravacaoAudio } from "@/hooks/use-gravacao-audio";

// Reconhecedor que imita o Brave: aceita start() e falha com "network" logo em seguida
class ReconhecedorQuebrado {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: unknown = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start() {
    queueMicrotask(() => {
      this.onerror?.({ error: "network" });
      this.onend?.();
    });
  }
  stop() {}
}

class GravadorFalso {
  static iniciados = 0;
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  static isTypeSupported = () => true;
  start() {
    GravadorFalso.iniciados++;
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["x"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

describe("gravação: navegador sem serviço de voz (ex.: Brave)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    GravadorFalso.iniciados = 0;
    Object.assign(window, {
      webkitSpeechRecognition: ReconhecedorQuebrado,
      MediaRecorder: GravadorFalso,
      isSecureContext: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop() {} }] })) },
    });
  });

  it("troca sozinho para gravar e transcrever no aparelho, sem mostrar erro", async () => {
    const onErro = vi.fn();
    const onAudio = vi.fn();
    const { result } = renderHook(() => useGravacaoAudio({ onTexto: () => {}, onAudio, onErro }));
    expect(result.current.modo).toBe("fala");

    await act(async () => {
      result.current.alternar();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(onErro).not.toHaveBeenCalled();
    expect(result.current.modo).toBe("arquivo");
    expect(result.current.gravando).toBe(true);
    expect(GravadorFalso.iniciados).toBe(1);
    expect(falaDoNavegadorQuebrada()).toBe(true);

    await act(async () => {
      result.current.parar();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(onAudio).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("na próxima gravação da sessão já vai direto para o modo arquivo", () => {
    sessionStorage.setItem("troka.fala-indisponivel", "1");
    const { result } = renderHook(() =>
      useGravacaoAudio({ onTexto: () => {}, onAudio: () => {}, onErro: () => {} }),
    );
    expect(result.current.modo).toBe("arquivo");
  });
});
