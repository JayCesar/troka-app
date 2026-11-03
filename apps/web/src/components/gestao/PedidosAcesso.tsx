import { useState } from "react";
import { UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import { Formulario } from "@/components/gestao/CadastroProfissional";
import { lerConselho, usePedidosAcesso, useResolverPedido, type PedidoAcesso } from "@/lib/api/pedidos";
import { fmtDateTime } from "@/lib/format";

const FUNCAO: Record<string, string> = { medico: "Médico(a)", enfermeiro: "Enfermeiro(a)", gestor: "Gestor(a)" };

// Pedidos da tela pública /cadastro. Aprovar = cadastrar com convite (RN01/RN01b) e marcar o pedido como aprovado.
export function PedidosAcesso() {
  const { data, isLoading, error } = usePedidosAcesso();
  const resolver = useResolverPedido();
  const [cadastrando, setCadastrando] = useState<PedidoAcesso | null>(null);

  const decidir = (p: PedidoAcesso, aprovar: boolean, msg: string) =>
    resolver.mutate({ id: p.id, aprovar }, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });

  const aprovar = (p: PedidoAcesso) => {
    // Gestor não é cadastrado pela tela (RN02: papel definido pelo hospital): só marca como atendido
    if (p.funcao === "gestor") return decidir(p, true, "Pedido marcado como atendido.");
    setCadastrando(p);
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Pedidos de acesso</h2>
        <p className="text-xs text-muted-foreground">Enviados pela tela "Cadastre-se". Aprovar abre o cadastro já preenchido; a pessoa recebe o convite por e-mail.</p>
      </div>
      {isLoading && <p className="card p-5 text-center text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="card p-5 text-center text-sm text-destructive">Erro: {error.message}</p>}
      {data?.length === 0 && <p className="card p-5 text-center text-sm text-muted-foreground">Nenhum pedido de acesso pendente.</p>}
      <div className="grade-cards">
      {data?.map((p) => (
        <div key={p.id} className="card flex flex-col gap-3 p-4 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-bold">{p.nome}</p>
            <p className="text-muted-foreground">{p.email} · {FUNCAO[p.funcao] ?? p.funcao}{p.conselho ? ` · ${p.conselho}` : ""}</p>
            <p className="text-xs text-muted-foreground">Pedido em {fmtDateTime(new Date(p.criado_em).getTime())}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-primary min-h-10 text-sm" disabled={resolver.isPending} onClick={() => aprovar(p)}><UserCheck className="h-4 w-4" aria-hidden />Aprovar</button>
            <button className="btn btn-danger min-h-10 text-sm" disabled={resolver.isPending} onClick={() => decidir(p, false, "Pedido recusado.")}><UserX className="h-4 w-4" aria-hidden />Recusar</button>
          </div>
        </div>
      ))}
      </div>
      {cadastrando && (
        <Formulario
          inicial={{
            nome: cadastrando.nome,
            email: cadastrando.email,
            categoria: cadastrando.funcao === "enfermeiro" ? "enfermeiro" : "medico",
            conselho_numero: lerConselho(cadastrando.conselho).numero,
            ...(lerConselho(cadastrando.conselho).uf ? { conselho_uf: lerConselho(cadastrando.conselho).uf! } : {}),
          }}
          onCadastrado={() => decidir(cadastrando, true, "Pedido aprovado.")}
          onClose={() => setCadastrando(null)}
        />
      )}
    </section>
  );
}
