"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSegments, DEFAULT_FADE_MS, scriptLines } from "./script";
import styles from "./QuedaAviaoPlayer.module.css";

export default function QuedaAviaoPlayer() {
  const lines = useMemo(() => buildSegments(scriptLines), []);
  const [lineIndex, setLineIndex] = useState(0);
  const [phase, setPhase] = useState("entering");

  useEffect(() => {
    const current = lines[lineIndex];
    const enterTimer = window.setTimeout(() => setPhase("visible"), 30);
    const exitTimer = window.setTimeout(() => setPhase("exiting"), current.holdMs + DEFAULT_FADE_MS);
    const nextTimer = window.setTimeout(() => {
      setLineIndex((index) => (index + 1) % lines.length);
      setPhase("entering");
    }, current.holdMs + DEFAULT_FADE_MS * 2);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(nextTimer);
    };
  }, [lineIndex, lines]);

  const currentLine = lines[lineIndex];

  return (
    <main className={styles.screen}>
      <p
        key={lineIndex}
        className={[
          styles.line,
          currentLine.stage ? styles.stage : styles.dialogue,
          styles[phase]
        ].join(" ")}
        style={{ "--fade-ms": `${DEFAULT_FADE_MS}ms` }}
      >
        {currentLine.text}
      </p>
    </main>
  );
}
