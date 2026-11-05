import { useEffect } from "react";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

/** PWA: avisa quando há versão nova do app e recarrega só se o usuário aceitar. */
export function AvisoAtualizacao() {
  const {
    needRefresh: [precisaAtualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (erro) => console.error("Falha ao registrar o service worker", erro),
  });

  useEffect(() => {
    if (!precisaAtualizar) return;
    toast("Nova versão do TroKa disponível", {
      id: "pwa-atualizacao",
      duration: Infinity,
      action: { label: "Atualizar", onClick: () => updateServiceWorker(true) },
    });
  }, [precisaAtualizar, updateServiceWorker]);

  return null;
}
