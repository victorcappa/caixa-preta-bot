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

function postProjectionAction(action, projectionWindowId, path, keepalive = false) {
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
    const projectionWindowId = resolveProjectionWindowId();

    if (!projectionWindowId) {
      return undefined;
    }

    let closed = false;

    postProjectionAction("register", projectionWindowId, currentProjectionPath()).catch(() => {});

    const heartbeat = window.setInterval(() => {
      if (closed) {
        return;
      }

      postProjectionAction("heartbeat", projectionWindowId, currentProjectionPath()).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    const events = new EventSource("/api/events?client=projection-window");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const command = payload.command || payload.event?.command;

      if (payload.event?.type !== "projection:navigate" || !command) {
        return;
      }

      if (command.projectionWindowId !== projectionWindowId || commandIdsRef.current.has(command.id)) {
        return;
      }

      commandIdsRef.current.add(command.id);
      window.sessionStorage.setItem(STORAGE_KEY, projectionWindowId);
      navigatingRef.current = true;
      window.location.assign(projectionUrl(command.path, projectionWindowId));
    };

    function disconnect() {
      if (navigatingRef.current) {
        return;
      }

      closed = true;
      window.clearInterval(heartbeat);

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
