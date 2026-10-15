import { randomUUID } from "node:crypto";
import { showState } from "@/lib/showState";
import { streamOperatorReply } from "@/lib/openai";
import { markStopAll } from "@/lib/stopAllSignal";
import { abortExternalRequests } from "@/lib/externalRequestControl";
import { retireInstagramController } from "@/lib/instagram/InstagramController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fallbackReply = "Perdi o fio. Continue. Eu alcanço vocês.";
const fallbackReturn = "Está bem. Eu volto. Mas não confunda isso com obediência.";

async function generate(job) {
  // Coalesce genuine model deltas to at most 20 snapshots/sec; clients pace their display.
  let buffer = "";
  let timer;
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    if (buffer) showState.appendOperatorDelta(job.requestId, buffer);
    buffer = "";
  };
  try {
    const result = await streamOperatorReply({
      state: showState.privateSnapshot(), signal: job.controller.signal, returning: job.returning,
      onDelta: (delta) => {
        buffer += delta;
        if (!timer) timer = setTimeout(flush, 50);
      }
    });
    flush();
    showState.finishOperatorGeneration(job.requestId, result);
  } catch (error) {
    flush();
    showState.finishOperatorGeneration(job.requestId, {
      error: error?.code || "GENERATION_UNAVAILABLE",
      replaceWithFallback: job.returning,
      fallback: job.returning ? fallbackReturn : fallbackReply
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request) {
  // Existing deployment is a local operator system, without account authentication.
  // Reject cross-origin browser writes; the projected component has no write handlers.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || new URL(request.url).host;
  if (origin && new URL(origin).host !== host) {
    return Response.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "INVALID_BODY" }, { status: 400 });
  if (body.action === "patch") {
    const operatorPublic = showState.patchOperatorPublic(body);
    return Response.json({ operatorPublic });
  }
  if (body.action === "cancel") {
    showState.cancelOperatorGeneration();
    return Response.json({ ok: true });
  }
  if (!["send", "return"].includes(body.action)) return Response.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  const returning = body.action === "return";
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!returning && !text) return Response.json({ error: "EMPTY_MESSAGE" }, { status: 400 });
  const requestId = typeof body.requestId === "string" && /^[\w-]{1,100}$/.test(body.requestId) ? body.requestId : randomUUID();
  if (showState.privateSnapshot().operatorPublic.messages.some(({ id }) => id === (returning ? `bot-${requestId}` : requestId))) {
    return Response.json({ ok: true, duplicate: true });
  }
  if (returning) {
    // Authority is deterministic and precedes the model, including when OpenAI fails.
    markStopAll();
    abortExternalRequests("RETURN_TO_PLAY");
    showState.cancelOperatorGeneration();
    const controller = retireInstagramController();
    showState.retireInstagramController(controller?.controllerId);
    showState.controlSceneZero("instagram-session-stop", {}, { source: "operator" });
    showState.controlSceneZero("instagram-stop", {}, { source: "operator" });
    // Closing this browser ends pending Playwright actions. Do not await it to regain control.
    if (controller) void controller.close().catch(() => {});
  }
  const job = showState.beginOperatorGeneration({ requestId, text, returning });
  if (job.busy) return Response.json({ error: "GENERATION_BUSY" }, { status: 409 });
  if (job.duplicate) return Response.json({ ok: true, duplicate: true });
  // The existing SSE carries tokens to all screens; control requests stay independent.
  await generate(job);
  return Response.json({ ok: true, operatorPublic: showState.snapshot().operatorPublic,
    generationError: showState.privateSnapshot().operatorPublic.error });
}
