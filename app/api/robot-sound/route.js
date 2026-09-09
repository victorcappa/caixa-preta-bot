import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json({ robotSound: showState.snapshot().robotSound });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const robotSound = showState.controlRobotSound(body.settings || body, { source: "operator" });
  return Response.json({ message: "ROBOT SOUND UPDATED", robotSound });
}
