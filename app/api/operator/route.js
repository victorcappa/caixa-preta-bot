import { generateCaixaPretaTurn } from "@/lib/openai";
import { normalizeGameCommand } from "@/lib/host/GameDirector";
import { parseInstagramCommand } from "@/lib/instagram/commands";
import { getInstagramController } from "@/lib/instagram/InstagramController";
import { normalizeOpenAIModel } from "@/lib/openaiModels";
import { showState } from "@/lib/showState";
import { SHOW_MODES } from "@/prompts/modes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseCommand(raw) {
  const trimmed = raw.trim();
  const [name] = trimmed.split(/\s+/);
  const content = trimmed.slice(name.length).trim();

  return { name, content };
}

function withTimeout(promise, ms, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), ms);
    })
  ]);
}

function eventFromCommand(kind, content) {
  if (kind === "text") {
    return { type: "FULLSCREEN_TEXT", payload: { text: content || "REGISTRADO" }, durationMs: 1800 };
  }

  if (kind === "flash") {
    return { type: "FLASH_TEXT", payload: { text: content || "NAO." }, durationMs: 220 };
  }

  if (kind === "blackout") {
    return { type: "BLACKOUT", durationMs: Number(content) || 1200 };
  }

  if (kind === "hide") {
    return { type: "HIDE_UI", durationMs: Number(content) || 1800 };
  }

  if (kind === "glitch") {
    return { type: "GLITCH", payload: { text: content || "" }, durationMs: 1200 };
  }

  if (kind === "repeat") {
    return { type: "REPEAT_TEXT", payload: { text: content || "REGISTRADO", count: 18 }, durationMs: 2000 };
  }

  if (kind === "countdown") {
    return { type: "COUNTDOWN", payload: { duration: Number(content) || 5 } };
  }

  if (kind === "button") {
    return { type: "FORBIDDEN_BUTTON", payload: { label: content || "NAO TOQUE" }, durationMs: 8000 };
  }

  if (kind === "phone") {
    const [participant, contentType, privacyLevel] = content.split(/\s+/);
    return {
      type: "PHONE_PROJECTION_REQUEST",
      payload: {
        participant: participant || "",
        contentType: contentType || "phone_content",
        privacyLevel: privacyLevel || "high"
      },
      durationMs: 12000
    };
  }

  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const rawCommand = body.command?.trim();

    if (!rawCommand) {
      return Response.json({ error: "COMMAND REQUIRED" }, { status: 400 });
    }

    if (!rawCommand.startsWith("/")) {
      return Response.json({ error: "COMMAND REQUIRED" }, { status: 400 });
    }

    const { name, content } = parseCommand(rawCommand);

    if (name === "/reset") {
      showState.reset();
      return Response.json({ message: "SESSION RESET" });
    }

    if (name === "/clear-performance" || name === "/clear") {
      showState.clearPerformance();
      return Response.json({ message: "PERFORMANCE CLEARED" });
    }

    if (name === "/intensity") {
      const intensity = showState.setPerformanceIntensity(content);
      return Response.json({ message: `INTENSITY ${intensity.toUpperCase()}` });
    }

    if (name === "/model") {
      const model = normalizeOpenAIModel(content);

      if (!model) {
        return Response.json({ error: "MODEL UNKNOWN" }, { status: 400 });
      }

      const modelChange = showState.setModel(model);
      return Response.json({
        message: `MODEL ${modelChange.previousModel} -> ${modelChange.model}`
      });
    }

    if (name === "/phone") {
      const [action, ...rest] = content.split(/\s+/);

      if (action === "approve") {
        const current = showState.snapshot().performance.phoneProjection;

        if (current.status !== "pending_operator_confirmation") {
          return Response.json({ error: "PHONE NOTHING PENDING" }, { status: 400 });
        }

        const phoneProjection = showState.approvePhoneProjection();
        return Response.json({
          message: `PHONE PROJECTION APPROVED ${phoneProjection.participant || ""}`.trim()
        });
      }

      if (action === "hide" || action === "blackout") {
        showState.hidePhoneProjection();
        return Response.json({ message: "PHONE PROJECTION HIDDEN" });
      }

      if (action === "request") {
        const [participant, contentType, privacyLevel] = rest;
        const queued = showState.queuePerformanceEvents([{
          type: "PHONE_PROJECTION_REQUEST",
          payload: {
            participant: participant || "",
            contentType: contentType || "phone_content",
            privacyLevel: privacyLevel || "high"
          },
          durationMs: 12000
        }], "operator");
        return Response.json({ message: `PHONE REQUEST QUEUED ${queued[0].id}` });
      }

      return Response.json({ error: "PHONE COMMAND UNKNOWN" }, { status: 400 });
    }

    if (name === "/instagram") {
      const instagramCommand = parseInstagramCommand(content);

      if (!instagramCommand.valid) {
        return Response.json({
          error: [
            "INSTAGRAM COMMAND UNKNOWN",
            "Use /instagram follow cappavictor"
          ].join("\n")
        }, { status: 400 });
      }

      try {
        const controller = getInstagramController({
          reporter: (instagram) => showState.updateInstagram(instagram)
        });
        const result = await withTimeout(controller.follow(instagramCommand.username), 45000, "INSTAGRAM_REQUEST_TIMEOUT");
        showState.updateInstagram({
          ...controller.getStatus(),
          message: result.message
        });
        return Response.json({ message: result.message });
      } catch (error) {
        const message = error.message || "";

        if (message.startsWith("INSTAGRAM_PROFILE_NOT_ALLOWED")) {
          showState.updateInstagram({
            status: "MANUAL_INTERVENTION",
            message: `perfil fora da whitelist: @${instagramCommand.username}`,
            targetProfile: instagramCommand.username,
            lastAction: "follow"
          });

          return Response.json({
            error: `INSTAGRAM PROFILE NOT ALLOWED: @${instagramCommand.username}`
          }, { status: 403 });
        }

        if (message === "INSTAGRAM_USERNAME_INVALID") {
          return Response.json({ error: "INSTAGRAM USERNAME INVALID" }, { status: 400 });
        }

        if (message === "INSTAGRAM_REQUEST_TIMEOUT") {
          showState.updateInstagram({
            status: "ERROR",
            message: "timeout no comando Instagram",
            lastError: "operator timeout",
            targetProfile: instagramCommand.username,
            lastAction: "follow"
          });

          return Response.json({ error: "INSTAGRAM REQUEST TIMEOUT" }, { status: 504 });
        }

        console.error("INSTAGRAM OPERATOR ERROR", error);
        showState.updateInstagram({
          status: "ERROR",
          message: "erro Playwright",
          lastError: `${message}`.slice(0, 180),
          targetProfile: instagramCommand.username,
          lastAction: "follow"
        });

        return Response.json({ error: "INSTAGRAM REQUEST FAILED" }, { status: 500 });
      }
    }

    if (name === "/event") {
      const [kind, ...rest] = content.split(/\s+/);
      const event = eventFromCommand(kind, rest.join(" "));

      if (!event) {
        return Response.json({ error: "EVENT UNKNOWN" }, { status: 400 });
      }

      const queued = showState.queuePerformanceEvents([event], "operator");
      return Response.json({ message: `EVENT QUEUED ${queued[0].type} ${queued[0].id}` });
    }

    if (name === "/draw") {
      const [kind, ...rest] = content.split(/\s+/);

      if (kind === "clear") {
        showState.queuePerformanceEvents([{ type: "CLEAR_DRAWING", durationMs: 100 }], "operator");
        return Response.json({ message: "DRAWING CLEARED" });
      }

      if (kind === "circle") {
        showState.queuePerformanceEvents([{
          type: "DRAWING",
          durationMs: 1800,
          payload: {
            revealMs: 1200,
            shapes: [{ type: "circle", id: "operator-circle", x: 50, y: 50, radius: Number(rest[0]) || 18 }]
          }
        }], "operator");
        return Response.json({ message: "DRAWING CIRCLE QUEUED" });
      }

      return Response.json({ error: "DRAW COMMAND UNKNOWN" }, { status: 400 });
    }

    if (name === "/game") {
      const gameCommand = normalizeGameCommand(content);

      if (gameCommand.action === "stop") {
        const stopped = showState.stopGame({ status: "operator_stopped", source: "operator" });
        const turn = await generateCaixaPretaTurn({
          state: showState.privateSnapshot(),
          operatorInstruction: stopped.stopped
            ? "O operador encerrou o jogo ativo. Faca uma saida publica curta, contextual e com personalidade. Nao revele o comando."
            : "O operador pediu para parar jogo, mas nao havia jogo ativo. Responda curto sem expor o comando tecnico."
        });

        showState.addMessage("assistant", turn.text, "operator");

        if (turn.events.length) {
          showState.queuePerformanceEvents(turn.events, "agent");
        }

        return Response.json({ message: stopped.stopped ? "GAME STOPPED" : "NO ACTIVE GAME" });
      }

      if (gameCommand.action === "secret") {
        const secretSet = showState.setGameSecret(gameCommand.secret, { source: "operator" });

        if (!secretSet.applied) {
          return Response.json({ error: "GAME SECRET NOT ACCEPTED" }, { status: 400 });
        }

        const turn = await generateCaixaPretaTurn({
          state: showState.privateSnapshot(),
          operatorInstruction: "O operador definiu secret para Maria Antonieta. Nao revele o segredo. Continue fazendo perguntas de sim/nao/talvez para descobrir."
        });

        showState.addMessage("assistant", turn.text, "operator");

        if (turn.events.length) {
          showState.queuePerformanceEvents(turn.events, "agent");
        }

        return Response.json({ message: "GAME SECRET SET" });
      }

      const activeGame = showState.snapshot().game;
      if (activeGame?.active && gameCommand.action !== "replace") {
        return Response.json({
          error: [
            `GAME ALREADY ACTIVE: ${activeGame.id}`,
            "Use /game stop",
            "Use /game replace <game>"
          ].join("\n")
        }, { status: 409 });
      }

      const started = showState.startGame({
        requestedGame: gameCommand.requestedGame,
        source: "operator",
        replace: gameCommand.action === "replace"
      });

      if (started.blocked) {
        return Response.json({ error: `GAME ALREADY ACTIVE: ${started.gameState.id}` }, { status: 409 });
      }

      if (!started.gameState.id) {
        return Response.json({ error: "NO ELIGIBLE GAME" }, { status: 400 });
      }

      const turn = await generateCaixaPretaTurn({
        state: showState.privateSnapshot(),
        operatorInstruction: [
          "O operador acionou /game.",
          gameCommand.requestedGame ? `Pedido especifico: ${gameCommand.requestedGame}.` : "Sem argumento: o GameDirector escolheu.",
          "Nao revele o comando tecnico.",
          "Abra o jogo ja escolhido com no maximo uma regra e a primeira acao."
        ].join(" ")
      });

      showState.addMessage("assistant", turn.text, "operator");

      if (turn.events.length) {
        showState.queuePerformanceEvents(turn.events, "agent");
      }

      return Response.json({
        message: `GAME START ${started.gameState.id}${started.selection.adaptedFrom ? `\nADAPTED FROM ${started.selection.adaptedFrom}` : ""}`
      });
    }

    if (name === "/activity") {
      const [kind, ...rest] = content.split(/\s+/);

      if (kind === "hangman" || kind === "forca") {
        const activity = showState.startHangmanActivity({ word: rest.join(" "), source: "operator" });
        return Response.json({
          message: `ACTIVITY START HANGMAN\nID ${activity.id}\nWORD ${activity.privateState.secretWord}`
        });
      }

      if (kind === "stop") {
        showState.stopActivities("abandoned");
        return Response.json({ message: "ACTIVITIES ABANDONED" });
      }

      return Response.json({ error: "ACTIVITY UNKNOWN" }, { status: 400 });
    }

    if (name === "/memory") {
      if (!content) {
        return Response.json({ error: "MEMORY EMPTY" }, { status: 400 });
      }

      const memory = showState.addMemory(content);
      const savedParticipants = memory.participants?.savedToPublico || [];
      return Response.json({
        message: [
          `MEMORY STORED: ${new Date(memory.timestamp).toLocaleTimeString("pt-BR")}`,
          savedParticipants.length ? `PUBLICO UPDATED: ${savedParticipants.join(", ")}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    if (name === "/malas" || name === "/mala" || name === "/suitcase") {
      const hadActiveGame = showState.snapshot().game?.active;
      const [action = "start", ...rest] = content.split(/\s+/).filter(Boolean);
      const normalizedAction = action
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if ((normalizedAction === "start" || !content) && hadActiveGame) {
        showState.stopGame({ status: "mode_change", source: "operator" });
      }

      if (normalizedAction === "abort" || normalizedAction === "stop") {
        const aborted = showState.abortSuitcases({ source: "operator" });
        return Response.json({ message: `SUITCASES ABORTED\n${aborted.state.phase}` });
      }

      if (normalizedAction === "reset") {
        const reset = showState.resetSuitcases({ source: "operator" });
        return Response.json({ message: `SUITCASES RESET\n${reset.state.phase}` });
      }

      if (normalizedAction === "win") {
        showState.finishSuitcases("machine_win", { source: "operator" });
        return Response.json({ message: "SUITCASE FORCE WIN" });
      }

      if (normalizedAction === "lose") {
        showState.finishSuitcases("audience_win", { source: "operator" });
        return Response.json({ message: "SUITCASE FORCE LOSE" });
      }

      if (normalizedAction === "next") {
        const next = showState.nextInstagramPerson({ source: "operator" });
        return Response.json({
          message: `INSTAGRAM NEXT\n${next.state.instagram?.selectedPerson?.name || "NO PERSON"}`
        });
      }

      if (["1", "name", "nome", "maria", "mariaantonieta"].includes(normalizedAction)) {
        const forced = showState.forceSuitcaseExperience("name", { source: "operator" });
        return Response.json({ message: `SUITCASE FORCE NAME\n${forced.state.phase}` });
      }

      if (["2", "instagram", "insta"].includes(normalizedAction)) {
        const forced = showState.forceSuitcaseExperience("instagram", { source: "operator" });
        return Response.json({
          message: `SUITCASE FORCE INSTAGRAM\n${forced.state.instagram?.selectedPerson?.name || "NO PERSON"}`
        });
      }

      if (["3", "game", "jogo", "desafio", "puzzle"].includes(normalizedAction)) {
        const forced = showState.forceSuitcaseExperience("game", {
          source: "operator",
          requestedGame: rest.join(" ") || null
        });
        return Response.json({ message: `SUITCASE FORCE GAME\n${forced.state.currentGame?.id || "NO GAME"}` });
      }

      if (!["start", ""].includes(normalizedAction)) {
        return Response.json({ error: "MALA COMMAND UNKNOWN" }, { status: 400 });
      }

      const modeChange = showState.setMode(SHOW_MODES.malas);
      showState.startSuitcases({ source: "operator" });
      const turn = await generateCaixaPretaTurn({
        state: showState.privateSnapshot(),
        operatorInstruction: [
          "O modo MALAS acabou de ser acionado pelo operador.",
          hadActiveGame ? "Havia um jogo ativo; encerre ou dissolva essa regra antes de entrar nas malas." : "",
          "O publico nao deve ver o comando nem saber que houve comando tecnico.",
          "Conclua a interacao atual e faca uma transicao contextual para a fase das malas.",
          "O estado ja esta aguardando escolha de mala. Termine com uma conducao viva para escolher uma mala, sem parecer menu tecnico."
        ].join(" ")
      });

      if (turn.suitcase && showState.snapshot().suitcase?.active) {
        showState.applySuitcaseMove(turn.suitcase, { source: "agent" });
      }

      showState.addMessage("assistant", turn.text, "operator");

      if (turn.events.length) {
        showState.queuePerformanceEvents(turn.events, "agent");
      }

      return Response.json({
        message: `MODE CHANGE\n${modeChange.previousMode.toUpperCase()} -> ${modeChange.mode.toUpperCase()}\nTRANSITION DELIVERED`
      });
    }

    if (name === "/say") {
      if (!content) {
        return Response.json({ error: "SAY EMPTY" }, { status: 400 });
      }

      const turn = await generateCaixaPretaTurn({
        state: showState.privateSnapshot(),
        operatorInstruction: content
      });

      if (turn.salience.length) {
        showState.addSalience(turn.salience, "agent");
      }

      if (turn.game?.gameMove && showState.snapshot().game?.active) {
        showState.applyGameMove(turn.game, { source: "agent" });
      }

      if (turn.suitcase && showState.snapshot().suitcase?.active) {
        showState.applySuitcaseMove(turn.suitcase, { source: "agent" });
      }

      showState.addMessage("assistant", turn.text, "operator");

      if (turn.events.length) {
        showState.queuePerformanceEvents(turn.events, "agent");
      }

      return Response.json({ message: "SAY DELIVERED" });
    }

    return Response.json({ error: `UNKNOWN COMMAND: ${name}` }, { status: 400 });
  } catch (error) {
    console.error("OPERATOR ERROR", error);
    const missingKey = error.message?.includes("OPENAI_API_KEY");

    return Response.json(
      { error: missingKey ? error.message : "OPENAI REQUEST FAILED" },
      { status: 500 }
    );
  }
}
