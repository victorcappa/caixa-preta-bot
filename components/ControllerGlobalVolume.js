"use client";

import { useEffect, useRef, useState } from "react";
import {
  publishGlobalVolume,
  readStoredGlobalVolume
} from "@/lib/globalVolume";
import styles from "./ControllerGlobalVolume.module.css";
import { subscribePublicRealtime } from "@/lib/publicRealtime";

function clampPosition(position, control) {
  const { width, height } = control.getBoundingClientRect();
  return {
    left: Math.max(0, Math.min(position.left, window.innerWidth - width)),
    top: Math.max(0, Math.min(position.top, window.innerHeight - height))
  };
}

async function postGlobalVolume(volume) {
  const response = await fetch("/api/global-volume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ volume })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "VOLUME ERROR");
  return data.globalVolume;
}

export default function ControllerGlobalVolume() {
  const [volume, setVolume] = useState(1);
  const [status, setStatus] = useState("READY");
  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const controlRef = useRef(null);
  const dragRef = useRef(null);
  const lastAudibleRef = useRef(1);
  const requestRef = useRef(Promise.resolve());

  useEffect(() => {
    function keepOnScreen() {
      setPosition((current) => current && clampPosition(current, controlRef.current));
    }
    window.addEventListener("resize", keepOnScreen);
    return () => window.removeEventListener("resize", keepOnScreen);
  }, []);

  function startDrag(event) {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = controlRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(clampPosition({
      left: event.clientX - drag.offsetX,
      top: event.clientY - drag.offsetY
    }, controlRef.current));
  }

  function endDrag(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function moveWithKeyboard(event) {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const rect = controlRef.current.getBoundingClientRect();
    const step = event.shiftKey ? 40 : 10;
    setPosition(clampPosition({ left: rect.left + direction[0] * step, top: rect.top + direction[1] * step }, controlRef.current));
  }

  function apply(nextValue) {
    const next = publishGlobalVolume(nextValue);
    if (next > 0) lastAudibleRef.current = next;
    setVolume(next);
    return next;
  }

  useEffect(() => {
    const stored = readStoredGlobalVolume(null);
    fetch("/api/global-volume", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const initial = stored ?? data.globalVolume ?? 1;
        apply(initial);
        if (stored !== null && stored !== data.globalVolume) void postGlobalVolume(stored);
      })
      .catch(() => {
        apply(stored ?? 1);
        setStatus("OFFLINE");
      });

    return subscribePublicRealtime((payload) => {
      if (payload.event?.type === "operator-public") return;
      const next = payload.state?.globalVolume ?? payload.globalVolume;
      if (next !== undefined) apply(next);
    }, (connection) => setStatus(connection === "connected" ? "READY" : "OFFLINE"));
  }, []);

  async function update(nextValue) {
    const next = apply(nextValue);
    setStatus("...");
    try {
      const request = requestRef.current.catch(() => {}).then(() => postGlobalVolume(next));
      requestRef.current = request;
      await request;
      setStatus("READY");
    } catch {
      setStatus("OFFLINE");
    }
  }

  const muted = volume === 0;

  return (
    <aside
      className={styles.control}
      aria-label="Volume geral"
      ref={controlRef}
      style={position ? { ...position, right: "auto", transformOrigin: "top left" } : undefined}
    >
      <button className={styles.mute} onClick={() => update(muted ? lastAudibleRef.current : 0)} type="button">
        {muted ? "SOM ON" : "MUTE"}
      </button>
      <div className={styles.volumeField}>
        <button
          aria-label="Mover controle de volume"
          className={styles.dragHandle}
          data-dragging={dragging}
          onKeyDown={moveWithKeyboard}
          onLostPointerCapture={endDrag}
          onPointerCancel={endDrag}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          title="Arraste para mover ou use as setas do teclado"
          type="button"
        >
          VOLUME GERAL <small>{status}</small>
        </button>
        <strong>{Math.round(volume * 100)}%</strong>
        <input aria-label="Volume geral" max="1" min="0" onChange={(event) => update(event.target.value)} step="0.01" type="range" value={volume} />
      </div>
    </aside>
  );
}
