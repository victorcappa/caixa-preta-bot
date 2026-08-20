import { getExistingInstagramController, getInstagramController } from "@/lib/instagram/InstagramController";
import { generateCaixaPretaTurn } from "@/lib/openai";
import { buildSceneZeroDirection } from "@/lib/scene-zero/state";
import { showState } from "@/lib/showState";
import { SHOW_MODES } from "@/prompts/modes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SPEECH_ACTIONS = new Set([
  "collection-new-question",
  "collection-rephrase",
  "collection-comment",
  "collection-end",
  "participant-volunteers",
  "choose-participant",
  "choose-another-participant",
  "cake-comment",
  "cake-provoke",
  "cake-end",
  "glitch-speak",
  "instagram-stop"
]);

const DIRECTION_ACTIONS = {
  "collection-new-question": "collection_new_question",
  "collection-rephrase": "collection_rephrase",
  "collection-comment": "collection_comment",
  "collection-end": "collection_end",
  "participant-volunteers": "enter_participant",
  "choose-participant": "choose_participant",
  "choose-another-participant": "choose_participant",
  "cake-comment": "cake_comment",
  "cake-provoke": "cake_provoke",
  "cake-end": "cake_end",
  "glitch-speak": "glitch_level",
  "instagram-stop": "instagram_stop"
};

const STAGE_DIRECTIONS = {
  collection: "enter_collection",
  participant: "enter_participant",
  suitcases: "enter_suitcases",
  cake: "enter_cake",
  singing: "enter_singing",
  glitch: "enter_glitch",
  instagram: "enter_instagram",
  collapse: "enter_collapse",
  airport: "enter_airport",
  tea: "enter_tea"
};

function requestedActionFromText(text = "") {
  const match = text.match(/\b(?:levante(?:m)?|bata(?:m)?|aponte(?:m)?|fique(?:m)?|faça(?:m)?|responda(?:m)?|diga(?:m)?|estenda(?:m)?|acene(?:m)?)[^.!?]*/iu);
  return match?.[0]?.trim() || "ação coletiva descrita na fala projetada";
}

function applyGeneratedTurn(turn) {
  if (turn.salience?.length) showState.addSalience(turn.salience, "agent");
  if (turn.game?.gameMove && showState.snapshot().game?.active) {
    showState.applyGameMove(turn.game, { source: "agent" });
  }
  if (turn.suitcase && showState.snapshot().suitcase?.active) {
    showState.applySuitcaseMove(turn.suitcase, { source: "agent" });
  }
  if (turn.text) showState.addMessage("assistant", turn.text, "scene-zero-operator");
  if (turn.events?.length) showState.queuePerformanceEvents(turn.events, "agent");
}

async function speak(directionAction, detail = "") {
  const state = showState.privateSnapshot();
  const turn = await generateCaixaPretaTurn({
    state,
    operatorInstruction: buildSceneZeroDirection(state.sceneZero, directionAction, detail)
  });
  applyGeneratedTurn(turn);
  return turn;
}

function applyGlitchLevel(level) {
  if (level === "normal") {
    showState.controlGlitch("stop", {}, { source: "scene-zero" });
    return;
  }

  const settings = {
    "glitch-1": { preset: "normal", params: { intensity: 0.22, frequency: 0.28, jitter: 0.2, flicker: 0.16 } },
    "glitch-2": { preset: "normal", params: { intensity: 0.42, frequency: 0.48, jitter: 0.38, flicker: 0.3 } },
    "glitch-3": { preset: "continuous", params: { intensity: 0.62, frequency: 0.7, jitter: 0.62, distortion: 0.48 } },
    "glitch-4": { preset: "strong", params: { intensity: 0.84, frequency: 0.88, jitter: 0.86, distortion: 0.72 } },
    collapse: { preset: "strong", params: { intensity: 1, frequency: 1, jitter: 1, distortion: 0.94, flicker: 0.92, blockCount: 28 } }
  };
  showState.controlGlitch("continuous", settings[level], { source: "scene-zero" });
}

async function enterStage(stage, detail) {
  const changed = showState.controlSceneZero("set-stage", { stage, detail }, { source: "operator" });
  if (!changed.applied) return changed;

  if (stage === "suitcases") {
    showState.setMode(SHOW_MODES.malas);
    if (!showState.snapshot().suitcase?.active) showState.startSuitcases({ source: "scene-zero-operator" });
  }

  if (stage === "cake") {
    const game = showState.snapshot().game;
    if (!game?.active || game.id !== "verdade_ou_bolo") {
      showState.startGame({ requestedGame: "verdade-ou-bolo", source: "operator", replace: Boolean(game?.active) });
    }
  }

  if (stage === "glitch" && showState.snapshot().sceneZero.glitchLevel === "normal") {
    showState.controlSceneZero("set-glitch", { level: "glitch-1" }, { source: "operator" });
    applyGlitchLevel("glitch-1");
  }

  if (stage === "collapse") {
    showState.controlSceneZero("set-glitch", { level: "collapse" }, { source: "operator" });
    applyGlitchLevel("collapse");
  }

  if (stage === "airport") {
    showState.controlGlitch("stop", {}, { source: "scene-zero" });
  }

  const turn = await speak(STAGE_DIRECTIONS[stage], detail);
  if (stage === "collection") {
    showState.controlSceneZero("record-output", {
      kind: "collection-question",
      text: turn.text,
      detail: requestedActionFromText(turn.text)
    }, { source: "agent" });
  }
  return { ...changed, turn };
}

export async function GET() {
  return Response.json({ sceneZero: showState.snapshot().sceneZero });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = `${body.action || ""}`;
    const detail = `${body.detail || ""}`.trim();

    if (action === "set-stage") {
      const result = await enterStage(body.stage, detail);
      if (!result.applied) return Response.json({ error: result.error, sceneZero: result.state }, { status: 400 });
      return Response.json({ message: `CENA 0 — ${result.state.stage.toUpperCase()}`, sceneZero: showState.snapshot().sceneZero });
    }

    if (action === "set-glitch" || action === "step-glitch") {
      const result = showState.controlSceneZero(action, body, { source: "operator" });
      if (!result.applied) return Response.json({ error: result.error, sceneZero: result.state }, { status: 400 });
      applyGlitchLevel(result.state.glitchLevel);
      const turn = await speak("glitch_level", detail);
      return Response.json({ message: `GLITCH ${result.state.glitchLevel.toUpperCase()}`, sceneZero: showState.snapshot().sceneZero, text: turn.text });
    }

    if (["timer-start", "timer-pause", "timer-resume", "timer-restart", "timer-cancel"].includes(action)) {
      const result = showState.controlSceneZero(action, body, { source: "operator" });
      return Response.json({ message: `TIMER ${result.state.timer.status.toUpperCase()}`, sceneZero: result.state });
    }

    if (["tea-play", "tea-restart", "tea-stop"].includes(action)) {
      const result = showState.controlSceneZero(action, body, { source: "operator" });
      return Response.json({ message: `TEA FOR TWO ${result.state.teaForTwo.status.toUpperCase()}`, sceneZero: result.state });
    }

    if (action === "instagram-start") {
      showState.controlSceneZero("instagram-start", body, { source: "operator" });
      const controller = getInstagramController({ reporter: (instagram) => showState.updateInstagram(instagram) });
      const result = await controller.open();
      showState.updateInstagram({ ...controller.getStatus(), message: result.message });
      const turn = await speak("enter_instagram", detail);
      return Response.json({ message: result.message, sceneZero: showState.snapshot().sceneZero, text: turn.text });
    }

    if (action === "instagram-stop") {
      showState.controlSceneZero("instagram-stop", body, { source: "operator" });
      const controller = getExistingInstagramController();
      const result = controller ? await controller.stopAllRoutines() : { message: "INSTAGRAM: nenhuma rotina ativa" };
      if (controller) showState.updateInstagram({ ...controller.getStatus(), message: result.message });
    }

    if (SPEECH_ACTIONS.has(action)) {
      if (action === "cake-end" && showState.snapshot().game?.id === "verdade_ou_bolo") {
        showState.stopGame({ status: "operator_stopped", source: "scene-zero-operator" });
      }
      const stateAction = action === "collection-end" ? "collection-end" : action;
      const changed = showState.controlSceneZero(stateAction, body, { source: "operator" });
      if (!changed.applied) return Response.json({ error: changed.error, sceneZero: changed.state }, { status: 400 });
      const turn = await speak(DIRECTION_ACTIONS[action], detail);
      const collectionKind = ["collection-new-question", "collection-rephrase"].includes(action)
        ? "collection-question"
        : action === "collection-comment" ? "collection-comment" : null;
      if (collectionKind) {
        showState.controlSceneZero("record-output", {
          kind: collectionKind,
          text: turn.text,
          detail: collectionKind === "collection-question" ? requestedActionFromText(turn.text) : ""
        }, { source: "agent" });
      }
      return Response.json({ message: action.toUpperCase(), sceneZero: showState.snapshot().sceneZero, text: turn.text });
    }

    return Response.json({ error: "SCENE ZERO ACTION UNKNOWN" }, { status: 400 });
  } catch (error) {
    console.error("SCENE ZERO ERROR", error);
    return Response.json({ error: error.message || "SCENE ZERO ERROR" }, { status: 500 });
  }
}
