import { getExistingInstagramController, getInstagramController } from "@/lib/instagram/InstagramController";
import { generateCaixaPretaTurn, refreshSceneZeroLocalContext } from "@/lib/openai";
import { collectionRepertoireBlock, parseCollectionIntervention } from "@/lib/scene-zero/collection";
import { buildSceneZeroDirection, sceneZeroGlitchCommand } from "@/lib/scene-zero/state";
import { showState } from "@/lib/showState";
import { SHOW_MODES } from "@/prompts/modes";
import { findInstagramParticipantByName } from "@/lib/suitcases/SuitcaseDirector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SPEECH_ACTIONS = new Set([
  "collection-new-question",
  "collection-rephrase",
  "collection-comment",
  "collection-end",
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

async function generateCollectionIntervention(directionAction, detail = "", { replaceLast = false } = {}) {
  const state = showState.privateSnapshot();
  const turn = await generateCaixaPretaTurn({
    state,
    allowPerformance: false,
    allowWebSearch: false,
    operatorInstruction: [
      buildSceneZeroDirection(state.sceneZero, directionAction, detail),
      collectionRepertoireBlock(),
      "A coleta constrói dados sobre a sala; não é entrevista. Comece normal e aumente especificidade, condicionamento, cruzamento e falsa precisão gradualmente.",
      "Só declare waitSeconds quando a ação realmente precisar de uma janela temporal. Se declarar, diga claramente na fala a mesma duração em segundos. Se a fala disser mais de uma duração, vale a última; evite se corrigir de um número para outro.",
      "Nunca invente resultado, quantidade ou reação ainda não registrada pelo operador."
    ].join("\n\n"),
    operatorOutputInstruction: [
      "Responda somente JSON válido, sem Markdown.",
      "Formato exato: {\"fala\":\"texto público\",\"question\":{\"topic\":\"dimensão investigada\",\"action\":\"UMA_ACTION_PERMITIDA\",\"expectedAnswerType\":\"binary|range|count|choice|verbal|gesture|silence|qualitative\",\"intensity\":0,\"sensitivity\":\"low|medium|high\",\"locationContext\":\"referência local ou vazio\",\"scope\":\"room|subgroup|individual\",\"conditions\":[\"condições ou segmentos cruzados\"],\"waitSeconds\":null}}.",
      "intensity vai de 0 a 5. waitSeconds é null ou de 3 a 60. Não coloque pergunta pronta fora de fala."
    ].join(" ")
  });
  const intervention = parseCollectionIntervention(turn.text);
  if (!intervention) throw new Error("SCENE ZERO COLLECTION JSON INVALID");

  const message = showState.addMessage("assistant", intervention.text, "scene-zero-collection");
  showState.controlSceneZero("record-output", {
    kind: "collection-question",
    text: intervention.text,
    detail: intervention.data.action,
    collectionData: intervention.data,
    messageId: message.id,
    replaceLast
  }, { source: "agent" });
  return { ...intervention, messageId: message.id };
}

function applyGeneratedTurn(turn) {
  if (turn.salience?.length) showState.addSalience(turn.salience, "agent");
  if (turn.game?.gameMove && showState.snapshot().game?.active) {
    showState.applyGameMove(turn.game, { source: "agent" });
  }
  if (turn.suitcase && showState.snapshot().suitcase?.active) {
    showState.applySuitcaseMove(turn.suitcase, { source: "agent" });
  }
  if (turn.text) {
    const stage = showState.snapshot().sceneZero?.stage;
    const fragments = ["glitch", "collapse"].includes(stage)
      ? turn.text.split(/\n\s*\n/).map((fragment) => fragment.trim()).filter(Boolean).slice(0, 4)
      : [turn.text];
    for (const fragment of fragments) {
      showState.addMessage("assistant", fragment, "scene-zero-operator");
    }
  }
  if (turn.events?.length) showState.queuePerformanceEvents(turn.events, "agent");
}

function parseParticipantSequence(text = "") {
  try {
    const parsed = JSON.parse(text);
    const invite = `${parsed.convite || ""}`.trim();
    const comments = Array.isArray(parsed.comentarios)
      ? parsed.comentarios.map((comment) => `${comment || ""}`.trim()).filter(Boolean).slice(0, 3)
      : [];
    const announcement = `${parsed.anuncio || ""}`.trim();
    if (invite && comments.length === 3 && announcement) {
      return { invite, comments, announcement };
    }
  } catch {
    // Invalid structured copy is retried by the operator instead of leaking internal formatting.
  }
  return null;
}

async function generateParticipantSequence({ candidates, winner, detail = "" }) {
  const state = showState.privateSnapshot();
  const candidateNames = candidates.map((participant) => participant.name);
  const turn = await generateCaixaPretaTurn({
    state,
    allowPerformance: false,
    operatorInstruction: buildSceneZeroDirection(
      state.sceneZero,
      "participant_roulette_sequence",
      [
        detail,
        `Nomes visíveis na roleta: ${candidateNames.join(", ")}.`,
        `Resultado já sorteado pelo sistema e que só pode ser revelado no anúncio final: ${winner.name}.`
      ].filter(Boolean).join(" ")
    ),
    operatorOutputInstruction: [
      "Responda somente JSON válido, sem Markdown.",
      "Formato exato: {\"convite\":\"...\",\"comentarios\":[\"...\",\"...\",\"...\"],\"anuncio\":\"...\"}.",
      "O convite abre os 10 segundos. Os três comentários acontecem durante a roleta e não podem revelar o vencedor. O anúncio final deve convocar exatamente o vencedor informado."
    ].join(" ")
  });
  return parseParticipantSequence(turn.text);
}

async function startParticipantFlow({ chooseAnother = false, detail = "" } = {}) {
  if (showState.snapshot().sceneZero.stage !== "participant") {
    showState.controlSceneZero("set-stage", { stage: "participant", detail }, { source: "operator" });
  }
  const prepared = showState.prepareSceneZeroParticipantSelection({ chooseAnother });
  if (!prepared.applied) return prepared;

  const sequence = await generateParticipantSequence({
    candidates: prepared.candidates,
    winner: prepared.winner,
    detail
  });
  if (!sequence) {
    return { applied: false, error: "SCENE ZERO PARTICIPANT COPY INVALID", state: showState.snapshot().sceneZero };
  }

  const inviteMessage = showState.addMessage("assistant", sequence.invite, "scene-zero-roulette");
  const started = showState.startSceneZeroParticipantSelection({
    invite: sequence.invite,
    comments: sequence.comments,
    announcement: sequence.announcement,
    inviteMessageId: inviteMessage.id
  });
  return { ...started, text: sequence.invite };
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
  const command = sceneZeroGlitchCommand(level);
  showState.controlGlitch(command.action, command.payload, { source: "scene-zero" });
}

async function researchCurrentSceneZeroParticipant() {
  const participant = showState.snapshot().sceneZero?.currentParticipant;
  if (!participant?.name) {
    return { status: "missing", message: "PESQUISA: participante ainda não escolhido" };
  }
  const knownParticipant = findInstagramParticipantByName(participant.name);
  const controller = getInstagramController({ reporter: (instagram) => showState.updateInstagram(instagram) });
  return controller.researchPerson(participant.name, {
    knownInstagramHandle: knownParticipant?.instagramHandle || ""
  });
}

async function enterStage(stage, detail) {
  const changed = showState.controlSceneZero("set-stage", { stage, detail }, { source: "operator" });
  if (!changed.applied) return changed;

  if (stage !== "suitcases") {
    const controller = getExistingInstagramController();
    if (controller?.browserMode === "person_research") {
      await controller.stopPersonResearch();
    }
  }

  if (stage === "participant") {
    const participantFlow = await startParticipantFlow({ detail });
    return { ...participantFlow, state: showState.snapshot().sceneZero };
  }

  if (stage === "suitcases") {
    showState.setMode(SHOW_MODES.malas);
    if (!showState.snapshot().suitcase?.active) showState.startSuitcases({ source: "scene-zero-operator" });
    const researchPromise = researchCurrentSceneZeroParticipant();
    const [turn, research] = await Promise.all([
      speak(STAGE_DIRECTIONS[stage], detail),
      researchPromise
    ]);
    return { ...changed, turn, research, state: showState.snapshot().sceneZero };
  }

  if (stage === "cake") {
    const game = showState.snapshot().game;
    if (!game?.active || game.id !== "verdade_ou_bolo") {
      showState.startGame({ requestedGame: "verdade-ou-bolo", source: "operator", replace: Boolean(game?.active) });
    }
  }

  if (stage === "glitch") {
    const currentLevel = showState.snapshot().sceneZero.glitchLevel;
    const level = ["glitch-1", "glitch-2", "glitch-3", "glitch-4"].includes(currentLevel)
      ? currentLevel
      : "glitch-1";
    if (currentLevel !== level) {
      showState.controlSceneZero("set-glitch", { level }, { source: "operator" });
    }
    applyGlitchLevel(level);
  }

  if (stage === "collapse") {
    showState.controlSceneZero("set-glitch", { level: "collapse" }, { source: "operator" });
    applyGlitchLevel("collapse");
  }

  if (stage === "airport") {
    showState.controlGlitch("stop", {}, { source: "scene-zero" });
  }

  if (stage === "collection") {
    const intervention = await generateCollectionIntervention(STAGE_DIRECTIONS[stage], detail);
    return { ...changed, turn: { text: intervention.text } };
  }
  const turn = await speak(STAGE_DIRECTIONS[stage], detail);
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

    if (action === "message-typed") {
      const result = showState.completeSceneZeroMessageTyping(body.messageId);
      return Response.json({ message: result.applied ? "TEMPORIZAÇÃO INICIADA" : "MENSAGEM SEM TEMPORIZAÇÃO PENDENTE", result, sceneZero: showState.snapshot().sceneZero });
    }

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

    if (["participant-volunteers", "choose-participant", "choose-another-participant"].includes(action)) {
      const result = await startParticipantFlow({
        chooseAnother: action === "choose-another-participant",
        detail
      });
      if (!result.applied) return Response.json({ error: result.error, sceneZero: result.state }, { status: 400 });
      return Response.json({ message: "SELEÇÃO AUTOMÁTICA INICIADA — 10s", sceneZero: showState.snapshot().sceneZero, text: result.text });
    }

    if (action === "collection-record-result") {
      const result = showState.controlSceneZero(action, body, { source: "operator" });
      if (!result.applied) return Response.json({ error: result.error, sceneZero: result.state }, { status: 400 });
      const intervention = await generateCollectionIntervention("collection_result_continue", detail);
      return Response.json({
        message: "RESULTADO REGISTRADO · COLETA CONTINUA",
        sceneZero: showState.snapshot().sceneZero,
        text: intervention.text
      });
    }

    if (action === "collection-refresh-local-context") {
      showState.controlSceneZero("collection-local-context-loading", {}, { source: "operator" });
      try {
        const localContext = await refreshSceneZeroLocalContext();
        const result = showState.controlSceneZero("collection-local-context-ready", localContext, { source: "system" });
        return Response.json({ message: "CONTEXTO SP ATUALIZADO", sceneZero: result.state });
      } catch (error) {
        const result = showState.controlSceneZero("collection-local-context-error", { error: error.message }, { source: "system" });
        return Response.json({ error: "CONTEXTO SP NÃO ATUALIZADO", sceneZero: result.state }, { status: 502 });
      }
    }

    if (action === "suitcase-research-person") {
      const result = await researchCurrentSceneZeroParticipant();
      const status = result.status === "missing" ? 400 : result.status === "error" ? 502 : 200;
      return Response.json({
        ...(status >= 400 ? { error: result.message } : { message: result.message }),
        research: result,
        sceneZero: showState.snapshot().sceneZero
      }, { status });
    }

    if (action === "suitcase-research-stop") {
      const controller = getExistingInstagramController();
      const result = controller ? await controller.stopPersonResearch() : { status: "idle", message: "PESQUISA: navegador inativo" };
      return Response.json({ message: result.message || "PESQUISA ENCERRADA", sceneZero: showState.snapshot().sceneZero });
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
      if (["collection-new-question", "collection-rephrase"].includes(action)) {
        const intervention = await generateCollectionIntervention(DIRECTION_ACTIONS[action], detail, {
          replaceLast: action === "collection-rephrase"
        });
        return Response.json({ message: action.toUpperCase(), sceneZero: showState.snapshot().sceneZero, text: intervention.text });
      }
      const turn = action === "collection-comment"
        ? await generateCaixaPretaTurn({
          state: showState.privateSnapshot(),
          operatorInstruction: buildSceneZeroDirection(showState.privateSnapshot().sceneZero, DIRECTION_ACTIONS[action], detail),
          allowPerformance: false,
          allowWebSearch: false
        }).then((generated) => {
          applyGeneratedTurn(generated);
          return generated;
        })
        : await speak(DIRECTION_ACTIONS[action], detail);
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
