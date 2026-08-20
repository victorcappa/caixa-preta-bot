import { showState } from "@/lib/showState";
import { loadBaralhoMorbidoCards } from "@/lib/baralho-morbido/assets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function refreshCards(source) {
  return showState.syncBaralhoMorbidoCards(loadBaralhoMorbidoCards(), { source });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("refresh") === "1") {
    refreshCards("open");
  }

  const snapshot = showState.snapshot();
  return Response.json({
    ...snapshot.baralhoMorbido,
    displayBlackout: snapshot.displayBlackout
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = `${body.action || ""}`.toLowerCase();

    if (action === "draw" || action === "next") {
      const refreshed = refreshCards("draw");
      if (!refreshed.state.totalCards) {
        return Response.json({
          error: "NENHUM VIDEO ENCONTRADO EM assets/videos/baralho-morbido",
          state: refreshed.state
        }, { status: 400 });
      }

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
      const cards = loadBaralhoMorbidoCards();
      const state = showState.resetBaralhoMorbido({ source: "controller", cards });
      return Response.json({
        message: "BARALHO RESETADO",
        state
      });
    }

    if (action === "refresh-assets") {
      const result = refreshCards("open");
      return Response.json({
        message: `${result.state.totalCards} VIDEOS CARREGADOS`,
        state: result.state
      });
    }

    if (action === "display-connect") {
      refreshCards("display-open");
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
