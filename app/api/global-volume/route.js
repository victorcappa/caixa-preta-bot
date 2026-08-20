import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ globalVolume: showState.snapshot().globalVolume });
}

export async function POST(request) {
  try {
    const body = await request.json();
    return Response.json({ globalVolume: showState.setGlobalVolume(body.volume) });
  } catch {
    return Response.json({ error: "GLOBAL VOLUME INVALID" }, { status: 400 });
  }
}
