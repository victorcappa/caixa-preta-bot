import { getExistingInstagramController } from "@/lib/instagram/InstagramController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET() {
  const controller = getExistingInstagramController();

  if (!controller) {
    return Response.json({ error: "INSTAGRAM NOT STARTED" }, { status: 404 });
  }

  const boundary = "caixa-preta-instagram-frame";
  const encoder = new TextEncoder();
  const status = controller.getStatus();
  const frameIntervalMs = Math.round(1000 / Math.max(1, status.streamFps || 30));
  let closed = false;
  let consecutiveErrors = 0;

  const stream = new ReadableStream({
    async start(streamController) {
      while (!closed) {
        const startedAt = Date.now();

        try {
          const frame = controller.commandInProgress || controller.actionInProgress
            ? controller.getCachedFrame?.({ maxAgeMs: 10000 })
            : await controller.captureJpegFrame({ quality: status.streamQuality || 62 });

          if (!frame) {
            throw new Error("INSTAGRAM_FRAME_PENDING");
          }

          streamController.enqueue(encoder.encode([
            `--${boundary}`,
            "Content-Type: image/jpeg",
            `Content-Length: ${frame.image.length}`,
            `X-Instagram-Viewport: ${frame.viewport.width}x${frame.viewport.height}`,
            "",
            ""
          ].join("\r\n")));
          streamController.enqueue(frame.image);
          streamController.enqueue(encoder.encode("\r\n"));
          consecutiveErrors = 0;
        } catch {
          consecutiveErrors += 1;
          if (closed) {
            return;
          }

          await sleep(Math.min(1200, 250 + (consecutiveErrors * 100)));
        }

        await sleep(Math.max(0, frameIntervalMs - (Date.now() - startedAt)));
      }
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": `multipart/x-mixed-replace; boundary=${boundary}`,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
