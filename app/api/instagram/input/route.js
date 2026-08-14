import { getExistingInstagramController } from "@/lib/instagram/InstagramController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  const controller = getExistingInstagramController();

  if (!controller) {
    return Response.json({ error: "INSTAGRAM NOT STARTED" }, { status: 404 });
  }

  try {
    const input = await request.json();
    const result = await controller.sendEmbeddedInput(input);
    return Response.json(result);
  } catch {
    return Response.json({ error: "INSTAGRAM INPUT FAILED" }, { status: 503 });
  }
}
