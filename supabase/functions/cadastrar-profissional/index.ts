// Edge Function: cadastro de profissional pelo gestor (RN01, RN01b, RN02).
// Fluxo: autentica o gestor → valida entrada → valida conselho (RN01b) → convida por e-mail →
// grava o perfil via RPC interna (regras no banco). Se o perfil falhar, desfaz o convite.
// A service_role só existe aqui (variável de ambiente do runtime); nunca no front.
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

import { type Categoria, UFS, validarConselho } from "./validacao.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:5173";
const MODO = Deno.env.get("CONSELHO_VALIDACAO") ?? "real"; // B10/P3: padrão seguro

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const erro = (status: number, message: string) => json({ error: message }, status);

interface Entrada {
  nome: string;
  email: string;
  categoria: Categoria;
  especialidade_id: string;
  conselho_numero: string;
  conselho_uf: string;
}

// Validação de entrada na borda (o banco revalida vínculo, unicidade e categoria)
function lerEntrada(b: Record<string, unknown>): Entrada | string {
  const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const e: Entrada = {
    nome: s("nome"),
    email: s("email").toLowerCase(),
    categoria: s("categoria") as Categoria,
    especialidade_id: s("especialidade_id"),
    conselho_numero: s("conselho_numero").replace(/\D/g, ""),
    conselho_uf: s("conselho_uf").toUpperCase(),
  };
  if (e.nome.length < 3) return "Informe o nome completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)) return "E-mail inválido.";
  if (e.categoria !== "medico" && e.categoria !== "enfermeiro") return "Categoria deve ser médico ou enfermeiro.";
  if (!/^[0-9a-f-]{36}$/i.test(e.especialidade_id)) return "Especialidade inválida.";
  if (e.conselho_numero.length < 3 || e.conselho_numero.length > 10) return "Número do conselho inválido.";
  if (!UFS.includes(e.conselho_uf)) return "UF do conselho inválida.";
  return e;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro(405, "Método não permitido.");

  try {
    // 1. Quem chama? (JWT do usuário logado; perfil lido com RLS)
    const authHeader = req.headers.get("Authorization") ?? "";
    const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: u, error: authErr } = await comoUsuario.auth.getUser();
    if (authErr || !u.user) return erro(401, "Sessão inválida. Entre novamente.");
    const { data: gestor } = await comoUsuario.from("perfil").select("id, papel").eq("id", u.user.id).maybeSingle();
    if (gestor?.papel !== "gestor") return erro(403, "RN01: só o gestor cadastra profissionais.");

    // 2. Entrada
    const entrada = lerEntrada(await req.json().catch(() => ({})));
    if (typeof entrada === "string") return erro(400, entrada);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // 3a. E-mail livre, especialidade da categoria e conselho livre? (antes de qualquer efeito colateral)
    const { data: impedimento, error: prevErr } = await admin.rpc("cadastro_verificar", {
      p_email: entrada.email,
      p_categoria: entrada.categoria,
      p_especialidade_id: entrada.especialidade_id,
      p_conselho_uf: entrada.conselho_uf,
      p_conselho_numero: entrada.conselho_numero,
    });
    if (prevErr) throw prevErr;
    if (impedimento) return erro(impedimento.startsWith("RN01:") ? 400 : 409, impedimento);

    // 3b. RN01b: valida o conselho ANTES de criar qualquer coisa
    const v = await validarConselho(entrada.categoria, entrada.conselho_numero, entrada.conselho_uf, MODO);
    if (!v.ok) {
      console.warn("[cadastrar-profissional] conselho recusado", { modo: MODO, motivo: v.motivo });
      return erro(422, v.motivo);
    }

    // 4. Convite por e-mail (a pessoa define a própria senha em /definir-senha)
    const inicio = Date.now();
    const { data: convite, error: conviteErr } = await admin.auth.admin.inviteUserByEmail(entrada.email, {
      redirectTo: `${SITE_URL}/definir-senha`,
      data: { nome: entrada.nome },
    });
    if (conviteErr || !convite.user) {
      const jaExiste = /already|registered|exists/i.test(conviteErr?.message ?? "");
      return erro(jaExiste ? 409 : 502, jaExiste ? "Já existe um usuário com este e-mail." : `Falha ao enviar convite: ${conviteErr?.message}`);
    }

    // 5. Perfil com as regras do banco; em falha, desfaz o convite (sem usuário órfão)
    const { data: perfil, error: perfilErr } = await admin.rpc("cadastrar_profissional_interno", {
      p_gestor_id: gestor.id,
      p_usuario_id: convite.user.id,
      p_nome: entrada.nome,
      p_categoria: entrada.categoria,
      p_especialidade_id: entrada.especialidade_id,
      p_conselho_numero: entrada.conselho_numero,
      p_conselho_uf: entrada.conselho_uf,
      p_validacao: v.status,
    });
    if (perfilErr) {
      // Só desfaz se o usuário nasceu NESTA chamada (nunca apaga quem já existia — ex.: corrida com outro cadastro)
      const criadoAgora = new Date(convite.user.created_at).getTime() >= inicio - 5_000;
      if (criadoAgora) {
        const { error: delErr } = await admin.auth.admin.deleteUser(convite.user.id);
        if (delErr) console.error("[cadastrar-profissional] falha ao desfazer convite", { user: convite.user.id, delErr });
      } else {
        console.error("[cadastrar-profissional] perfil falhou para usuário pré-existente; nada foi apagado", { user: convite.user.id });
      }
      return erro(422, perfilErr.message);
    }

    console.info("[cadastrar-profissional] cadastrado", { gestor: gestor.id, perfil: perfil.id, validacao: v.status, modo: MODO });
    return json({ perfil, validacao: v.status, modo: MODO }, 201);
  } catch (e) {
    console.error("[cadastrar-profissional] erro inesperado", e);
    return erro(500, "Erro inesperado no cadastro.");
  }
});
