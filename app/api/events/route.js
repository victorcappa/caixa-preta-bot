import { encodeSse } from "@/lib/realtime";
import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let keepAlive;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSse({ event: { type: "snapshot" }, state: showState.snapshot() })));

      unsubscribe = showState.subscribe((payload) => {
        controller.enqueue(encoder.encode(encodeSse(payload)));
      });

      keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 25000);
    },
    cancel() {
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
