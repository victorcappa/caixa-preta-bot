import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json({ audienceWarmup: showState.snapshot().audienceWarmup });
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (`${body.action || ""}`.startsWith("unlock-")) {
      const result = showState.controlPlayUnlock(body.action.slice("unlock-".length), body, { source: "operator" });
      if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
      return Response.json({ message: result.message, unlock: result.state });
    }
    const result = showState.controlAudienceWarmup(body.action, body, { source: "operator" });
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
    return Response.json({ message: result.message, audienceWarmup: result.state });
  } catch (error) {
    return Response.json({ error: error.message || "WARMUP ERROR" }, { status: 400 });
  }
}
