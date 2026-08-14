import { getExistingInstagramController } from "@/lib/instagram/InstagramController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FALLBACK_SVG = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="430" height="760" viewBox="0 0 430 760">
  <rect width="430" height="760" fill="#050505"/>
  <rect x="1" y="1" width="428" height="758" fill="none" stroke="#00ff66" stroke-opacity=".45"/>
  <text x="215" y="360" fill="#00ff66" font-family="monospace" font-size="22" text-anchor="middle">INSTAGRAM</text>
  <text x="215" y="392" fill="#00ff66" fill-opacity=".65" font-family="monospace" font-size="14" text-anchor="middle">carregando frame</text>
</svg>
`.trim()).toString("base64");

function jsonFrame(frame, controller, extra = {}) {
  return Response.json({
    image: `data:image/jpeg;base64,${frame.image.toString("base64")}`,
    viewport: frame.viewport,
    status: controller.getStatus(),
    ...extra
  });
}

function fallbackFrame(controller, extra = {}) {
  return Response.json({
    image: `data:image/svg+xml;base64,${FALLBACK_SVG}`,
    viewport: controller.getStatus().viewport || { width: 430, height: 760 },
    status: controller.getStatus(),
    pending: true,
    ...extra
  });
}

export async function GET() {
  const controller = getExistingInstagramController();

  if (!controller) {
    return Response.json({ error: "INSTAGRAM NOT STARTED" }, { status: 404 });
  }

  const cachedFrame = controller.getCachedFrame?.({ maxAgeMs: 10000 });
  if (controller.commandInProgress || controller.actionInProgress) {
    if (cachedFrame) {
      return jsonFrame(cachedFrame, controller, { cached: true });
    }

    return fallbackFrame(controller);
  }

  try {
    return Response.json(await controller.captureFrame());
  } catch {
    if (cachedFrame) {
      return jsonFrame(cachedFrame, controller, { cached: true });
    }

    return fallbackFrame(controller, { error: "INSTAGRAM FRAME UNAVAILABLE" });
  }
}
