import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json(showState.snapshot().baralhoMorbido);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = `${body.action || ""}`.toLowerCase();

    if (action === "draw" || action === "next") {
      const result = showState.drawBaralhoMorbidoCard({ source: "controller" });

      if (!result.applied) {
        const status = result.reason === "busy" ? 409 : 400;
        return Response.json({
          error: result.reason === "busy" ? "BARALHO BUSY" : "TODAS AS CARTAS FORAM REVELADAS",
          state: result.state
        }, { status });
      }

      return Response.json({
        message: `CARTA ${result.card.id} SORTEADA`,
        state: result.state
      });
    }

    if (action === "reset") {
      const state = showState.resetBaralhoMorbido({ source: "controller" });
      return Response.json({
        message: "BARALHO RESETADO",
        state
      });
    }

    if (action === "display-connect") {
      const state = showState.setBaralhoMorbidoDisplayConnection(true);
      return Response.json({
        message: "BARALHO DISPLAY CONNECTED",
        state
      });
    }

    if (action === "display-disconnect") {
      const state = showState.setBaralhoMorbidoDisplayConnection(false);
      return Response.json({
        message: "BARALHO DISPLAY DISCONNECTED",
        state
      });
    }

    return Response.json({ error: "BARALHO ACTION UNKNOWN" }, { status: 400 });
  } catch {
    return Response.json({ error: "BARALHO REQUEST INVALID" }, { status: 400 });
  }
}
