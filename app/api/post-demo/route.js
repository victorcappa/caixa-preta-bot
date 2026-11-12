import { showState } from "@/lib/showState";
import { getRegisteredAudienceNames } from "@/lib/participants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const unavailable = () => Response.json({ error: "Reinicie o servidor para carregar o pós-demo; a apresentação em uso foi preservada." }, { status: 409 });

export async function GET() {
  if (!showState.postDemo) return unavailable();
  const state = showState.privateSnapshot();
  return Response.json({ postDemo: state.postDemo, sessionId: state.reliability.sessionId }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request) {
  if (!showState.postDemo) return unavailable();
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
      else actor.enter(getRegisteredAudienceNames());
    } else if (body.action === "ready") {
      if (state.postDemo.pauseReason === "projection-disconnected") actor.resume();
    } else if (body.action === "ack") actor.acknowledge(body.roundId);
    else if (body.action === "pause") actor.pause();
    else if (body.action === "resume") actor.resume();
    else if (body.action === "restart") actor.restart(getRegisteredAudienceNames());
    else if (body.action === "config") actor.config({ cardHoldMs: body.cardHoldMs });
    else if (body.action === "rate") { if (!actor.rate(body.roundId, body.rating)) throw new Error("Avaliação inválida."); }
    else return Response.json({ error: "AÇÃO INVÁLIDA" }, { status: 400 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Não foi possível concluir esta ação." }, { status: 500 }); }
}
