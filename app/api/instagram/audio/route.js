import { getExistingInstagramController } from "@/lib/instagram/InstagramController";
import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  const controller = getExistingInstagramController();

  if (!controller) {
    return Response.json({ error: "INSTAGRAM NOT STARTED" }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await controller.setAudioMuted(Boolean(body.muted));
    showState.updateInstagram({
      ...controller.getStatus(),
      message: result.message
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "INSTAGRAM AUDIO FAILED" }, { status: 503 });
  }
}
