import { showState } from "@/lib/showState";
import { saveQuedaAviaoDefaults } from "@/lib/queda-aviao/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json(showState.snapshot().quedaAviao);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = `${body.action || ""}`.toLowerCase();

    if (action === "display-connect") {
      const state = showState.setQuedaAviaoDisplayConnection(true);
      return Response.json({
        message: "QUEDA AVIAO DISPLAY CONNECTED",
        state
      });
    }

    if (action === "display-disconnect") {
      const state = showState.setQuedaAviaoDisplayConnection(false);
      return Response.json({
        message: "QUEDA AVIAO DISPLAY DISCONNECTED",
        state
      });
    }

    if (action === "save-default") {
      const defaults = saveQuedaAviaoDefaults(showState.snapshot().quedaAviao);
      return Response.json({
        message: "QUEDA AVIAO PADRÃO SALVO",
        defaults,
        state: showState.snapshot().quedaAviao
      });
    }

    const result = showState.controlQuedaAviao(action, body.payload || body, { source: "controller" });

    if (!result.applied) {
      return Response.json({
        error: result.error,
        state: result.state
      }, { status: 400 });
    }

    return Response.json({
      message: `QUEDA AVIAO ${action || "UPDATE"}`,
      state: result.state
    });
  } catch {
    return Response.json({ error: "QUEDA AVIAO REQUEST INVALID" }, { status: 400 });
  }
}
