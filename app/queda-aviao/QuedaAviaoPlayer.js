"use client";

import { useEffect, useMemo, useState } from "react";
import DisplayBlackout from "@/components/DisplayBlackout";
import { PublicSceneAudioOutput } from "@/components/PublicSceneStage";
import { buildSegments, DEFAULT_FADE_MS, scriptLines } from "./script";
import styles from "./QuedaAviaoPlayer.module.css";

export default function QuedaAviaoPlayer() {
  const fallbackSegments = useMemo(() => buildSegments(scriptLines), []);
  const [playback, setPlayback] = useState(null);
  const [displayBlackout, setDisplayBlackout] = useState(null);
  const [sceneCue, setSceneCue] = useState(null);
  const [globalVolume, setGlobalVolume] = useState(1);

  useEffect(() => {
    let active = true;
    let refreshing = false;

    async function refreshDisplay() {
      if (refreshing) {
        return;
      }

      refreshing = true;

      try {
        const response = await fetch("/api/queda-aviao?display=1", { cache: "no-store" });
        const data = await response.json();

        if (!active) {
          return;
        }

        setPlayback(data);
        setDisplayBlackout(data.displayBlackout || null);
        setSceneCue(data.sceneCue || null);
        setGlobalVolume(data.globalVolume ?? 1);
      } catch {
        // Mantém o último quadro válido durante uma interrupção breve do servidor.
      } finally {
        refreshing = false;
      }
    }

    fetch("/api/queda-aviao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "display-connect" })
    }).catch(() => {});

    refreshDisplay();
    const refreshTimer = window.setInterval(refreshDisplay, 400);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);

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
      <PublicSceneAudioOutput
        controllerId="queda-aviao-sampler"
        globalVolume={globalVolume}
        sceneCue={sceneCue}
      />
      <DisplayBlackout blackout={displayBlackout} target="legenda" />
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
