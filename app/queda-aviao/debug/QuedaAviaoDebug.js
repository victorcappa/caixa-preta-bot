"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSegments,
  DEFAULT_FADE_MS,
  scriptLines,
  subdivisionOptions
} from "../script";
import styles from "./QuedaAviaoDebug.module.css";

const defaultText = scriptLines.join("\n");

function clampIndex(index, length) {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

export default function QuedaAviaoDebug() {
  const [rawText, setRawText] = useState(defaultText);
  const [subdivision, setSubdivision] = useState("line");
  const [fadeMs, setFadeMs] = useState(DEFAULT_FADE_MS);
  const [pace, setPace] = useState(1);
  const [stageMultiplier, setStageMultiplier] = useState(1);
  const [autoPlay, setAutoPlay] = useState(false);
  const [loop, setLoop] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState("visible");

  const sourceLines = useMemo(
    () => rawText.split("\n").map((line) => line.trim()).filter(Boolean),
    [rawText]
  );
  const segments = useMemo(
    () => buildSegments(sourceLines, subdivision, { pace, stageMultiplier }),
    [sourceLines, subdivision, pace, stageMultiplier]
  );
  const current = segments[clampIndex(currentIndex, segments.length)];

  const showIndex = useCallback(
    (index) => {
      setCurrentIndex(clampIndex(index, segments.length));
      setPhase(fadeMs > 0 ? "entering" : "visible");
    },
    [fadeMs, segments.length]
  );

  const advance = useCallback(
    (delta) => {
      setCurrentIndex((index) => {
        if (segments.length <= 0) {
          return 0;
        }

        const next = index + delta;

        if (loop) {
          return (next + segments.length) % segments.length;
        }

        return clampIndex(next, segments.length);
      });
      setPhase(fadeMs > 0 ? "entering" : "visible");
    },
    [fadeMs, loop, segments.length]
  );

  useEffect(() => {
    setCurrentIndex((index) => clampIndex(index, segments.length));
  }, [segments.length]);

  useEffect(() => {
    if (!current || !autoPlay) {
      return undefined;
    }

    if (fadeMs <= 0) {
      setPhase("visible");
      const nextTimer = window.setTimeout(() => advance(1), current.holdMs);

      return () => window.clearTimeout(nextTimer);
    }

    const exitTimer = window.setTimeout(() => setPhase("exiting"), current.holdMs + fadeMs);
    const nextTimer = window.setTimeout(() => advance(1), current.holdMs + fadeMs * 2);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(nextTimer);
    };
  }, [advance, autoPlay, current, fadeMs]);

  useEffect(() => {
    if (phase !== "entering") {
      return undefined;
    }

    const enterTimer = window.setTimeout(() => setPhase("visible"), 30);

    return () => window.clearTimeout(enterTimer);
  }, [phase]);

  useEffect(() => {
    if (fadeMs <= 0) {
      setPhase("visible");
    }
  }, [fadeMs]);

  return (
    <main className={styles.debugScreen}>
      <section className={styles.preview} aria-live="polite">
        {current ? (
          <p
            key={current.id}
            className={[
              styles.line,
              current.stage ? styles.stage : styles.dialogue,
              styles[phase]
            ].join(" ")}
            style={{ "--fade-ms": `${fadeMs}ms` }}
          >
            {current.text}
          </p>
        ) : null}
      </section>

      <aside className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>QUEDA AVIÃO DEBUG</span>
          <span>{segments.length ? `${clampIndex(currentIndex, segments.length) + 1}/${segments.length}` : "0/0"}</span>
        </div>

        <div className={styles.transport}>
          <button type="button" onClick={() => showIndex(0)}>INÍCIO</button>
          <button type="button" onClick={() => advance(-1)}>ANTERIOR</button>
          <button type="button" className={styles.primaryButton} onClick={() => setAutoPlay((value) => !value)}>
            {autoPlay ? "PAUSAR" : "TOCAR"}
          </button>
          <button type="button" onClick={() => advance(1)}>PRÓXIMA</button>
        </div>

        <label className={styles.field}>
          <span>FALA / SEGMENTO</span>
          <input
            min="1"
            max={Math.max(segments.length, 1)}
            onChange={(event) => showIndex(Number(event.target.value) - 1)}
            type="number"
            value={segments.length ? clampIndex(currentIndex, segments.length) + 1 : 0}
          />
        </label>

        <label className={styles.field}>
          <span>SUBDIVISÃO</span>
          <select
            value={subdivision}
            onChange={(event) => {
              showIndex(0);
              setSubdivision(event.target.value);
            }}
          >
            {subdivisionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>FADE: {fadeMs}MS</span>
          <input
            max="3000"
            min="0"
            onChange={(event) => setFadeMs(Number(event.target.value))}
            step="50"
            type="range"
            value={fadeMs}
          />
        </label>

        <div className={styles.inlineActions}>
          <button type="button" onClick={() => setFadeMs(0)}>SEM FADE</button>
          <button type="button" onClick={() => setFadeMs(DEFAULT_FADE_MS)}>FADE PADRÃO</button>
        </div>

        <label className={styles.field}>
          <span>RITMO GERAL: {pace.toFixed(2)}X</span>
          <input
            max="2"
            min="0.35"
            onChange={(event) => setPace(Number(event.target.value))}
            step="0.05"
            type="range"
            value={pace}
          />
        </label>

        <label className={styles.field}>
          <span>TEMPO DAS RUBRICAS: {stageMultiplier.toFixed(2)}X</span>
          <input
            max="2.5"
            min="0.5"
            onChange={(event) => setStageMultiplier(Number(event.target.value))}
            step="0.05"
            type="range"
            value={stageMultiplier}
          />
        </label>

        <label className={styles.checkbox}>
          <input checked={loop} onChange={(event) => setLoop(event.target.checked)} type="checkbox" />
          <span>LOOP</span>
        </label>

        <div className={styles.segmentList}>
          {segments.map((segment, index) => (
            <button
              className={[
                styles.segmentButton,
                index === clampIndex(currentIndex, segments.length) ? styles.currentSegment : "",
                segment.stage ? styles.stageSegment : ""
              ].join(" ")}
              key={segment.id}
              onClick={() => showIndex(index)}
              type="button"
            >
              <span>{index + 1}</span>
              <span>{segment.text}</span>
            </button>
          ))}
        </div>

        <label className={styles.textEditor}>
          <span>TEXTO BASE</span>
          <textarea
            value={rawText}
            onChange={(event) => {
              showIndex(0);
              setRawText(event.target.value);
            }}
          />
        </label>
      </aside>
    </main>
  );
}
