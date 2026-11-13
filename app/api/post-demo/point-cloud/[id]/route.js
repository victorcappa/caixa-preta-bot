import fs from "node:fs/promises";
import { showState } from "@/lib/showState";
import { pointCloudFile } from "@/lib/post-demo/pointCloudEngine";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request, context) {
  const { id } = await context.params, sessionId = new URL(request.url).searchParams.get("sessionId");
  const state = showState.privateSnapshot(), current = state.postDemo.pointCloud?.current;
  if (!current || state.reliability.sessionId !== sessionId || current.sessionId !== sessionId || current.id !== id) return new Response("NOT FOUND", { status: 404 });
  try {
    const bytes = await fs.readFile(pointCloudFile(sessionId, id));
    // Revalidate after I/O: a session may change while the file is being loaded.
    const latest = showState.privateSnapshot();
    if (latest.reliability.sessionId !== sessionId || latest.postDemo.pointCloud?.current?.id !== id) return new Response("NOT FOUND", { status: 404 });
    return new Response(bytes, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "Cross-Origin-Resource-Policy": "same-origin" } });
  } catch { return new Response("NOT FOUND", { status: 404 }); }
}
