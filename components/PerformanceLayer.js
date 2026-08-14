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

export default function PerformanceLayer({
  activities = [],
  events = [],
  game = null,
  instagram = { status: "DISCONNECTED", embedded: true },
  suitcase = null,
  onMachineBusyChange = () => {},
  phoneProjection = { status: "hidden" }
}) {
  const [activeEvents, setActiveEvents] = useState([]);
  const [drawingShapes, setDrawingShapes] = useState([]);
  const executedRef = useRef(new Set());
  const pendingInteractionsRef = useRef(0);

  useEffect(() => {
    const eventIds = new Set(events.map((event) => event.id));

    setActiveEvents((current) => current.filter((event) => eventIds.has(event.id)));
  }, [events]);

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

        if (event.type === "HIDE_PHONE_PROJECTION") {
          return;
        }

        if (event.type === "HIDE_INSTAGRAM" || event.type === "RETURN_TO_CHAT") {
          setActiveEvents((current) => current.filter((item) => item.type !== "SHOW_INSTAGRAM"));
          return;
        }

        if (event.type === "CLEAR_SCREEN") {
          setActiveEvents([]);
          return;
        }

        if (event.type === "DRAWING" || event.type === "START_DRAWING" || event.type === "ADD_DRAWING_ELEMENT") {
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
    pendingInteractionsRef.current += 1;
    onMachineBusyChange(true);

    try {
      await fetch("/api/performance/interaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          activityId: event.activityId,
          action,
          payload
        })
      });
    } catch {
      // Interaction failures should not freeze the public input.
    } finally {
      pendingInteractionsRef.current = Math.max(0, pendingInteractionsRef.current - 1);
      if (pendingInteractionsRef.current === 0) {
        onMachineBusyChange(false);
      }
    }
  }

  const hideUi = activeEvents.some((event) => event.type === "HIDE_UI");
  const blackout = activeEvents.some((event) => event.type === "BLACKOUT");
  const glitch = activeEvents.find((event) => event.type === "GLITCH");
  const overlayEvents = activeEvents.filter((event) => ![
    "HIDE_UI",
    "BLACKOUT",
    "GLITCH",
    "DRAWING",
    "START_DRAWING",
    "ADD_DRAWING_ELEMENT",
    "PHONE_PROJECTION_REQUEST",
    "HIDE_PHONE_PROJECTION",
    "HIDE_INSTAGRAM",
    "RETURN_TO_CHAT",
    "CLEAR_SCREEN"
  ].includes(event.type));

  const visiblePhoneProjection = phoneProjection?.status && phoneProjection.status !== "hidden"
    ? phoneProjection
    : null;
  const activityHangman = activities.find((activity) => (
    activity.type === "HANGMAN" && ["active", "paused"].includes(activity.status)
  ));
  const gameHangman = game?.id === "hangman" && game.active
    ? {
      id: game.id,
      type: "HANGMAN",
      status: game.active ? "active" : "completed",
      publicState: {
        progress: game.data?.progress,
        wrongGuesses: game.data?.wrongLetters || [],
        guessCount: game.round || 0,
        maxErrors: 6
      }
    }
    : null;
  const visibleHangman = activityHangman || gameHangman;
  const suitcaseGame = suitcase?.currentGame;
  const suitcaseHangman = suitcaseGame?.id === "hangman" && suitcaseGame.active
    ? {
      id: suitcaseGame.id,
      type: "HANGMAN",
      status: "active",
      publicState: {
        progress: suitcaseGame.publicState?.progress,
        wrongGuesses: suitcaseGame.publicState?.wrongLetters || [],
        guessCount: suitcaseGame.attempts || 0,
        maxErrors: 6
      }
    }
    : null;
  const visibleSuitcasePuzzle = suitcaseGame && suitcaseGame.active && ["scrambled_word", "riddle", "guess_the_rule"].includes(suitcaseGame.id)
    ? suitcaseGame
    : null;
  const visibleInstagramBrowser = instagram?.embedded && instagram.status && instagram.status !== "DISCONNECTED";

  if (!activeEvents.length && !drawingShapes.length && !visiblePhoneProjection && !visibleHangman && !suitcaseHangman && !visibleSuitcasePuzzle && !visibleInstagramBrowser) {
    return null;
  }

  return (
    <div className={`${styles.layer} ${hideUi ? styles.hideUi : ""} ${glitch ? styles.glitch : ""}`} aria-live="polite">
      {blackout ? <div className={styles.blackout} /> : null}
      {glitch ? <div className={styles.glitchText}>{glitch.payload.text || "////"}</div> : null}
      {visiblePhoneProjection ? (
        <div className={styles.phoneProjection}>
          <span>PHONE PROJECTION</span>
          <strong>{visiblePhoneProjection.status.replaceAll("_", " ").toUpperCase()}</strong>
          <small>
            {[visiblePhoneProjection.participant, visiblePhoneProjection.contentType, visiblePhoneProjection.privacyLevel]
              .filter(Boolean)
              .join(" / ")}
          </small>
        </div>
      ) : null}

      {visibleHangman ? <HangmanOverlay activity={visibleHangman} /> : null}
      {suitcaseHangman ? <HangmanOverlay activity={suitcaseHangman} label="MALA / FORCA" /> : null}
      {visibleSuitcasePuzzle ? <SuitcasePuzzle game={visibleSuitcasePuzzle} /> : null}
      {visibleInstagramBrowser ? <InstagramBrowser instagram={instagram} /> : null}

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

        if (event.type === "SHOW_INSTAGRAM") {
          return <InstagramOverlay event={event} key={event.id} />;
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
          <div className={["FLASH_TEXT"].includes(event.type) ? styles.flashText : resultClassName(event.type)} key={event.id}>
            {event.payload.text}
          </div>
        );
      })}
    </div>
  );
}

function resultClassName(type) {
  if (type === "SHOW_WIN") {
    return `${styles.fullscreenText} ${styles.winText}`;
  }

  if (type === "SHOW_LOSE") {
    return `${styles.fullscreenText} ${styles.loseText}`;
  }

  return styles.fullscreenText;
}

function HangmanOverlay({ activity, label = "FORCA" }) {
  const publicState = activity.publicState || {};
  const wrongGuesses = publicState.wrongGuesses || [];
  const maxErrors = Number(publicState.maxErrors || 6);
  const errorCount = wrongGuesses.length;
  const completed = activity.status === "completed";
  const solved = completed && !`${publicState.progress || ""}`.includes("_");

  return (
    <aside className={styles.hangman} aria-label="Forca">
      <span className={styles.hangmanLabel}>{label}</span>
      <strong className={styles.hangmanProgress}>{publicState.progress || "_ _ _"}</strong>
      <div className={styles.hangmanMeta}>
        <span>{errorCount}/{maxErrors}</span>
        <span>{Number(publicState.guessCount || 0)} palpites</span>
      </div>
      <div className={styles.hangmanWrong}>
        <span>ERROS</span>
        <b>{wrongGuesses.length ? wrongGuesses.join(" / ").toUpperCase() : "-"}</b>
      </div>
      {completed ? (
        <p className={styles.hangmanStatus}>{solved ? "ACERTOU" : "MORREU"}</p>
      ) : null}
    </aside>
  );
}

function InstagramOverlay({ event }) {
  const person = event.payload?.person || {};
  const posts = person.preparedFeed || [];

  return (
    <section className={styles.instagram} aria-label="Instagram">
      <header>
        <span>INSTAGRAM</span>
        <strong>{person.name || "VIDA NAO CADASTRADA"}</strong>
        <small>{person.instagramHandle || person.instagramUrl || "sem handle configurado"}</small>
      </header>
      <div className={styles.instagramGrid}>
        {(posts.length ? posts : Array.from({ length: 6 }, (_, index) => ({
          id: `${index + 1}`,
          label: `POST ${index + 1}`,
          caption: "material autorizado pendente"
        }))).map((post, index) => (
          <article className={styles.instagramPost} key={post.id || index}>
            <b>{post.label || `POST ${index + 1}`}</b>
            <p>{post.caption || "sem legenda preparada"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function InstagramBrowser({ instagram }) {
  const [frame, setFrame] = useState(null);
  const [frameError, setFrameError] = useState("");
  const viewportRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function loadFrame() {
      try {
        const response = await fetch(`/api/instagram/frame?t=${Date.now()}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("FRAME UNAVAILABLE");
        }

        const data = await response.json();
        if (!cancelled) {
          setFrame(data);
          setFrameError("");
        }
      } catch {
        if (!cancelled) {
          setFrameError("FRAME UNAVAILABLE");
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(loadFrame, instagram.status === "ACTING" || instagram.status === "NAVIGATING" ? 500 : 900);
        }
      }
    }

    loadFrame();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [instagram.status]);

  async function sendInput(payload) {
    await fetch("/api/instagram/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => null);
  }

  function handleClick(event) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    viewportRef.current.focus();
    sendInput({
      type: "click",
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    });
  }

  function handleKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.key.length === 1 || ["Backspace", "Delete", "Enter", "Escape", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      sendInput({ type: "key", key: event.key });
    }
  }

  return (
    <section className={styles.instagramBrowser} aria-label="Instagram real embutido">
      <header className={styles.instagramBrowserHeader}>
        <div>
          <span>INSTAGRAM REAL</span>
          <strong>{instagram.targetProfile ? `@${instagram.targetProfile}` : `@${instagram.account || "caixapretabot"}`}</strong>
        </div>
        <p>{instagram.message || instagram.status}</p>
      </header>

      <div
        aria-label="Frame interativo do Instagram"
        className={styles.instagramBrowserViewport}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        ref={viewportRef}
        role="application"
        tabIndex={0}
      >
        {frame?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Instagram real controlado pelo Playwright" draggable="false" src={frame.image} />
        ) : (
          <div className={styles.instagramBrowserPlaceholder}>{frameError || "CARREGANDO FRAME"}</div>
        )}
      </div>
    </section>
  );
}

function SuitcasePuzzle({ game }) {
  const publicState = game.publicState || {};

  return (
    <aside className={styles.puzzle} aria-label="Puzzle">
      <span>{game.name}</span>
      {game.id === "scrambled_word" ? <strong>{publicState.scrambled}</strong> : null}
      {game.id === "riddle" ? <strong>{publicState.prompt}</strong> : null}
      {game.id === "guess_the_rule" ? (
        <div className={styles.ruleExamples}>
          {(publicState.examples || []).map((example) => (
            <p key={example.word}>{example.accepted ? "ACEITO" : "NAO ACEITO"}: {example.word}</p>
          ))}
        </div>
      ) : null}
      {publicState.hints?.length ? (
        <p>PISTAS: {publicState.hints.join(" / ")}</p>
      ) : null}
      {publicState.tests?.length ? (
        <p>{publicState.tests.slice(-3).map((test) => `${test.accepted ? "ACEITO" : "NAO"} ${test.input}`).join(" / ")}</p>
      ) : null}
    </aside>
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
