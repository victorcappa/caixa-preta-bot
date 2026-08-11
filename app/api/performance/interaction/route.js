import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const interaction = showState.addPerformanceInteraction({
      eventId: body.eventId,
      activityId: body.activityId,
      action: body.action,
      payload: body.payload
    });

    if (interaction.action === "FORBIDDEN_BUTTON_CLICK") {
      showState.queuePerformanceEvents([
        { type: "BLACKOUT", durationMs: 900 },
        { type: "FLASH_TEXT", durationMs: 260, payload: { text: "CLARO." } }
      ], "interaction");
    }

    return Response.json({ interaction });
  } catch (error) {
    console.error("PERFORMANCE INTERACTION ERROR", error);
    return Response.json({ error: "PERFORMANCE INTERACTION FAILED" }, { status: 500 });
  }
}
