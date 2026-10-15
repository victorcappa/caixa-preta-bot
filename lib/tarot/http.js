import { showState } from "@/lib/showState";
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  try { return !origin || new URL(origin).host === (request.headers.get("host") || new URL(request.url).host); } catch { return false; }
}
export function currentSession(body) {
  return typeof body?.sessionId === "string" && body.sessionId === showState.snapshot().reliability.sessionId;
}
