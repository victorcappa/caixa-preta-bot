"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSegments, DEFAULT_FADE_MS, scriptLines } from "./script";
import styles from "./QuedaAviaoPlayer.module.css";

export default function QuedaAviaoPlayer() {
  const fallbackSegments = useMemo(() => buildSegments(scriptLines), []);
  const [playback, setPlayback] = useState(null);

  useEffect(() => {
    fetch("/api/queda-aviao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "display-connect" })
    }).catch(() => {});

    fetch("/api/queda-aviao")
      .then((response) => response.json())
      .then((data) => setPlayback(data))
      .catch(() => {});

    const events = new EventSource("/api/events?client=queda-aviao-display");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setPlayback(payload.state?.quedaAviao || null);
    };

    return () => {
      events.close();

      const body = JSON.stringify({ action: "display-disconnect" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/queda-aviao", new Blob([body], { type: "application/json" }));
        return;
      }

      fetch("/api/queda-aviao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    };
  }, []);

  const currentLine = playback?.currentSegment || fallbackSegments[0];
  const phase = playback?.phase || "entering";
  const fadeMs = playback?.fadeMs ?? DEFAULT_FADE_MS;

  return (
    <main className={styles.screen}>
      <p
        key={`${currentLine.id}-${playback?.playbackSequence || 0}`}
        className={[
          styles.line,
          currentLine.stage ? styles.stage : styles.dialogue,
          styles[phase]
        ].join(" ")}
        style={{ "--fade-ms": `${fadeMs}ms` }}
      >
        {currentLine.text}
      </p>
    </main>
  );
}
