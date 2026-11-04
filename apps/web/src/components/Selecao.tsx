import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

// Substitui o <select> nativo: a lista nativa é desenhada pelo navegador (fora do CSS e, no desktop/DevTools,
// fora da tela). Esta lista fica dentro da viewport (collisionPadding) e segue o tema.
// O Radix não aceita value "" → "" vira um sentinela internamente; quem usa continua trabalhando com "".
export type OpcaoSelecao = { value: string; label: string };
export type GrupoSelecao = { label: string; opcoes: OpcaoSelecao[] };

const VAZIO = "__vazio__";
const dentro = (v: string) => (v === "" ? VAZIO : v);
const fora = (v: string) => (v === VAZIO ? "" : v);

export function Selecao({
  id, value, onChange, opcoes = [], grupos = [], vazio, disabled = false, className = "field", "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  opcoes?: OpcaoSelecao[];
  grupos?: GrupoSelecao[];
  /** Rótulo da opção "nenhuma" (valor ""), ex.: "Selecione…" */
  vazio?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const item = (o: OpcaoSelecao) => (
    <SelectItem key={o.value} value={dentro(o.value)} className="min-h-10 cursor-pointer py-2 text-sm">{o.label}</SelectItem>
  );
  return (
    <Select value={dentro(value)} onValueChange={(v) => onChange(fora(v))} disabled={disabled}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={`${className} h-auto min-h-12 min-w-0 max-w-full gap-2 text-left text-base shadow-none [&>span]:min-w-0 [&>span]:truncate`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent collisionPadding={16} className="max-h-[min(20rem,var(--radix-select-content-available-height))] max-w-[calc(100vw-2rem)] rounded-xl shadow-2xl backdrop-blur-xl">
        {vazio !== undefined && item({ value: "", label: vazio })}
        {opcoes.map(item)}
        {grupos.filter((g) => g.opcoes.length > 0).map((g) => (
          <SelectGroup key={g.label}>
            <SelectLabel className="text-xs uppercase tracking-wide text-muted-foreground">{g.label}</SelectLabel>
            {g.opcoes.map(item)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
