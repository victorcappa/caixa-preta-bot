"use client";

import { useEffect, useRef, useState } from "react";
import {
  GLOBAL_VOLUME_EVENT,
  normalizeGlobalVolume,
  publishGlobalVolume,
  readStoredGlobalVolume
} from "@/lib/globalVolume";
import styles from "./ControllerGlobalVolume.module.css";

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
  const lastAudibleRef = useRef(1);
  const requestRef = useRef(Promise.resolve());

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

    const events = new EventSource("/api/events?client=controller-global-volume");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const next = payload.state?.globalVolume ?? payload.globalVolume;
      if (next !== undefined) apply(next);
    };
    events.onerror = () => setStatus("OFFLINE");
    events.onopen = () => setStatus("READY");
    return () => events.close();
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
    <aside className={styles.control} aria-label="Volume geral">
      <button onClick={() => update(muted ? lastAudibleRef.current : 0)} type="button">
        {muted ? "SOM ON" : "MUTE"}
      </button>
      <label>
        <span>VOLUME GERAL <small>{status}</small></span>
        <strong>{Math.round(volume * 100)}%</strong>
        <input aria-label="Volume geral" max="1" min="0" onChange={(event) => update(event.target.value)} step="0.01" type="range" value={volume} />
      </label>
    </aside>
  );
}
