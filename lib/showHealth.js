export function buildShowHealthReport({
  storage = { ok: false },
  emergencyMode = false,
  internet = { status: "unknown" },
  openAI = { status: "unknown" },
  externalRequests = { blocked: false, active: 0, lastResult: null },
  now = new Date().toISOString()
} = {}) {
  const core = {
    app: { status: "ok" },
    storage: {
      status: storage.ok ? "ok" : "offline",
      lastWrite: storage.lastWrite || null,
      error: storage.lastError || null
    },
    emergencyMode: {
      status: emergencyMode ? "active" : "inactive",
      active: Boolean(emergencyMode)
    }
  };
  const optional = {
    internet: { status: internet.status || "unknown", error: internet.error || null },
    openAI: { status: openAI.status || "unknown", configured: Boolean(openAI.configured), error: openAI.error || null },
    externalRequests: {
      status: externalRequests.blocked ? "blocked" : externalRequests.active ? "busy" : "idle",
      active: Number(externalRequests.active) || 0,
      lastResult: externalRequests.lastResult || null
    }
  };

  return {
    ok: Object.values(core).every((item) => item.status !== "offline"),
    status: Object.values(core).every((item) => item.status !== "offline") ? "ok" : "unhealthy",
    at: now,
    core,
    optional
  };
}
