import { getExistingInstagramController } from "@/lib/instagram/InstagramController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const controller = getExistingInstagramController();

  if (!controller) {
    return Response.json({ error: "INSTAGRAM NOT STARTED" }, { status: 404 });
  }

  try {
    return Response.json(await controller.captureFrame());
  } catch {
    const cachedFrame = controller.getCachedFrame?.({ maxAgeMs: 10000 });
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
