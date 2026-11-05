import { fireEvent, render, screen } from "@testing-library/react";

// Gravação simulada: o teste controla o estado e o texto "ouvido"
const estadoVoz = {
  estado: "ocioso" as "ocioso" | "gravando" | "processando",
  cb: null as null | { onTexto: (t: string) => void },
};
const alternar = vi.fn(
  () => (estadoVoz.estado = estadoVoz.estado === "gravando" ? "ocioso" : "gravando"),
);
const parar = vi.fn(() => (estadoVoz.estado = "ocioso"));
vi.mock("@/hooks/use-gravacao-audio", () => ({
  fmtDuracao: () => "00:03",
  useGravacaoAudio: (cb: { onTexto: (t: string) => void }) => {
    estadoVoz.cb = cb;
    return {
      estado: estadoVoz.estado,
      segundos: 3,
      modo: "fala",
      alternar,
      parar,
      gravando: estadoVoz.estado === "gravando",
    };
  },
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

import { ModalVoz } from "@/components/ModalVoz";

describe("ModalVoz", () => {
  beforeEach(() => {
    estadoVoz.estado = "ocioso";
    alternar.mockClear();
    parar.mockClear();
  });

  it("ao abrir começa a gravar e mostra o texto inteiro ditado", () => {
    const { rerender } = render(<ModalVoz aberto onFechar={() => {}} onEnviar={() => {}} />);
    expect(alternar).toHaveBeenCalledTimes(1);
    const longo =
      "quero anunciar meu plantão de sexta como urgente porque tenho uma consulta médica marcada";
    estadoVoz.cb!.onTexto(longo);
    rerender(<ModalVoz aberto onFechar={() => {}} onEnviar={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent(longo);
  });

  it("parar deixa o texto editável e enviar manda o texto corrigido", () => {
    const onEnviar = vi.fn();
    const { rerender } = render(<ModalVoz aberto onFechar={() => {}} onEnviar={onEnviar} />);
    estadoVoz.cb!.onTexto("meus plantoes");
    rerender(<ModalVoz aberto onFechar={() => {}} onEnviar={onEnviar} />);
    fireEvent.click(screen.getByRole("button", { name: /parar/i }));
    rerender(<ModalVoz aberto onFechar={() => {}} onEnviar={onEnviar} />);
    const campo = screen.getByLabelText("Texto da pergunta");
    fireEvent.change(campo, { target: { value: "meus plantões da semana" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    expect(onEnviar).toHaveBeenCalledWith("meus plantões da semana");
  });

  it("cancelar para a gravação e não envia", () => {
    const onFechar = vi.fn();
    const onEnviar = vi.fn();
    const { rerender } = render(<ModalVoz aberto onFechar={onFechar} onEnviar={onEnviar} />);
    rerender(<ModalVoz aberto onFechar={onFechar} onEnviar={onEnviar} />); // já gravando
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(parar).toHaveBeenCalled();
    expect(onFechar).toHaveBeenCalled();
    expect(onEnviar).not.toHaveBeenCalled();
  });
});
