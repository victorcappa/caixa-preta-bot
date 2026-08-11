import { generateCaixaPretaTurn } from "@/lib/openai";
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

    if (interaction.action === "countdown_complete") {
      const completion = showState.completePerformanceEvent(interaction.eventId, interaction.action);

      if (!completion.completed || completion.event.type !== "COUNTDOWN") {
        return Response.json({ interaction, ignored: true });
      }

      const turn = await generateCaixaPretaTurn({
        state: showState.snapshot(),
        operatorInstruction: [
          "Uma contagem exibida na projecao acabou agora.",
          "Continue a conversa automaticamente, sem esperar comando do operador.",
          "Reaja ao fim da contagem como acontecimento real da cena.",
          "Nao diga que recebeu um evento tecnico.",
          "Se a fala anterior criou uma acao para o publico, avance para a consequencia ou proxima escolha."
        ].join(" ")
      });

      if (turn.salience.length) {
        showState.addSalience(turn.salience, "agent");
      }

      showState.addMessage("assistant", turn.text, "countdown");

      if (turn.events.length) {
        showState.queuePerformanceEvents(turn.events, "agent");
      }

      return Response.json({ interaction, message: turn.text });
    }

    return Response.json({ interaction });
  } catch (error) {
    console.error("PERFORMANCE INTERACTION ERROR", error);
    return Response.json({ error: "PERFORMANCE INTERACTION FAILED" }, { status: 500 });
  }
}
