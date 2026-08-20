import { getExistingInstagramController } from "@/lib/instagram/InstagramController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const controller = getExistingInstagramController();

  if (!controller) {
    return Response.json({ error: "INSTAGRAM NOT STARTED" }, { status: 404 });
  }

  try {
    const pane = new URL(request.url).searchParams.get("pane") === "secondary" ? "secondary" : "primary";
    return Response.json(await controller.captureFrame({ fast: true, pane }));
  } catch {
    return Response.json({ error: "INSTAGRAM FRAME UNAVAILABLE" }, { status: 503 });
  }
}
