import { getExistingInstagramController } from "@/lib/instagram/InstagramController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const controller = getExistingInstagramController();

  if (!controller) {
    return Response.json({ error: "INSTAGRAM NOT STARTED" }, { status: 404 });
  }

  const cachedFrame = controller.getCachedFrame?.({ maxAgeMs: 10000 });
  if (controller.commandInProgress || controller.actionInProgress) {
    if (cachedFrame) {
      return Response.json({
        image: `data:image/jpeg;base64,${cachedFrame.image.toString("base64")}`,
        viewport: cachedFrame.viewport,
        status: controller.getStatus(),
        cached: true
      });
    }

    return Response.json({ error: "INSTAGRAM FRAME PENDING" }, { status: 425 });
  }

  try {
    return Response.json(await controller.captureFrame());
  } catch {
    if (cachedFrame) {
      return Response.json({
        image: `data:image/jpeg;base64,${cachedFrame.image.toString("base64")}`,
        viewport: cachedFrame.viewport,
        status: controller.getStatus(),
        cached: true
      });
    }

    return Response.json({ error: "INSTAGRAM FRAME UNAVAILABLE" }, { status: 503 });
  }
}
