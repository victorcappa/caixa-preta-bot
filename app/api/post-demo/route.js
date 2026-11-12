import { showState } from "@/lib/showState";
import { normalizePostDemoConfig, POST_DEMO_SETTINGS_VERSION, POST_DEMO_RUNTIME_VERSION } from "@/lib/post-demo/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const unavailable = () => Response.json({ error: "Reinicie o servidor para carregar o pós-demo; a apresentação em uso foi preservada." }, { status: 409 });

export async function GET() {
  if (!showState.postDemo || showState.postDemo.runtimeVersion !== POST_DEMO_RUNTIME_VERSION) return unavailable();
  const state = showState.privateSnapshot();
  return Response.json({ postDemo: { ...state.postDemo, config: normalizePostDemoConfig(state.postDemo.config) }, sessionId: state.reliability.sessionId }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request) {
  if (!showState.postDemo || showState.postDemo.runtimeVersion !== POST_DEMO_RUNTIME_VERSION) return unavailable();
  const origin = request.headers.get("origin"), host = request.headers.get("host") || new URL(request.url).host;
  try { if (origin && new URL(origin).host !== host) throw new Error(); }
  catch { return Response.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 }); }
  const body = await request.json().catch(() => null), state = showState.privateSnapshot();
  if (!body || body.sessionId !== state.reliability.sessionId) return Response.json({ error: "A apresentação mudou. Atualize esta tela." }, { status: 409 });
  if (state.reliability.emergencyMode?.active && !["pause", "rate", "config"].includes(body.action)) return Response.json({ error: "Modo emergência ativo." }, { status: 409 });
  const actor = showState.postDemo;
  try {
    if (body.action === "enter") {
      if (state.postDemo.pauseReason === "projection-left") actor.resume();
      else actor.enter();
    } else if (body.action === "ready") {
      if (state.postDemo.pauseReason === "projection-disconnected") actor.resume();
    } else if (body.action === "ack") actor.acknowledge(body.roundId);
    else if (body.action === "pause") actor.pause();
    else if (body.action === "resume") actor.resume();
    else if (body.action === "restart") actor.restart();
    else if (body.action === "cloud-replay") {
      if (!actor.replayCloud) return unavailable();
      actor.replayCloud();
    }
    else if (body.action === "config") {
      if (actor.settingsVersion !== POST_DEMO_SETTINGS_VERSION) return unavailable();
      actor.config(body.config && typeof body.config === "object" && !Array.isArray(body.config) ? body.config : { cardHoldMs: body.cardHoldMs });
    }
    else if (body.action === "rate") { if (!actor.rate(body.roundId, body.rating)) throw new Error("Avaliação inválida."); }
    else return Response.json({ error: "AÇÃO INVÁLIDA" }, { status: 400 });
    return Response.json({ ok: true, ...(body.action === "config" ? { config: showState.privateSnapshot().postDemo.config } : {}) });
  } catch { return Response.json({ error: "Não foi possível concluir esta ação." }, { status: 500 }); }
}
