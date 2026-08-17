import { getExistingInstagramController } from "@/lib/instagram/InstagramController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const controller = getExistingInstagramController();

  if (!controller) {
    return Response.json({ error: "INSTAGRAM NOT STARTED" }, { status: 404 });
  }

  try {
    return Response.json(await controller.captureFrame({ fast: true }));
  } catch {
    return Response.json({ error: "INSTAGRAM FRAME UNAVAILABLE" }, { status: 503 });
  }
}
