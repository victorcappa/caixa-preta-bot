import { randomUUID } from "node:crypto";
import { showState } from "@/lib/showState";
import { streamLiveTrainingReply, generateLiveTrainingAlternatives } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function restartRequired() {
  return Response.json({ error: "O servidor precisa ser reiniciado para carregar o treino ao vivo. Recarregue esta página depois." }, { status: 409 });
}

export async function GET() {
  if (!showState.liveTraining) return restartRequired();
  const state = showState.privateSnapshot();
  return Response.json({ liveTraining: state.liveTraining, robotSound: state.robotSound, sessionId: state.reliability.sessionId });
}

export async function POST(request) {
  if (!showState.liveTraining) return restartRequired();
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || new URL(request.url).host;
  if (origin) {
    try { if (new URL(origin).host !== host) throw new Error("ORIGIN_NOT_ALLOWED"); }
    catch { return Response.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 }); }
  }
  const body = await request.json().catch(() => null);
  if (!body || !["send", "rate", "alternatives"].includes(body.action)) return Response.json({ error: "AÇÃO INVÁLIDA" }, { status: 400 });
  const state = showState.privateSnapshot();
  if (body.sessionId !== state.reliability.sessionId) return Response.json({ error: "A apresentação mudou. Atualize a página." }, { status: 409 });
  if (body.action === "rate") {
    try {
      const result = showState.liveTraining.rate(body.messageId, body.rating);
      return Response.json(result.error ? result : { liveTraining: showState.privateSnapshot().liveTraining }, { status: result.error ? 400 : 200 });
    } catch {
      return Response.json({ error: "Não foi possível salvar a avaliação. Tente novamente." }, { status: 500 });
    }
  }
  if (state.reliability.emergencyMode?.active) return Response.json({ error: "Modo emergência ativo." }, { status: 409 });
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (body.action === "send" && !text) return Response.json({ error: "Escreva uma mensagem." }, { status: 400 });
  if (body.action === "alternatives" && (typeof body.messageId !== "string" || !body.messageId.trim())) return Response.json({ error: "Resposta inválida." }, { status: 400 });
  const requestId = typeof body.requestId === "string" && /^[\w-]{1,100}$/.test(body.requestId) ? body.requestId : randomUUID();
  const job = showState.liveTraining.begin({ requestId, text, parentId: body.action === "alternatives" ? body.messageId : null });
  if (job.busy || job.error) return Response.json({ error: job.error || "Aguarde a resposta atual." }, { status: 409 });
  if (job.duplicate) return Response.json({ liveTraining: showState.privateSnapshot().liveTraining });
  let buffer = "", timer;
  const flush = () => { clearTimeout(timer); timer = null; if (buffer) showState.liveTraining.append(job, buffer); buffer = ""; };
  try {
    const current = showState.privateSnapshot();
    if (job.parentId) {
      const alternatives = await generateLiveTrainingAlternatives({ state: current, parentId: job.parentId, signal: job.controller.signal });
      showState.liveTraining.finish(job, { alternatives });
    } else {
      await streamLiveTrainingReply({ state: current, signal: job.controller.signal, onDelta: delta => {
        buffer += delta;
        if (!timer) timer = setTimeout(flush, 50);
      } });
      flush();
      showState.liveTraining.finish(job);
    }
    return Response.json({ liveTraining: showState.privateSnapshot().liveTraining });
  } catch {
    flush();
    const error = job.controller.signal.aborted ? "Resposta interrompida." : "Não foi possível gerar a resposta. Tente novamente.";
    showState.liveTraining.finish(job, { error });
    return Response.json({ error, liveTraining: showState.privateSnapshot().liveTraining }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
