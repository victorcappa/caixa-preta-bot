import { showState } from "@/lib/showState";
import { readCatalog } from "@/lib/tarot/catalog";
import { autonomousTarotTurn, generateTarotResponse } from "@/lib/tarot/service";
import { currentSession, sameOrigin } from "@/lib/tarot/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  if (showState.tarotController?.version !== 4) return Response.json({ error: "Reinicie o servidor local para carregar esta versão do treinamento; a sessão atual foi preservada." }, { status: 503 });
  const state = showState.privateSnapshot();
  return Response.json({ tarot: state.tarot, sessionId: state.reliability.sessionId,
    history: state.conversation.filter((m) => m.source?.startsWith("tarot-")).slice(-50) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request) {
  if (showState.tarotController?.version !== 4) return Response.json({ error: "TAROT_RUNTIME_RESTART_REQUIRED" }, { status: 503 });
  if (!sameOrigin(request)) return Response.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!currentSession(body)) return Response.json({ error: "TAROT_SESSION_CHANGED" }, { status: 409 });
  const { action, ...data } = body;
  try {
    if (action === "ask" || action === "analyze") {
      if (action === "analyze" && data.cardId !== undefined && data.cardId !== showState.privateSnapshot().tarot.currentCard?.id) throw new Error("TAROT_CARD_CHANGED");
      const question = action === "ask" && typeof data.question === "string" ? data.question.trim().slice(0, 4000) : "";
      if (action === "ask" && !question) throw new Error("TAROT_QUESTION_EMPTY");
      return Response.json(await generateTarotResponse({ requestId: data.requestId, question, automatic: action === "analyze" && data.automatic === true }));
    }
    if (action === "next") return Response.json(await autonomousTarotTurn(Number.isInteger(data.cardId) ? data.cardId : null));
    if (action === "contingency") {
      const currentId = showState.privateSnapshot().tarot.currentCard?.id;
      const card = (await readCatalog()).find((c) => c.id === currentId);
      return Response.json(showState.controlTarot(action, { text: card?.contingency }));
    }
    if (action === "select") {
      if (data.source === "bot") throw new Error("TAROT_ACTION_UNKNOWN");
      const catalog=await readCatalog();
      const ids=Array.isArray(data.cardIds)?[...new Set(data.cardIds)].slice(0,2):[data.cardId];
      const cards=ids.map((id)=>catalog.find((c)=>c.id===id&&c.imageUrl));
      if(!cards.length||cards.some((c)=>!c))throw new Error("TAROT_REFERENCE_MISSING");
      cards.sort((a,b)=>a.id-b.id);const card=cards[0];
      // Explicit human selection pauses autonomy. Camera results cannot replace bot-selected images.
      if (data.source === "camera" && showState.privateSnapshot().tarot.autonomy.status !== "off") return Response.json({ ignored: true });
      if (data.source !== "camera" && data.source !== "bot") showState.controlTarot("human");
      return Response.json(showState.controlTarot(action, { ...data, card,cards }));
    }
    if (action === "end") {
      const result = showState.controlTarot("end");
      for (const window of Object.values(showState.snapshot().projection.windows || {})) {
        if (window.connected && window.currentPath?.split("?")[0] === "/treinamento") showState.navigateProjectionWindow({ id: window.id, path: "/" });
      }
      return Response.json(result);
    }
    if (["autonomy-card", "catalog-updated", "restore-presentation", "bot"].includes(action)) throw new Error("TAROT_ACTION_UNKNOWN");
    return Response.json(showState.controlTarot(action, data));
  } catch (error) {
    return Response.json({ error: /^TAROT_[A-Z_]+$/.test(error.message || "") ? error.message : "TAROT_COMMAND_FAILED" }, { status: 409 });
  }
}
