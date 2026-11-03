import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";

// Moldura das subpáginas da gestão: mesmo AppShell (só gestor) + voltar ao hub.
export function SecaoGestao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <AppShell title={titulo} role="gestor">
      <Link to="/gestao" className="mb-4 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden />Gestão
      </Link>
      {children}
    </AppShell>
  );
}
