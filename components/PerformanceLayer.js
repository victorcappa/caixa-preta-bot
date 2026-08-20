"use client";

import { useEffect, useRef, useState } from "react";
import useCountdownSound from "./useCountdownSound";
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
  const visibleVerdadeOuBolo = game?.id === "verdade_ou_bolo" && game.active
    ? game
    : null;

  if (!activeEvents.length && !drawingShapes.length && !visiblePhoneProjection && !visibleHangman && !suitcaseHangman && !visibleSuitcasePuzzle && !visibleVerdadeOuBolo) {
    return null;
  }

  return (
    <div className={`${styles.layer} ${visibleVerdadeOuBolo ? styles.gameSplit : ""} ${hideUi ? styles.hideUi : ""} ${glitch ? styles.glitch : ""}`} aria-live="polite">
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
      {visibleVerdadeOuBolo ? <VerdadeOuBoloShow game={visibleVerdadeOuBolo} /> : null}

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

function VerdadeOuBoloShow({ game }) {
  const data = game.data || {};
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const lastVideoSequenceRef = useRef(null);
  const lastAudioSequenceRef = useRef(null);
  const lastAutoAdvanceSequenceRef = useRef(null);
  const lastVoteTimeoutRef = useRef(null);
  const lastVideoReadyRef = useRef(null);
  const currentRound = data.currentRound || {};
  const video = currentRound.video || {};
  const state = data.state || game.phase;
  const selectedAnswer = data.selectedAnswer;
  const revealedAnswer = data.revealedAnswer;
  const result = data.result;
  const revealArmed = Boolean(data.revealArmed);
  const voteCountdown = data.voteCountdown || null;
  const autoAdvanceCommand = data.autoAdvanceCommand || null;
  const autoAdvanceAction = autoAdvanceCommand?.action || null;
  const autoAdvanceSequence = autoAdvanceCommand?.sequence || null;
  const autoAdvanceDelayMs = Number(autoAdvanceCommand?.delayMs || 0);
  const showVideo = ["QUESTION", "VOTING", "ANSWER_LOCKED", "REVEAL", "ROUND_RESULT"].includes(state);

  function playVideo(videoElement) {
    videoElement.muted = false;
    videoElement.play().catch((error) => {
      if (error?.name === "AbortError") {
        return;
      }

      videoElement.muted = true;
      videoElement.play().catch(() => {});
    });
  }

  useEffect(() => {
    const videoElement = videoRef.current;

    if (state !== "QUESTION") {
      return undefined;
    }

    const readyKey = `${currentRound.id || currentRound.number || "round"}:${video.src || "missing"}`;
    let firstFrameRequest = null;
    let fallbackFrame = null;
    let fallbackTimer = null;

    async function startVotingAfterFrame() {
      if (lastVideoReadyRef.current === readyKey) {
        return;
      }

      lastVideoReadyRef.current = readyKey;

      try {
        await fetch("/api/operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: "/game video-ready" })
        });
      } catch {
        lastVideoReadyRef.current = null;
      }
    }

    if (!videoElement || !video.src) {
      fallbackFrame = requestAnimationFrame(() => startVotingAfterFrame());
      return () => cancelAnimationFrame(fallbackFrame);
    }

    videoElement.pause();
    videoElement.load();

    function markReady() {
      try {
        if (videoElement.currentTime === 0) {
          videoElement.currentTime = 0.001;
        }
      } catch {
        // Seeking before enough data exists is codec-dependent.
      }

      if (typeof videoElement.requestVideoFrameCallback === "function") {
        firstFrameRequest = videoElement.requestVideoFrameCallback(() => startVotingAfterFrame());
        fallbackTimer = window.setTimeout(startVotingAfterFrame, 1000);
        return;
      }

      fallbackFrame = requestAnimationFrame(() => startVotingAfterFrame());
    }

    if (videoElement.readyState >= 2) {
      markReady();
    } else {
      videoElement.addEventListener("loadeddata", markReady, { once: true });
    }

    return () => {
      videoElement.removeEventListener("loadeddata", markReady);
      if (firstFrameRequest !== null && typeof videoElement.cancelVideoFrameCallback === "function") {
        videoElement.cancelVideoFrameCallback(firstFrameRequest);
      }
      if (fallbackFrame !== null) {
        cancelAnimationFrame(fallbackFrame);
      }
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, [currentRound.id, currentRound.number, state, video.src]);

  useEffect(() => {
    const videoElement = videoRef.current;
    const videoCommand = data.videoCommand;

    if (!videoElement || !videoCommand || lastVideoSequenceRef.current === videoCommand.sequence) {
      return;
    }

    lastVideoSequenceRef.current = videoCommand.sequence;

    if (videoCommand.action === "play") {
      playVideo(videoElement);
    }

    if (videoCommand.action === "pause") {
      videoElement.pause();
    }

    if (videoCommand.action === "reset" || videoCommand.action === "restart") {
      videoElement.pause();
      try {
        videoElement.currentTime = 0;
      } catch {
        // Some video codecs reject seeking before metadata is ready.
      }

      if (videoCommand.action === "restart") {
        playVideo(videoElement);
      }
    }
  }, [data.videoCommand, video.src]);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement || !revealArmed) {
      return undefined;
    }

    async function revealAfterVideoEnds() {
      try {
        await fetch("/api/operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: "/game video-ended" })
        });
      } catch {
        // The operator can still reveal/recover manually if this network hop fails.
      }
    }

    videoElement.addEventListener("ended", revealAfterVideoEnds, { once: true });
    return () => videoElement.removeEventListener("ended", revealAfterVideoEnds);
  }, [revealArmed, video.src]);

  useEffect(() => {
    const audioCommand = data.audioCommand;

    if (!audioCommand || lastAudioSequenceRef.current === audioCommand.sequence) {
      return;
    }

    lastAudioSequenceRef.current = audioCommand.sequence;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    if (audioCommand.action === "stop" || !audioCommand.src) {
      return;
    }

    const audio = new Audio(audioCommand.src);
    audioRef.current = audio;
    audio.play().catch(() => {});
  }, [data.audioCommand]);

  useEffect(() => {
    if (autoAdvanceAction !== "next" || !autoAdvanceSequence) {
      return undefined;
    }

    if (lastAutoAdvanceSequenceRef.current === autoAdvanceSequence) {
      return undefined;
    }

    lastAutoAdvanceSequenceRef.current = autoAdvanceSequence;
    const timer = setTimeout(async () => {
      try {
        await fetch("/api/operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: "/game next" })
        });
      } catch {
        // The operator can still recover with the manual next button.
      }
    }, Math.max(0, autoAdvanceDelayMs));

    return () => clearTimeout(timer);
  }, [autoAdvanceAction, autoAdvanceDelayMs, autoAdvanceSequence]);

  useEffect(() => () => {
    videoRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, []);

  async function handleVoteTimeout(countdown) {
    const timeoutKey = `${countdown?.startedAt || ""}:${countdown?.endsAt || ""}`;

    if (!timeoutKey || lastVoteTimeoutRef.current === timeoutKey) {
      return;
    }

    lastVoteTimeoutRef.current = timeoutKey;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch("/api/operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: "/game vote-timeout" })
        });

        if (response.ok) {
          return;
        }
      } catch {
        // Retry below before leaving manual reveal as the recovery path.
      }

      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }

    lastVoteTimeoutRef.current = null;
  }

  if (state === "INTRO") {
    return (
      <section className={`${styles.verdadeOuBolo} ${styles.verdadeOuBoloIntro}`} aria-label="Verdade ou Bolo">
        <div className={styles.vobTitleStack}>
          <span>VERDADE</span>
          <span>OU</span>
          <span>BOLO?</span>
        </div>
      </section>
    );
  }

  if (state === "GAME_RESULT") {
    return (
      <section className={`${styles.verdadeOuBolo} ${styles.verdadeOuBoloFinal}`} aria-label="Resultado final">
        <span className={styles.vobKicker}>FIM DE JOGO</span>
        <strong>{data.score || 0} / {data.totalRounds || 4}</strong>
        <p>{data.finalMessage || "FIM DE JOGO."}</p>
      </section>
    );
  }

  return (
    <section className={styles.verdadeOuBolo} aria-label="Verdade ou Bolo">
      <header className={styles.vobHeader}>
        <strong>{data.title || "VERDADE OU BOLO?"}</strong>
        <span>{currentRound.number || 1} / {currentRound.total || data.totalRounds || 4}</span>
      </header>

      <div className={styles.vobVideoFrame}>
        {showVideo && video.src ? (
          <video
            className={styles.vobVideo}
            controls={false}
            key={video.src}
            playsInline
            preload="auto"
            ref={videoRef}
            src={video.src}
          />
        ) : showVideo ? (
          <div className={styles.vobMissingVideo}>
            <strong>VIDEO AUSENTE</strong>
            <span>assets/videos/verdade-ou-bolo/</span>
          </div>
        ) : (
          <div className={styles.vobDecisionPrompt}>
            <strong>DECIDAM</strong>
            <span>VERDADE OU BOLO?</span>
          </div>
        )}
      </div>

      <div className={styles.vobChoices} aria-hidden="true">
        <span className={selectedAnswer === "verdade" ? styles.vobChoiceSelected : ""}>VERDADE</span>
        <span className={selectedAnswer === "bolo" ? styles.vobChoiceSelected : ""}>BOLO</span>
      </div>

      {state === "VOTING" && voteCountdown ? (
        <VobVoteCountdown countdown={voteCountdown} onComplete={handleVoteTimeout} />
      ) : null}

      {["REVEAL", "ROUND_RESULT"].includes(state) && result ? (
        <div className={`${styles.vobReveal} ${result.won ? styles.vobRevealWin : styles.vobRevealLose}`}>
          <strong>{revealedAnswer === "verdade" ? "É VERDADE" : "NÃO É VERDADE"}</strong>
          <span>{result.noVote ? "SEM VOTO" : result.won ? "ACERTARAM" : "ERRARAM"}</span>
        </div>
      ) : null}
    </section>
  );
}

function vobCountdownRemaining(countdown = {}) {
  const endsAt = Number(countdown.endsAt || 0);

  if (Number.isFinite(endsAt) && endsAt > 0) {
    return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  }

  const duration = Number(countdown.durationSeconds || 10);
  const startedAt = Number(countdown.startedAt || Date.now());
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, duration - Math.max(0, elapsed));
}

function VobVoteCountdown({ countdown, onComplete }) {
  const [value, setValue] = useState(() => vobCountdownRemaining(countdown));
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useCountdownSound(value, {
    countdownKey: `vob:${countdown?.startedAt || ""}:${countdown?.endsAt || ""}`
  });

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    completedRef.current = false;

    function updateValue() {
      const nextValue = vobCountdownRemaining(countdown);
      setValue(nextValue);

      if (nextValue === 0 && !completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current(countdown);
      }
    }

    updateValue();
    const timer = setInterval(updateValue, 200);
    return () => clearInterval(timer);
  }, [countdown]);

  return (
    <aside className={styles.vobVoteCountdown} aria-label="Tempo para votar">
      <span>VOTO</span>
      <strong>{value}</strong>
    </aside>
  );
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
  useCountdownSound(value, { countdownKey: `performance:${event.id}` });

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
