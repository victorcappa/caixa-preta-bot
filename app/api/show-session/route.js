import { showState } from "@/lib/showState";
import { readSnapshot } from "@/lib/showSessionPersistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sessionStatus(result) {
  if (result.status !== "available") {
    return {
      status: result.status,
      recoverable: false,
      reason: result.reason || null,
      snapshot: null
    };
  }

  const currentBootId = showState.snapshot().reliability?.bootId;
  const recoverable = result.envelope.bootId !== currentBootId;
  return {
    status: recoverable ? "interrupted" : "current",
    recoverable,
    reason: null,
    snapshot: recoverable ? {
      sessionId: result.envelope.sessionId,
      savedAt: result.envelope.savedAt,
      revision: result.envelope.revision,
      summary: result.envelope.summary
    } : null
  };
}

export async function GET() {
  const result = await readSnapshot({ expectedStoreVersion: showState._storeVersion });
  return Response.json(sessionStatus(result));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const action = `${body.action || ""}`;

  if (action === "new") {
    const result = showState.startNewPresentation();
    return Response.json(result);
  }

  if (action === "resume") {
    const stored = await readSnapshot({ expectedStoreVersion: showState._storeVersion });
    if (stored.status !== "available") {
      return Response.json({ error: stored.reason || "SNAPSHOT_UNAVAILABLE" }, { status: 409 });
    }
    if (stored.envelope.bootId === showState.snapshot().reliability?.bootId) {
      return Response.json({ ok: true, message: "APRESENTAÇÃO JÁ ESTÁ ATIVA", state: showState.snapshot() });
    }
    const result = showState.restoreFromRecovery(stored.envelope);
    return Response.json(result, { status: result.ok ? 200 : 409 });
  }

  return Response.json({ error: "SHOW_SESSION_ACTION_UNKNOWN" }, { status: 400 });
}
