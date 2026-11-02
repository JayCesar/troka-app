// PONTO DE INTEGRAÇÃO — mover plantão no calendário (arrastar e soltar).
// A tela só conhece `moverPlantao`; trocar a implementação (outro endpoint, fila, etc.) é mudar só este arquivo.
// Hoje usa a RPC `editar_plantao` (B2): só gestor do setor (RN05), só antes do início, sem anúncio/candidatura
// em aberto, e revalida RN12–RN14 do profissional. Erros vêm com a mensagem da regra e a UI reverte o card.
import { supabase } from "../supabase";
import type { Plantao } from "../api/plantoes";

export interface Movimento {
  plantao: Plantao;
  novoInicio: Date; // a duração do plantão é preservada
}

export async function moverPlantao({ plantao, novoInicio }: Movimento): Promise<void> {
  const duracao = new Date(plantao.fim).getTime() - new Date(plantao.inicio).getTime();
  const { error } = await supabase.rpc("editar_plantao", {
    p_id: plantao.id,
    p_especialidade_id: plantao.especialidade_id,
    p_inicio: novoInicio.toISOString(),
    p_fim: new Date(novoInicio.getTime() + duracao).toISOString(),
    ...(plantao.profissional_id ? { p_profissional_id: plantao.profissional_id } : {}),
  });
  if (error) throw new Error(error.message);
}
