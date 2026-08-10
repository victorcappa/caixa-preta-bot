import { encodeSse } from "@/lib/realtime";
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

  const stream = new ReadableStream({
    start(controller) {
      send(controller, encodeSse({ event: { type: "snapshot" }, state: showState.snapshot() }));

      unsubscribe = showState.subscribe((payload) => {
        send(controller, encodeSse(payload));
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
