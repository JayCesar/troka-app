export const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDay = (ts: number) => new Date(ts).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (ts: number) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
