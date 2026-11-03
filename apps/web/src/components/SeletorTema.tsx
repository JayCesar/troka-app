import { Check, Moon, Palette, Sun } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TEMAS, useTema, type Tema } from "@/lib/tema";

const ICONE: Record<Tema, typeof Sun> = { troka: Palette, branco: Sun, escuro: Moon };

// Botão de tema (TroKa · Branco · Escuro). `className` ajusta o botão à superfície onde ele fica.
export function SeletorTema({ className = "" }: { className?: string }) {
  const { tema, mudar } = useTema();
  const Atual = ICONE[tema];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tema: ${TEMAS.find((t) => t.id === tema)!.label}. Trocar tema`}
        title="Trocar tema"
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-navy-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      >
        <Atual className="h-5 w-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        {TEMAS.map((t) => {
          const Icone = ICONE[t.id];
          return (
            <DropdownMenuItem key={t.id} onSelect={() => mudar(t.id)} className="cursor-pointer gap-2">
              <Icone className="h-4 w-4" aria-hidden />
              <span className="flex-1">{t.label}</span>
              {tema === t.id && <Check className="h-4 w-4 text-primary" aria-label="ativo" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
