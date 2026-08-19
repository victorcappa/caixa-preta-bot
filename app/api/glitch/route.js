import fs from "node:fs";
import path from "node:path";
import { GLITCH_VIDEO_ROOT } from "@/lib/glitch/state";
import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".webm"]);

function glitchVideos() {
  const directory = path.join(process.cwd(), "assets", GLITCH_VIDEO_ROOT);

  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory)
    .filter((file) => VIDEO_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => ({
      file,
      src: `/api/game-assets?file=${encodeURIComponent(`${GLITCH_VIDEO_ROOT}/${file}`)}`
    }));
}

export async function GET() {
  return Response.json({
    glitch: showState.snapshot().glitch,
    videos: glitchVideos()
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const action = body.action || "update";
  const payload = body.payload || {};
  const result = showState.controlGlitch(action, payload, { source: "glitch-controller" });

  if (!result.applied) {
    return Response.json({ error: result.error || "GLITCH ERROR", state: result.state }, { status: 400 });
  }

  return Response.json({
    message: `GLITCH ${action}`.toUpperCase(),
    state: result.state,
    videos: glitchVideos()
  });
}
