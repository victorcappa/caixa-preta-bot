import { projectionScreens } from "@/lib/projectionScreens";
import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const snapshot = showState.snapshot();
  return Response.json({
    screens: projectionScreens,
    projection: snapshot.projection
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = `${body.action || ""}`.toLowerCase();

    if (action === "register") {
      const result = showState.registerProjectionWindow({
        id: body.projectionWindowId,
        path: body.path,
        userAgent: request.headers.get("user-agent")
      });

      return projectionResponse(result, "PROJECTION REGISTERED");
    }

    if (action === "heartbeat") {
      const result = showState.heartbeatProjectionWindow({
        id: body.projectionWindowId,
        path: body.path
      });

      return projectionResponse(result, "PROJECTION CONNECTED");
    }

    if (action === "disconnect") {
      const result = showState.disconnectProjectionWindow(body.projectionWindowId);
      return projectionResponse(result, "PROJECTION DISCONNECTED");
    }

    if (action === "navigate") {
      const result = showState.navigateProjectionWindow({
        id: body.projectionWindowId,
        path: body.path
      });

      return projectionResponse(result, `PROJECTION -> ${result.command?.label || body.path || "-"}`);
    }

    return Response.json({ error: "PROJECTION ACTION UNKNOWN" }, { status: 400 });
  } catch {
    return Response.json({ error: "PROJECTION REQUEST INVALID" }, { status: 400 });
  }
}

function projectionResponse(result, message) {
  if (!result.applied) {
    const status = result.error === "PROJECTION WINDOW DISCONNECTED" ? 409 : 400;
    return Response.json({ error: result.error, state: result.state }, { status });
  }

  return Response.json({
    message,
    state: result.state,
    command: result.command || null
  });
}
