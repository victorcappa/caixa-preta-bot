"use client";

import { useEffect, useRef } from "react";
import { PROJECTION_WINDOW_PARAM } from "@/lib/projectionScreens";

const STORAGE_KEY = "caixa-preta.projectionWindowId";
const HEARTBEAT_INTERVAL_MS = 5000;

function currentProjectionPath() {
  return `${window.location.pathname || "/"}${window.location.search || ""}`;
}

function projectionUrl(path, projectionWindowId) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set(PROJECTION_WINDOW_PARAM, projectionWindowId);
  return `${url.pathname}${url.search}`;
}

function resolveProjectionWindowId() {
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get(PROJECTION_WINDOW_PARAM)?.trim();

  if (queryId) {
    window.sessionStorage.setItem(STORAGE_KEY, queryId);
    return queryId;
  }

  return window.sessionStorage.getItem(STORAGE_KEY)?.trim() || "";
}

async function postProjectionAction(action, projectionWindowId, path, keepalive = false) {
  return fetch("/api/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, projectionWindowId, path }),
    keepalive
  });
}

export default function ProjectionWindowClient() {
  const commandIdsRef = useRef(new Set());
  const navigatingRef = useRef(false);

  useEffect(() => {
    let projectionWindowId = resolveProjectionWindowId();

    if (!projectionWindowId) {
      projectionWindowId = "";
    }

    let closed = false;
    const applyCommand = (command) => {
      if (!command || command.type !== "projection:navigate") {
        return;
      }

      if (command.projectionWindowId !== projectionWindowId || commandIdsRef.current.has(command.id)) {
        return;
      }

      const nextUrl = projectionUrl(command.path, projectionWindowId);
      const currentUrl = `${window.location.pathname || "/"}${window.location.search || ""}`;

      if (currentUrl === nextUrl) {
        commandIdsRef.current.add(command.id);
        return;
      }

      commandIdsRef.current.add(command.id);
      window.sessionStorage.setItem(STORAGE_KEY, projectionWindowId);
      navigatingRef.current = true;
      window.location.assign(nextUrl);
    };

    postProjectionAction("register", projectionWindowId, currentProjectionPath())
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "PROJECTION REGISTER ERROR");
        }
        return data;
      })
      .then((data) => {
        const registeredId = data.projectionWindowId || data.state?.activeProjectionWindowId;

        if (closed) {
          if (registeredId) {
            postProjectionAction("disconnect", registeredId, currentProjectionPath(), true).catch(() => {});
          }
          return;
        }

        if (registeredId) {
          projectionWindowId = registeredId;
          window.sessionStorage.setItem(STORAGE_KEY, registeredId);
        }

        applyCommand(data.state?.lastCommand);
      })
      .catch(() => {});

    const heartbeat = window.setInterval(() => {
      if (closed) {
        return;
      }

      postProjectionAction("heartbeat", projectionWindowId, currentProjectionPath())
        .then((response) => response.json())
        .then((data) => applyCommand(data.state?.lastCommand))
        .catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    const events = new EventSource("/api/events?client=projection-window");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const command = payload.command || payload.event?.command;

      if (payload.event?.type !== "projection:navigate" || !command) {
        return;
      }

      applyCommand(command);
    };

    function disconnect() {
      if (navigatingRef.current) {
        return;
      }

      closed = true;
      window.clearInterval(heartbeat);

      if (!projectionWindowId) {
        return;
      }

      const body = JSON.stringify({
        action: "disconnect",
        projectionWindowId,
        path: currentProjectionPath()
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/projection", new Blob([body], { type: "application/json" }));
        return;
      }

      fetch("/api/projection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    }

    window.addEventListener("pagehide", disconnect);

    return () => {
      window.removeEventListener("pagehide", disconnect);
      events.close();
      disconnect();
    };
  }, []);

  return null;
}
