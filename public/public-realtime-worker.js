// One server stream for every bot/controller window on this origin.
// The worker belongs to all connected windows; closing/freezing one cannot own it.
const ports = new Set();
let source = null;
let latestPayload = null;
let status = "connecting";

function broadcast(message) {
  for (const port of ports) port.postMessage(message);
}

function start() {
  if (source) return;
  source = new EventSource("/api/events?client=public-display");
  source.onopen = () => {
    status = "connected";
    broadcast({ type: "status", status });
  };
  source.onerror = () => {
    status = "disconnected";
    broadcast({ type: "status", status });
    broadcast({ type: "refresh" });
  };
  source.onmessage = ({ data }) => {
    try {
      const payload = JSON.parse(data);
      if (Number(payload.state?.revision) < Number(latestPayload?.state?.revision)) return;
      latestPayload = payload;
      broadcast({ type: "payload", payload });
    } catch {
      broadcast({ type: "refresh" });
    }
  };
}

self.onconnect = ({ ports: [port] }) => {
  port.onmessage = ({ data }) => {
    if (data.type === "subscribe") {
      ports.add(port);
      port.postMessage({ type: "status", status });
      if (latestPayload) {
        // A new window hydrates from current state, never replays the last action.
        port.postMessage({ type: "payload", payload: { ...latestPayload, event: { type: "snapshot" } } });
      }
      start();
    }
    if (data.type === "unsubscribe") {
      ports.delete(port);
      port.close();
      if (ports.size === 0) {
        source?.close();
        source = null;
        latestPayload = null;
        status = "connecting";
      }
    }
  };
};
