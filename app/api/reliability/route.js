import { getExistingInstagramController } from "@/lib/instagram/InstagramController";
import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json({ reliability: showState.snapshot().reliability });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const action = `${body.action || ""}`;
  const allowed = new Set(["emergency-on", "emergency-off", "public-error"]);
  if (!allowed.has(action)) return Response.json({ error: "RELIABILITY_ACTION_UNKNOWN" }, { status: 400 });

  const result = showState.controlReliability(action, body, {
    source: action === "public-error" ? "public-error-boundary" : "operator"
  });

  if (action === "emergency-on") {
    const instagram = getExistingInstagramController();
    if (instagram) {
      await instagram.stopAllRoutines().catch(() => null);
      showState.updateInstagram({
        ...instagram.getStatus(),
        status: "DISCONNECTED",
        message: "modo emergência"
      });
    }
  }

  return Response.json(result, { status: result.ok ? 200 : 400 });
}
