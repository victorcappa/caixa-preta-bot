const PROBE_INTERVAL_MS = 400;
const REQUEST_TIMEOUT_MS = 4000;

let started = false;
let worker = null;
let probeTimer = null;
let probePromise = null;
let refreshPromise = null;
const requests = new Set();
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
  if (connectionStatus === status) return;
  connectionStatus = status;
  for (const listener of statusListeners) {
    listener(status);
  }
}

async function readState(url) {
  const controller = new AbortController();
  requests.add(controller);
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("PUBLIC STATE UNAVAILABLE");
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
    requests.delete(controller);
  }
}

async function refreshSnapshot() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshGeneration = generation;
  const request = readState("/api/state")
    .then((state) => {
      if (refreshGeneration === generation && listeners.size > 0) {
        publish({ event: { type: "snapshot" }, state });
        publishStatus("connected");
      }
    })
    .catch(() => {
      if (refreshGeneration === generation) publishStatus("disconnected");
    })
    .finally(() => {
      if (refreshPromise === request) {
        refreshPromise = null;
      }
    });
  refreshPromise = request;

  return refreshPromise;
}

function probeRevision() {
  if (listeners.size === 0 || probePromise) return probePromise;
  const probeGeneration = generation;
  const request = readState("/api/state?revision=1")
    .then(async (data) => {
      if (probeGeneration !== generation || listeners.size === 0) return;
      const serverRevision = Number(data.revision);
      if (Number.isFinite(serverRevision) && serverRevision > latestRevision) await refreshSnapshot();
      else if (latestPayload) publishStatus("connected");
    })
    .catch(() => {
      // O último quadro válido continua visível durante interrupções breves.
      if (probeGeneration === generation) publishStatus("disconnected");
    })
    .finally(() => {
      if (probePromise === request) probePromise = null;
    });
  probePromise = request;
  return request;
}

function disconnectWorker() {
  if (!worker) return;
  worker.port.postMessage({ type: "unsubscribe" });
  worker.port.close();
  worker = null;
}

function connectWorker() {
  if (worker || typeof window.SharedWorker !== "function") return;
  try {
    const nextWorker = new window.SharedWorker("/public-realtime-worker.js", "caixa-preta-realtime-v1");
    worker = nextWorker;
    nextWorker.port.onmessage = ({ data }) => {
      if (worker !== nextWorker || listeners.size === 0) return;
      if (data.type === "payload") publish(data.payload);
      if (data.type === "status") publishStatus(data.status);
      if (data.type === "refresh") void refreshSnapshot();
    };
    nextWorker.onerror = () => {
      if (worker !== nextWorker) return;
      disconnectWorker();
      void refreshSnapshot();
    };
    nextWorker.port.postMessage({ type: "subscribe" });
  } catch {
    // Sem SharedWorker, só requisições finitas: nunca um SSE por janela.
    disconnectWorker();
  }
}

function recover() {
  connectWorker();
  void probeRevision();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  connectWorker();
  void probeRevision();
  probeTimer = window.setInterval(probeRevision, PROBE_INTERVAL_MS);
  window.addEventListener("online", recover);
  window.addEventListener("focus", recover);
  window.addEventListener("pageshow", recover);
  window.addEventListener("pagehide", disconnectWorker);
  document.addEventListener("visibilitychange", recover);
}

function stop() {
  if (listeners.size > 0) {
    return;
  }

  started = false;
  disconnectWorker();
  generation += 1;
  for (const controller of requests) controller.abort();
  refreshPromise = null;
  probePromise = null;
  window.clearInterval(probeTimer);
  probeTimer = null;
  latestPayload = null;
  latestRevision = -1;
  connectionStatus = "connecting";
  window.removeEventListener("online", recover);
  window.removeEventListener("focus", recover);
  window.removeEventListener("pageshow", recover);
  window.removeEventListener("pagehide", disconnectWorker);
  document.removeEventListener("visibilitychange", recover);
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
