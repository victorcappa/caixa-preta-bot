import { getExistingInstagramController } from "@/lib/instagram/InstagramController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonFrame(frame, controller, extra = {}) {
  return Response.json({
    image: `data:image/jpeg;base64,${frame.image.toString("base64")}`,
    viewport: frame.viewport,
    status: controller.getStatus(),
    ...extra
  });
}

function pendingFrame(controller, extra = {}) {
  return Response.json({
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

  const cachedFrame = controller.getCachedFrame?.({ maxAgeMs: Number.POSITIVE_INFINITY });
  if (controller.commandInProgress || controller.actionInProgress) {
    if (cachedFrame) {
      return jsonFrame(cachedFrame, controller, { cached: true });
    }

    return pendingFrame(controller);
  }

  try {
    return Response.json(await controller.captureFrame());
  } catch {
    if (cachedFrame) {
      return jsonFrame(cachedFrame, controller, { cached: true });
    }

    return pendingFrame(controller, { error: "INSTAGRAM FRAME UNAVAILABLE" });
  }
}
