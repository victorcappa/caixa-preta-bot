"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PerformanceLayer.module.css";

function randomPosition(index) {
  const x = (index * 37) % 92;
  const y = (index * 53) % 86;
  return { left: `${x}%`, top: `${y}%` };
}

function Shape({ shape }) {
  if (!shape) {
    return null;
  }

  if (shape.type === "circle") {
    return <circle cx={`${shape.x}%`} cy={`${shape.y}%`} r={`${shape.radius}%`} />;
  }

  if (shape.type === "rect") {
    return <rect x={`${shape.x}%`} y={`${shape.y}%`} width={`${shape.width}%`} height={`${shape.height}%`} />;
  }

  if (shape.type === "line") {
    return <line x1={`${shape.x}%`} y1={`${shape.y}%`} x2={`${shape.x2}%`} y2={`${shape.y2}%`} />;
  }

  if (shape.type === "polyline" || shape.type === "polygon") {
    const points = (shape.points || []).map((point) => `${point.x},${point.y}`).join(" ");
    const Element = shape.type;
    return <Element points={points} vectorEffect="non-scaling-stroke" />;
  }

  if (shape.type === "ellipse") {
    return <ellipse cx={`${shape.x}%`} cy={`${shape.y}%`} rx={`${shape.width / 2}%`} ry={`${shape.height / 2}%`} />;
  }

  if (shape.type === "text") {
    return <text x={`${shape.x}%`} y={`${shape.y}%`}>{shape.text}</text>;
  }

  return <circle cx={`${shape.x}%`} cy={`${shape.y}%`} r="3" />;
}

export default function PerformanceLayer({ events = [] }) {
  const [activeEvents, setActiveEvents] = useState([]);
  const [drawingShapes, setDrawingShapes] = useState([]);
  const executedRef = useRef(new Set());

  useEffect(() => {
    if (!events.length) {
      setActiveEvents([]);
      setDrawingShapes([]);
      executedRef.current.clear();
      return;
    }

    for (const event of events) {
      if (executedRef.current.has(event.id)) {
        continue;
      }

      executedRef.current.add(event.id);
      const delay = event.trigger?.type === "AFTER_DELAY" ? event.trigger.delayMs : event.delayMs || 0;
      const timer = setTimeout(() => {
        if (event.type === "CLEAR_DRAWING") {
          setDrawingShapes([]);
          return;
        }

        if (event.type === "DRAWING") {
          setDrawingShapes((current) => [...current, ...(event.payload.shapes || [])].slice(-64));
        }

        const activeEvent = event.type === "COUNTDOWN"
          ? {
            ...event,
            payload: {
              ...event.payload,
              startedAt: Date.now()
            }
          }
          : event;

        setActiveEvents((current) => {
          const next = activeEvent.interrupt ? [] : current;
          return [...next, activeEvent];
        });

        if (activeEvent.type !== "COUNTDOWN") {
          setTimeout(() => {
            setActiveEvents((current) => current.filter((item) => item.id !== activeEvent.id));
          }, activeEvent.durationMs || 1800);
        }
      }, delay);

      setTimeout(() => clearTimeout(timer), Math.max(delay + (event.durationMs || 1800) + 1000, 2000));
    }
  }, [events]);

  async function sendInteraction(event, action, payload = {}) {
    await fetch("/api/performance/interaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.id,
        activityId: event.activityId,
        action,
        payload
      })
    }).catch(() => {});
  }

  const hideUi = activeEvents.some((event) => event.type === "HIDE_UI");
  const blackout = activeEvents.some((event) => event.type === "BLACKOUT");
  const glitch = activeEvents.find((event) => event.type === "GLITCH");
  const overlayEvents = activeEvents.filter((event) => !["HIDE_UI", "BLACKOUT", "GLITCH", "DRAWING"].includes(event.type));

  if (!activeEvents.length && !drawingShapes.length) {
    return null;
  }

  return (
    <div className={`${styles.layer} ${hideUi ? styles.hideUi : ""} ${glitch ? styles.glitch : ""}`} aria-live="polite">
      {blackout ? <div className={styles.blackout} /> : null}
      {glitch ? <div className={styles.glitchText}>{glitch.payload.text || "////"}</div> : null}

      {drawingShapes.length ? (
        <svg className={styles.drawing} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {drawingShapes.map((shape) => (
            <g
              key={shape.id}
              fill={shape.fill}
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth}
              vectorEffect="non-scaling-stroke"
            >
              <Shape shape={shape} />
            </g>
          ))}
        </svg>
      ) : null}

      {overlayEvents.map((event) => {
        if (event.type === "REPEAT_TEXT") {
          return (
            <div className={styles.repeat} key={event.id}>
              {Array.from({ length: event.payload.count || 12 }).map((_, index) => (
                <span key={`${event.id}-${index}`} style={randomPosition(index)}>{event.payload.text}</span>
              ))}
            </div>
          );
        }

        if (event.type === "COUNTDOWN") {
          return (
            <Countdown
              event={event}
              key={event.id}
              onComplete={() => {
                sendInteraction(event, "countdown_complete");
                setActiveEvents((current) => current.filter((item) => item.id !== event.id));
              }}
            />
          );
        }

        if (event.type === "SHOW_SHAPE") {
          return (
            <svg className={styles.shape} key={event.id} viewBox="0 0 100 100" preserveAspectRatio="none">
              <g fill="none" stroke="#00ff66" strokeWidth="3" vectorEffect="non-scaling-stroke">
                <Shape shape={event.payload.shape} />
              </g>
            </svg>
          );
        }

        if (event.type === "FORBIDDEN_BUTTON") {
          return (
            <button
              className={styles.forbidden}
              key={event.id}
              onClick={() => sendInteraction(event, event.payload.eventInteraction || "FORBIDDEN_BUTTON_CLICK")}
              type="button"
            >
              {event.payload.label}
            </button>
          );
        }

        if (event.type === "MULTIPLE_CHOICE") {
          return (
            <div className={styles.choice} key={event.id}>
              <p>{event.payload.prompt}</p>
              {(event.payload.options || []).map((option) => (
                <button
                  key={option}
                  onClick={() => sendInteraction(event, "MULTIPLE_CHOICE_SELECT", { option })}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
          );
        }

        return (
          <div className={event.type === "FLASH_TEXT" ? styles.flashText : styles.fullscreenText} key={event.id}>
            {event.payload.text}
          </div>
        );
      })}
    </div>
  );
}

function countdownRemaining(payload = {}) {
  const duration = Number(payload.duration || payload.from || payload.seconds || 5);
  const startedAt = Number(payload.startedAt || Date.now());
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);

  return Math.max(0, duration - Math.max(0, elapsed));
}

function Countdown({ event, onComplete }) {
  const [value, setValue] = useState(() => countdownRemaining(event.payload));
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    function updateValue() {
      const nextValue = countdownRemaining(event.payload);
      setValue(nextValue);

      if (nextValue === 0 && !completedRef.current) {
        completedRef.current = true;
        setTimeout(() => onCompleteRef.current(), 650);
      }
    }

    updateValue();
    const timer = setInterval(() => {
      updateValue();
    }, 250);

    return () => clearInterval(timer);
  }, [event.payload]);

  return (
    <div className={styles.countdown}>
      {event.payload.label ? <span>{event.payload.label}</span> : null}
      <strong>{value}</strong>
    </div>
  );
}
