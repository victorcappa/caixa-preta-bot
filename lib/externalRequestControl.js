const activeControllers = new Set();

let blocked = false;
let lastResult = {
  service: null,
  status: "unknown",
  at: null,
  durationMs: null,
  error: null
};

export class ExternalRequestBlockedError extends Error {
  constructor(message = "EXTERNAL_REQUESTS_BLOCKED") {
    super(message);
    this.name = "ExternalRequestBlockedError";
    this.code = "EXTERNAL_REQUESTS_BLOCKED";
  }
}

export class ExternalRequestTimeoutError extends Error {
  constructor(service, timeoutMs) {
    super(`${service || "external"} timeout after ${timeoutMs}ms`);
    this.name = "ExternalRequestTimeoutError";
    this.code = "EXTERNAL_REQUEST_TIMEOUT";
    this.service = service || "external";
    this.timeoutMs = timeoutMs;
  }
}

export function setExternalRequestsBlocked(nextBlocked) {
  blocked = Boolean(nextBlocked);
  if (blocked) abortExternalRequests("EMERGENCY_MODE");
  return blocked;
}

export function externalRequestsBlocked() {
  return blocked;
}

export function abortExternalRequests(reason = "ABORTED") {
  for (const controller of activeControllers) {
    controller.abort(reason);
  }
  activeControllers.clear();
}

export function externalRequestStatus() {
  return {
    blocked,
    active: activeControllers.size,
    lastResult: { ...lastResult }
  };
}

export async function runExternalRequest(service, operation, { timeoutMs = 8000 } = {}) {
  if (blocked) throw new ExternalRequestBlockedError();

  const safeTimeoutMs = Math.max(250, Math.min(60000, Number(timeoutMs) || 8000));
  const controller = new AbortController();
  const startedAt = Date.now();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort("TIMEOUT");
  }, safeTimeoutMs);

  activeControllers.add(controller);
  try {
    const result = await operation(controller.signal);
    lastResult = {
      service,
      status: "ok",
      at: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      error: null
    };
    return result;
  } catch (error) {
    const normalizedError = timedOut
      ? new ExternalRequestTimeoutError(service, safeTimeoutMs)
      : error;
    lastResult = {
      service,
      status: timedOut ? "timeout" : blocked ? "blocked" : "error",
      at: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      error: normalizedError?.code || normalizedError?.name || "EXTERNAL_REQUEST_ERROR"
    };
    throw normalizedError;
  } finally {
    clearTimeout(timer);
    activeControllers.delete(controller);
  }
}
