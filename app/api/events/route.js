import { encodeSse } from "@/lib/realtime";
import { getKnowledgeStatus } from "@/lib/knowledge";
import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
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
        promptVersion: 1
      }
    };
  }

  const stream = new ReadableStream({
    start(controller) {
      send(controller, encodeSse(withContext({ event: { type: "snapshot" }, state: showState.snapshot() })));

      unsubscribe = showState.subscribe((payload) => {
        send(controller, encodeSse(withContext(payload)));
      });

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
      Connection: "keep-alive"
    }
  });
}
