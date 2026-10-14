import { externalRequestStatus } from "@/lib/externalRequestControl";
import { buildShowHealthReport } from "@/lib/showHealth";
import { showState } from "@/lib/showState";
import { checkSnapshotStorage } from "@/lib/showSessionPersistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function internetProbe() {
  if (showState.snapshot().reliability?.emergencyMode?.active) {
    return { status: "blocked", error: null };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch("https://www.google.com/generate_204", {
      cache: "no-store",
      signal: controller.signal
    });
    return { status: response.ok ? "ok" : "degraded", error: response.ok ? null : `HTTP_${response.status}` };
  } catch (error) {
    return { status: "offline", error: error?.name === "AbortError" ? "TIMEOUT" : "UNREACHABLE" };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request) {
  const snapshot = showState.snapshot();
  const storage = await checkSnapshotStorage();
  const searchParams = new URL(request.url).searchParams;
  const simulateOffline = searchParams.get("simulateOptionalOffline") === "1" && process.env.NODE_ENV !== "production";
  const skipOptional = searchParams.get("skipOptional") === "1";
  const internet = skipOptional
    ? { status: "unknown", error: null }
    : simulateOffline ? { status: "offline", error: "SIMULATED" } : await internetProbe();
  const external = externalRequestStatus();
  const configured = Boolean(process.env.OPENAI_API_KEY);
  const lastOpenAI = external.lastResult?.service === "openai" ? external.lastResult : null;
  const openAI = {
    configured,
    status: snapshot.reliability?.emergencyMode?.active
      ? "blocked"
      : !configured
        ? "offline"
        : lastOpenAI?.status || "configured",
    error: configured ? lastOpenAI?.error || null : "OPENAI_API_KEY_MISSING"
  };
  const report = buildShowHealthReport({
    storage,
    emergencyMode: Boolean(snapshot.reliability?.emergencyMode?.active),
    internet,
    openAI,
    externalRequests: external
  });
  return Response.json(report, { status: report.ok ? 200 : 503 });
}
