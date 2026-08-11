import { generateCaixaPretaTurn } from "@/lib/openai";
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
      return Response.json({
        message: `MEMORY STORED: ${new Date(memory.timestamp).toLocaleTimeString("pt-BR")}`
      });
    }

    if (name === "/malas" || name === "/mala") {
      if (content) {
        return Response.json({ error: "MALA DOES NOT ACCEPT ARGUMENTS" }, { status: 400 });
      }

      const modeChange = showState.setMode(SHOW_MODES.malas);
      const turn = await generateCaixaPretaTurn({
        state: showState.snapshot(),
        operatorInstruction: [
          "O modo MALAS acabou de ser acionado pelo operador.",
          "O publico nao deve ver o comando nem saber que houve comando tecnico.",
          "Conclua a interacao atual e faca uma transicao contextual para a fase das malas."
        ].join(" ")
      });

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
        state: showState.snapshot(),
        operatorInstruction: content
      });

      if (turn.salience.length) {
        showState.addSalience(turn.salience, "agent");
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
