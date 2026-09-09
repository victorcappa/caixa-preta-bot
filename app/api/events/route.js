import { encodeSse } from "@/lib/realtime";
import { getKnowledgeStatus } from "@/lib/knowledge";
import { OPENAI_MODEL_OPTIONS } from "@/lib/openaiModels";
import { showState } from "@/lib/showState";
import { PROMPT_VERSION } from "@/prompts/buildSystemPrompt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isBaralhoMorbidoClient(client) {
  return client === "baralho-morbido-controller" || client === "baralho-morbido-display";
}

function ignoresBaralhoMorbidoEvents(client) {
  return [
    "chat",
    "operator",
    "glitch-controller",
    "queda-aviao-controller",
    "queda-aviao-display"
  ].includes(client);
}

function isRelevantForBaralhoMorbido(payload) {
  return [
    "snapshot",
    "baralho-morbido",
    "baralho-morbido-display",
    "display-blackout",
    "reset"
  ].includes(payload?.event?.type);
}

function isBaralhoMorbidoEvent(payload) {
  return payload?.event?.type === "baralho-morbido" || payload?.event?.type === "baralho-morbido-display";
}

function stateForClient(state, client) {
  if (!isBaralhoMorbidoClient(client)) {
    return state;
  }

  return {
    baralhoMorbido: state.baralhoMorbido,
    displayBlackout: state.displayBlackout
  };
}

export async function GET(request) {
  const client = new URL(request.url).searchParams.get("client") || "";
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let keepAlive;
  let closed = false;

  function send(controller, payload) {
    if (closed) {
      return;
    }

    try {
      controller.enqueue(encoder.encode(payload));
    } catch {
      closed = true;
      clearInterval(keepAlive);
      unsubscribe();
    }
  }

  function withContext(payload) {
    return {
      ...payload,
      context: {
        knowledge: getKnowledgeStatus(),
        modelOptions: OPENAI_MODEL_OPTIONS,
        promptVersion: PROMPT_VERSION
      }
    };
  }

  const stream = new ReadableStream({
    start(controller) {
      unsubscribe = showState.subscribe((payload) => {
        if (isBaralhoMorbidoClient(client) && !isRelevantForBaralhoMorbido(payload)) {
          return;
        }

        if (ignoresBaralhoMorbidoEvents(client) && isBaralhoMorbidoEvent(payload)) {
          return;
        }

        send(controller, encodeSse(withContext({
          ...payload,
          state: stateForClient(payload.state, client)
        })));
      });

      // Registra o listener antes do snapshot para não perder uma atualização
      // que aconteça exatamente enquanto a aba pública está se conectando.
      send(controller, "retry: 500\n\n");
      const initialState = showState.snapshot();
      send(controller, encodeSse(withContext({
        event: { type: "snapshot" },
        state: stateForClient(initialState, client)
      })));

      keepAlive = setInterval(() => {
        send(controller, ": keepalive\n\n");
      }, 25000);
    },
    cancel() {
      closed = true;
      clearInterval(keepAlive);
      unsubscribe();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
