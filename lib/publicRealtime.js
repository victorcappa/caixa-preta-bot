const PROBE_INTERVAL_MS = 400;

let source = null;
let probeTimer = null;
let refreshPromise = null;
let latestPayload = null;
let latestRevision = -1;
let generation = 0;
const listeners = new Set();
const statusListeners = new Set();
let connectionStatus = "connecting";

function payloadRevision(payload) {
  const revision = Number(payload?.state?.revision);
  return Number.isFinite(revision) ? revision : -1;
}

function publish(payload) {
  const revision = payloadRevision(payload);

  if (revision >= 0 && revision < latestRevision) {
    return;
  }

  if (revision >= 0) {
    latestRevision = revision;
  }
  latestPayload = payload;

  for (const listener of listeners) {
    listener(payload);
  }
}

function publishStatus(status) {
  connectionStatus = status;
  for (const listener of statusListeners) {
    listener(status);
  }
}

async function refreshSnapshot() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshGeneration = generation;
  const request = fetch("/api/state", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("PUBLIC STATE UNAVAILABLE");
      return response.json();
    })
    .then((state) => {
      if (refreshGeneration === generation && listeners.size > 0) {
        publish({ event: { type: "snapshot" }, state });
      }
    })
    .catch(() => {})
    .finally(() => {
      if (refreshPromise === request) {
        refreshPromise = null;
      }
    });
  refreshPromise = request;

  return refreshPromise;
}

async function probeRevision() {
  if (listeners.size === 0) {
    return;
  }

  try {
    const response = await fetch("/api/state?revision=1", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const serverRevision = Number(data.revision);

    if (Number.isFinite(serverRevision) && serverRevision > latestRevision) {
      await refreshSnapshot();
    }
  } catch {
    // O último quadro válido continua visível durante interrupções breves.
  }
}

function start() {
  if (source || typeof window === "undefined") {
    return;
  }

  source = new EventSource("/api/events?client=public-display");
  source.onopen = () => publishStatus("connected");
  source.onmessage = (event) => {
    try {
      publish(JSON.parse(event.data));
    } catch {
      void refreshSnapshot();
    }
  };
  source.onerror = () => {
    publishStatus("disconnected");
    void refreshSnapshot();
  };

  void probeRevision();
  probeTimer = window.setInterval(probeRevision, PROBE_INTERVAL_MS);
}

function stop() {
  if (listeners.size > 0) {
    return;
  }

  source?.close();
  source = null;
  generation += 1;
  refreshPromise = null;
  window.clearInterval(probeTimer);
  probeTimer = null;
  latestPayload = null;
  latestRevision = -1;
  connectionStatus = "connecting";
}

export function subscribePublicRealtime(listener, onStatus = null) {
  listeners.add(listener);
  if (onStatus) statusListeners.add(onStatus);
  start();

  if (latestPayload) {
    listener(latestPayload);
  }
  if (onStatus) onStatus(connectionStatus);

  return () => {
    listeners.delete(listener);
    if (onStatus) statusListeners.delete(onStatus);
    stop();
  };
}
