import { applyHangmanGuess } from "@/lib/activities";
import { generateCaixaPretaTurn } from "@/lib/openai";
import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const message = body.message?.trim();

    if (!message) {
      return Response.json({ error: "Mensagem vazia." }, { status: 400 });
    }

    if (message === "/reset") {
      showState.reset();
      return Response.json({ command: "reset", message: "SESSION RESET" });
    }

    if (message.startsWith("/")) {
      return Response.json({ error: `Comando desconhecido: ${message}` }, { status: 400 });
    }

    showState.addMessage("user", message, "projection");

    const activeHangman = showState.snapshot().performance.activities.find((activity) => (
      activity.type === "HANGMAN" && activity.status === "active"
    ));
    if (activeHangman && /^[\p{L}0-9]{1,18}$/u.test(message)) {
      const result = applyHangmanGuess(activeHangman, message);
      if (result) {
        showState.updateActivity(result.activity, { source: "public", result: result.result });
        showState.queuePerformanceEvents(result.events, "activity");
      }
    }

    const turn = await generateCaixaPretaTurn({
      state: showState.snapshot(),
      userMessage: message
    });

    if (turn.salience.length) {
      showState.addSalience(turn.salience, "agent");
    }

    if (turn.activity?.type === "HANGMAN" && turn.activity?.action === "start") {
      showState.startHangmanActivity({ word: turn.activity.word, source: "agent" });
    }

    const assistantMessage = turn.text
      ? showState.addMessage("assistant", turn.text, "openai")
      : null;

    if (turn.events.length) {
      showState.queuePerformanceEvents(turn.events, "agent");
    }

    return Response.json({ message: assistantMessage, events: turn.events });
  } catch (error) {
    console.error("CHAT ERROR", error);
    return Response.json(
      { error: "A Caixa Preta nao respondeu agora." },
      { status: 500 }
    );
  }
}
