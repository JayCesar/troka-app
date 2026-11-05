// Stub do módulo virtual do vite-plugin-pwa (o plugin não roda no Vitest).
export function useRegisterSW() {
  const nada = () => {};
  return {
    needRefresh: [false, nada],
    offlineReady: [false, nada],
    updateServiceWorker: async () => {},
  } as const;
}
