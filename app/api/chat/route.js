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

    showState.cancelPerformanceEvents({
      type: "COUNTDOWN",
      reason: "public_message",
      source: "projection"
    });

    showState.addMessage("user", message, "projection");

    const suitcaseWasActive = showState.snapshot().suitcase?.active;
    let suitcaseAdvance = null;

    if (suitcaseWasActive) {
      suitcaseAdvance = showState.advanceSuitcases(message, { source: "public" });
    }

    const gameWasActive = showState.snapshot().game?.active;
    let gameAdvance = null;

    if (!suitcaseWasActive && gameWasActive) {
      gameAdvance = showState.advanceGame(message, { source: "public" });
    } else if (!suitcaseWasActive) {
      const opportunity = showState.getGameOpportunity(message);
      if (opportunity.shouldStartAutomatic) {
        showState.startGame({ source: "automatic" });
      }
    }

    const activeHangman = showState.snapshot().performance.activities.find((activity) => (
      activity.type === "HANGMAN" && activity.status === "active"
    ));
    if (!suitcaseWasActive && !gameWasActive && activeHangman && /^[\p{L}0-9]{1,18}$/u.test(message)) {
      const result = applyHangmanGuess(activeHangman, message);
      if (result) {
        showState.updateActivity(result.activity, { source: "public", result: result.result });
        showState.queuePerformanceEvents(result.events, "activity");
      }
    }

    const turn = await generateCaixaPretaTurn({
      state: showState.privateSnapshot(),
      userMessage: [
        message,
        gameAdvance?.result ? `GAME_ADVANCE_RESULT:\n${JSON.stringify(gameAdvance.result)}` : "",
        suitcaseAdvance?.result ? `SUITCASE_ADVANCE_RESULT:\n${JSON.stringify(suitcaseAdvance.result)}` : ""
      ].filter(Boolean).join("\n\n")
    });

    if (turn.suitcase && showState.snapshot().suitcase?.active) {
      showState.applySuitcaseMove(turn.suitcase, { source: "agent" });
    }

    if (turn.salience.length) {
      showState.addSalience(turn.salience, "agent");
    }

    if (turn.activity?.type === "HANGMAN" && turn.activity?.action === "start") {
      showState.startHangmanActivity({ word: turn.activity.word, source: "agent" });
    }

    const currentGame = showState.snapshot().game;
    if (!showState.snapshot().suitcase?.active && turn.game?.startGame && !currentGame?.active && (currentGame?.cooldownTurnsRemaining || 0) <= 0) {
      showState.startGame({
        requestedGame: turn.game.requestedGame || turn.game.gameSuggestion || null,
        source: "ai"
      });
    } else if (!showState.snapshot().suitcase?.active && turn.game?.gameMove && showState.snapshot().game?.active) {
      showState.applyGameMove(turn.game, { source: "agent" });
    }

    const assistantMessage = turn.text
      ? showState.addMessage("assistant", turn.text, "openai")
      : null;

    if (turn.events.length) {
      showState.queuePerformanceEvents(turn.events, "agent");
    }

    showState.completeTurnGameTick();

    return Response.json({ message: assistantMessage, events: turn.events });
  } catch (error) {
    console.error("CHAT ERROR", error);
    return Response.json(
      { error: "A Caixa Preta nao respondeu agora." },
      { status: 500 }
    );
  }
}
