"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DisplayBlackout from "./DisplayBlackout";
import InstagramBrowserPanel from "./InstagramBrowserPanel";
import GlitchOverlay from "./GlitchOverlay";
import OperatorConsole from "./OperatorConsole";
import PerformanceLayer from "./PerformanceLayer";
import SceneZeroProjectionLayer from "./SceneZeroProjectionLayer";
import Terminal from "./Terminal";
import styles from "./Chat.module.css";
import { PUBLIC_TYPE_INTERVAL_MS } from "@/lib/messageTiming";
import { robotSoundEngine } from "@/lib/robot-sound/RobotSoundEngine";

const INTRO_READY_TEXT = "TEM ALGUEM AI?";
const INTRO_DOTS_TEXT = "...";
const TYPE_INTERVAL_MS = PUBLIC_TYPE_INTERVAL_MS;
const DEFAULT_OPERATOR_WIDTH = 520;
const DEFAULT_INSTAGRAM_WIDTH = 520;
const DEFAULT_INSTAGRAM_HEIGHT = 480;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function storedNumber(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [typedReplies, setTypedReplies] = useState({});
  const [introText, setIntroText] = useState("");
  const [introDotsText, setIntroDotsText] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("CONNECTING");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [performancePending, setPerformancePending] = useState(false);
  const [performanceEvents, setPerformanceEvents] = useState([]);
  const [performanceActivities, setPerformanceActivities] = useState([]);
  const [phoneProjection, setPhoneProjection] = useState({ status: "hidden" });
  const [instagram, setInstagram] = useState({ status: "DISCONNECTED", embedded: true });
  const [game, setGame] = useState(null);
  const [suitcase, setSuitcase] = useState(null);
  const [glitch, setGlitch] = useState(null);
  const [robotSound, setRobotSound] = useState(null);
  const [displayBlackout, setDisplayBlackout] = useState(null);
  const [sceneZero, setSceneZero] = useState(null);
  const [introStep, setIntroStep] = useState("cursor");
  const [manualOpen, setManualOpen] = useState(false);
  const [operatorMounted, setOperatorMounted] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [instagramPanelClosed, setInstagramPanelClosed] = useState(false);
  const [operatorWidth, setOperatorWidth] = useState(DEFAULT_OPERATOR_WIDTH);
  const [instagramWidth, setInstagramWidth] = useState(DEFAULT_INSTAGRAM_WIDTH);
  const [instagramHeight, setInstagramHeight] = useState(DEFAULT_INSTAGRAM_HEIGHT);
  const workspaceRef = useRef(null);
  const chatPaneRef = useRef(null);
  const scrollRef = useRef(null);
  const initializedMessagesRef = useRef(false);
  const seenMessageIdsRef = useRef(new Set());
  const typingTimersRef = useRef(new Map());
  const typingQueueRef = useRef([]);
  const concurrentTypingRef = useRef(false);
  const drainTypingQueueRef = useRef(null);
  const introTimerRef = useRef(null);
  const introDotsTimerRef = useRef(null);
  const chatRequestControllerRef = useRef(null);
  const stoppedTypingIdsRef = useRef(new Set());
  const notifiedTypedIdsRef = useRef(new Set());
  const soundOutputResetSequenceRef = useRef(null);

  const notifySceneZeroMessageTyped = useCallback((messageId) => {
    if (!messageId || notifiedTypedIdsRef.current.has(messageId)) return;
    notifiedTypedIdsRef.current.add(messageId);

    const send = async (attempt = 0) => {
      try {
        const response = await fetch("/api/scene-zero", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "message-typed", messageId }),
          keepalive: true
        });
        if (!response.ok) throw new Error("scene-zero timing ack failed");
      } catch {
        if (attempt < 2) {
          window.setTimeout(() => send(attempt + 1), 500 * (attempt + 1));
          return;
        }
        notifiedTypedIdsRef.current.delete(messageId);
      }
    };

    send();
  }, []);

  useEffect(() => {
    function hydrateInitialMessages(nextMessages) {
      const initialReplies = {};

      for (const message of nextMessages) {
        seenMessageIdsRef.current.add(message.id);
        if (message.role === "assistant") {
          initialReplies[message.id] = message.content;
        }
      }

      setTypedReplies(initialReplies);
      setMessages(nextMessages);
      initializedMessagesRef.current = true;
    }

    fetch("/api/state")
      .then((response) => response.json())
      .then((data) => {
        setPerformanceEvents(data.performance?.events || []);
        setPerformanceActivities(data.performance?.activities || []);
        setPhoneProjection(data.performance?.phoneProjection || { status: "hidden" });
        setInstagram(data.instagram || { status: "DISCONNECTED", embedded: true });
        setGame(data.game || null);
        setSuitcase(data.suitcase || null);
        setGlitch(data.glitch || null);
        setRobotSound(data.robotSound || null);
        setDisplayBlackout(data.displayBlackout || null);
        setSceneZero(data.sceneZero || null);

        if (!initializedMessagesRef.current) {
          hydrateInitialMessages(data.conversation || []);
          return;
        }

        setMessages(data.conversation || []);
      })
      .catch(() => setStatus("DISCONNECTED"));

    const events = new EventSource("/api/events?client=chat");
    events.onopen = () => setStatus("CONNECTED");
    events.onerror = () => setStatus("DISCONNECTED");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.event?.type === "stop-all") {
        window.dispatchEvent(new CustomEvent("caixa-preta:stopall"));
        return;
      }
      if (payload.event?.type === "reset") {
        robotSoundEngine.stopAll();
      }
      if (payload.event?.type === "baralho-morbido" || payload.event?.type === "baralho-morbido-display") {
        return;
      }

      if (!initializedMessagesRef.current && payload.event?.type === "snapshot") {
        setPerformanceEvents(payload.state.performance?.events || []);
        setPerformanceActivities(payload.state.performance?.activities || []);
        setPhoneProjection(payload.state.performance?.phoneProjection || { status: "hidden" });
        setInstagram(payload.state.instagram || { status: "DISCONNECTED", embedded: true });
        setGame(payload.state.game || null);
        setSuitcase(payload.state.suitcase || null);
        setGlitch(payload.state.glitch || null);
        setRobotSound(payload.state.robotSound || null);
        setDisplayBlackout(payload.state.displayBlackout || null);
        setSceneZero(payload.state.sceneZero || null);
        hydrateInitialMessages(payload.state.conversation || []);
        return;
      }

      setMessages(payload.state.conversation || []);
      setPerformanceEvents(payload.state.performance?.events || []);
      setPerformanceActivities(payload.state.performance?.activities || []);
      setPhoneProjection(payload.state.performance?.phoneProjection || { status: "hidden" });
      setInstagram(payload.state.instagram || { status: "DISCONNECTED", embedded: true });
      setGame(payload.state.game || null);
      setSuitcase(payload.state.suitcase || null);
      setGlitch(payload.state.glitch || null);
      setRobotSound(payload.state.robotSound || null);
      setDisplayBlackout(payload.state.displayBlackout || null);
      setSceneZero(payload.state.sceneZero || null);
    };

    return () => events.close();
  }, []);

  useEffect(() => {
    setOperatorWidth(storedNumber("caixa-preta.operatorWidth", DEFAULT_OPERATOR_WIDTH));
    setInstagramWidth(storedNumber("caixa-preta.instagramWidth", DEFAULT_INSTAGRAM_WIDTH));
    setInstagramHeight(storedNumber("caixa-preta.instagramHeight", DEFAULT_INSTAGRAM_HEIGHT));
  }, []);

  useEffect(() => robotSoundEngine.armAutoUnlock(), []);

  useEffect(() => robotSoundEngine.armAudioRelay(), []);

  useEffect(() => {
    if (!robotSound) return;

    robotSoundEngine.setSettings(robotSound);
    const resetSequence = Number(robotSound.outputResetSequence || 0);
    if (soundOutputResetSequenceRef.current !== null && resetSequence !== soundOutputResetSequenceRef.current) {
      void robotSoundEngine.reconnectOutput();
    }
    soundOutputResetSequenceRef.current = resetSequence;
  }, [robotSound]);

  useEffect(() => {
    robotSoundEngine.setGlitch(glitch || {});
  }, [glitch]);

  const browserProcessing = ["STARTING", "NAVIGATING", "ACTING"].includes(instagram.status);
  const informationProcessing = pending || performancePending || browserProcessing;

  useEffect(() => {
    if (informationProcessing) {
      robotSoundEngine.startThinking();
    } else {
      robotSoundEngine.stopThinking();
    }
    return () => robotSoundEngine.stopThinking();
  }, [informationProcessing]);

  useEffect(() => {
    if (!manualOpen) {
      return undefined;
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setManualOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [manualOpen]);

  useEffect(() => {
    if (instagram.status === "STARTING" || instagram.status === "DISCONNECTED") {
      setInstagramPanelClosed(false);
    }
  }, [instagram.status]);

  useEffect(() => {
    if (instagram.embeddedPanelSequence > 0) {
      setInstagramPanelClosed(false);
    }
  }, [instagram.embeddedPanelSequence]);

  useEffect(() => {
    if (instagram.browserMode !== "google_guidance") return;
    const halfScreen = Math.round(window.innerWidth / 2);
    setInstagramWidth(halfScreen);
  }, [instagram.browserMode]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, introStep, introDotsText, introText, typedReplies]);

  const startTypingMessage = useCallback((message) => {
    if (!message?.id || typingTimersRef.current.has(message.id)) {
      return;
    }

    setTypedReplies((current) => ({ ...current, [message.id]: "" }));
    robotSoundEngine.wake();
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTypedReplies((current) => ({
        ...current,
        [message.id]: message.content.slice(0, index)
      }));
      robotSoundEngine.typing(message.content[index - 1]);

      if (index >= message.content.length) {
        clearInterval(timer);
        typingTimersRef.current.delete(message.id);
        robotSoundEngine.complete();
        robotSoundEngine.success();
        if (["scene-zero-collection", "scene-zero-roulette", "scene-zero-cake-comment"].includes(message.source)) {
          notifySceneZeroMessageTyped(message.id);
        }
        drainTypingQueueRef.current?.();
      }
    }, TYPE_INTERVAL_MS);

    typingTimersRef.current.set(message.id, timer);
  }, [notifySceneZeroMessageTyped]);

  const drainTypingQueue = useCallback(() => {
    if (concurrentTypingRef.current) {
      while (typingQueueRef.current.length) {
        startTypingMessage(typingQueueRef.current.shift());
      }
      return;
    }

    if (typingTimersRef.current.size === 0 && typingQueueRef.current.length > 0) {
      startTypingMessage(typingQueueRef.current.shift());
    }
  }, [startTypingMessage]);

  useEffect(() => {
    drainTypingQueueRef.current = drainTypingQueue;
  }, [drainTypingQueue]);

  useEffect(() => {
    concurrentTypingRef.current = ["glitch", "collapse"].includes(sceneZero?.stage);

    if (initializedMessagesRef.current && messages.length === 0) {
      for (const timer of typingTimersRef.current.values()) {
        clearInterval(timer);
      }

      typingTimersRef.current.clear();
      typingQueueRef.current = [];
      seenMessageIdsRef.current.clear();
      stoppedTypingIdsRef.current.clear();
      notifiedTypedIdsRef.current.clear();
      setTypedReplies({});
    }

    if (!initializedMessagesRef.current) {
      return undefined;
    }

    for (const message of messages) {
      if (seenMessageIdsRef.current.has(message.id)) {
        continue;
      }

      seenMessageIdsRef.current.add(message.id);
      stoppedTypingIdsRef.current.delete(message.id);

      if (message.role === "assistant") {
        typingQueueRef.current.push(message);
      }
    }

    drainTypingQueue();
    return undefined;
  }, [drainTypingQueue, messages, sceneZero?.stage]);

  useEffect(() => {
    const waitingMessageIds = [
      sceneZero?.participantSelection?.status === "awaiting_invite"
        ? sceneZero.participantSelection.inviteMessageId
        : null,
      sceneZero?.collection?.activeCountdown?.status === "awaiting_message"
        ? sceneZero.collection.activeCountdown.messageId
        : null,
      game?.id === "verdade_ou_bolo" && ["REVEAL", "ROUND_RESULT"].includes(game?.data?.state)
        ? [...messages].reverse().find((message) => message.source === "scene-zero-cake-comment")?.id
        : null
    ].filter(Boolean);

    for (const messageId of waitingMessageIds) {
      const message = messages.find((candidate) => candidate.id === messageId);
      if (message && typedReplies[messageId] === message.content) {
        notifySceneZeroMessageTyped(messageId);
      }
    }
  }, [game?.data?.state, game?.id, messages, notifySceneZeroMessageTyped, sceneZero, typedReplies]);

  useEffect(() => {
    const typingTimers = typingTimersRef.current;

    return () => {
      for (const timer of typingTimers.values()) {
        clearInterval(timer);
      }
      typingQueueRef.current = [];

      clearInterval(introTimerRef.current);
      clearInterval(introDotsTimerRef.current);
      chatRequestControllerRef.current?.abort();
      robotSoundEngine.stopAll();
    };
  }, []);

  useEffect(() => {
    function stopChatOutput() {
      chatRequestControllerRef.current?.abort();
      chatRequestControllerRef.current = null;

      for (const [messageId, timer] of typingTimersRef.current.entries()) {
        clearInterval(timer);
        stoppedTypingIdsRef.current.add(messageId);
      }

      typingTimersRef.current.clear();
      typingQueueRef.current = [];
      clearInterval(introTimerRef.current);
      clearInterval(introDotsTimerRef.current);
      robotSoundEngine.stopAll();
      setPending(false);
    }

    window.addEventListener("caixa-preta:stopall", stopChatOutput);
    return () => window.removeEventListener("caixa-preta:stopall", stopChatOutput);
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      setIntroStep("cursor");
      setIntroDotsText("");
      setIntroText("");
    }

    if (messages.length > 0) {
      setIntroStep("ready");
      setIntroDotsText("");
      setIntroText("");
      return undefined;
    }

    const dotsTimer = setTimeout(() => setIntroStep("dots"), 2200);
    const readyTimer = setTimeout(() => setIntroStep("ready"), 3900);

    return () => {
      clearTimeout(dotsTimer);
      clearTimeout(readyTimer);
    };
  }, [messages.length]);

  useEffect(() => {
    clearInterval(introDotsTimerRef.current);

    if (messages.length > 0 || introStep !== "dots") {
      return undefined;
    }

    setIntroDotsText("");

    let index = 0;
    introDotsTimerRef.current = setInterval(() => {
      index += 1;
      setIntroDotsText(INTRO_DOTS_TEXT.slice(0, index));
      robotSoundEngine.typing(INTRO_DOTS_TEXT[index - 1]);

      if (index >= INTRO_DOTS_TEXT.length) {
        clearInterval(introDotsTimerRef.current);
        introDotsTimerRef.current = null;
      }
    }, TYPE_INTERVAL_MS * 5);

    return () => {
      clearInterval(introDotsTimerRef.current);
      introDotsTimerRef.current = null;
    };
  }, [introStep, messages.length]);

  useEffect(() => {
    clearInterval(introTimerRef.current);

    if (messages.length > 0 || introStep !== "ready") {
      return undefined;
    }

    setIntroText("");
    robotSoundEngine.wake();

    let index = 0;
    introTimerRef.current = setInterval(() => {
      index += 1;
      setIntroText(INTRO_READY_TEXT.slice(0, index));
      robotSoundEngine.typing(INTRO_READY_TEXT[index - 1]);

      if (index >= INTRO_READY_TEXT.length) {
        clearInterval(introTimerRef.current);
        introTimerRef.current = null;
        robotSoundEngine.complete();
      }
    }, TYPE_INTERVAL_MS);

    return () => {
      clearInterval(introTimerRef.current);
      introTimerRef.current = null;
    };
  }, [introStep, messages.length]);

  async function submitMessage(event) {
    event.preventDefault();

    const content = input.trim();
    if (!content || pending || performancePending || activeTypingAssistant) {
      return;
    }

    setInput("");
    setError("");
    setPending(true);

    const controller = new AbortController();
    chatRequestControllerRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
        signal: controller.signal
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao conversar com a Caixa Preta.");
      }
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message);
        robotSoundEngine.error();
      }
    } finally {
      if (chatRequestControllerRef.current === controller) {
        chatRequestControllerRef.current = null;
      }
      setPending(false);
    }
  }

  function toggleOperator() {
    if (operatorOpen) {
      setOperatorOpen(false);
      return;
    }

    setOperatorMounted(true);
    requestAnimationFrame(() => setOperatorOpen(true));
  }

  function beginOperatorResize(event) {
    const workspaceRect = workspaceRef.current?.getBoundingClientRect();
    if (!workspaceRect) {
      return;
    }

    event.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onPointerMove(pointerEvent) {
      const nextWidth = clamp(
        workspaceRect.right - pointerEvent.clientX,
        320,
        Math.max(320, workspaceRect.width - 420)
      );

      setOperatorWidth(nextWidth);
      window.localStorage.setItem("caixa-preta.operatorWidth", `${Math.round(nextWidth)}`);
    }

    function onPointerUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  function resizeOperatorByKeyboard(event) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }

    const workspaceRect = workspaceRef.current?.getBoundingClientRect();
    if (!workspaceRect) {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? 1 : -1;
    const nextWidth = clamp(
      operatorWidth + (direction * 24),
      320,
      Math.max(320, workspaceRect.width - 420)
    );

    setOperatorWidth(nextWidth);
    window.localStorage.setItem("caixa-preta.operatorWidth", `${Math.round(nextWidth)}`);
  }

  function beginInstagramResize(event) {
    const chatPaneRect = chatPaneRef.current?.getBoundingClientRect();
    if (!chatPaneRect) {
      return;
    }

    const stacked = window.matchMedia("(max-width: 1100px)").matches;
    event.preventDefault();
    document.body.style.cursor = stacked ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";

    function onPointerMove(pointerEvent) {
      if (stacked) {
        const nextHeight = clamp(
          chatPaneRect.bottom - pointerEvent.clientY,
          280,
          Math.max(280, chatPaneRect.height - 220)
        );

        setInstagramHeight(nextHeight);
        window.localStorage.setItem("caixa-preta.instagramHeight", `${Math.round(nextHeight)}`);
        return;
      }

      const nextWidth = clamp(
        chatPaneRect.right - pointerEvent.clientX,
        280,
        Math.max(280, chatPaneRect.width - 280)
      );

      setInstagramWidth(nextWidth);
      window.localStorage.setItem("caixa-preta.instagramWidth", `${Math.round(nextWidth)}`);
    }

    function onPointerUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  function resizeInstagramByKeyboard(event) {
    const horizontalKeys = ["ArrowLeft", "ArrowRight"];
    const verticalKeys = ["ArrowUp", "ArrowDown"];
    const stacked = window.matchMedia("(max-width: 1100px)").matches;
    const acceptedKeys = stacked ? verticalKeys : horizontalKeys;

    if (!acceptedKeys.includes(event.key)) {
      return;
    }

    const chatPaneRect = chatPaneRef.current?.getBoundingClientRect();
    if (!chatPaneRect) {
      return;
    }

    event.preventDefault();

    if (stacked) {
      const direction = event.key === "ArrowUp" ? 1 : -1;
      const nextHeight = clamp(
        instagramHeight + (direction * 24),
        280,
        Math.max(280, chatPaneRect.height - 220)
      );

      setInstagramHeight(nextHeight);
      window.localStorage.setItem("caixa-preta.instagramHeight", `${Math.round(nextHeight)}`);
      return;
    }

    const direction = event.key === "ArrowLeft" ? 1 : -1;
    const nextWidth = clamp(
      instagramWidth + (direction * 24),
      280,
      Math.max(280, chatPaneRect.width - 280)
    );

    setInstagramWidth(nextWidth);
    window.localStorage.setItem("caixa-preta.instagramWidth", `${Math.round(nextWidth)}`);
  }

  const activeTypingAssistant = [...messages].reverse().find((message) => (
    message.role === "assistant" &&
    typedReplies[message.id] !== message.content &&
    !stoppedTypingIdsRef.current.has(message.id)
  ));
  const machineBusy = pending || performancePending || Boolean(activeTypingAssistant);
  const footer = (
    <form className={styles.form} onSubmit={submitMessage}>
      <span aria-hidden="true">&gt;</span>
      <input
        aria-label="Mensagem para a Caixa Preta"
        autoComplete="off"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={machineBusy}
      />
      <span className={styles.status}>{machineBusy ? "PROCESSING" : status}</span>
    </form>
  );
  const activeTypingStartedAt = activeTypingAssistant
    ? new Date(activeTypingAssistant.timestamp).getTime()
    : null;
  const visiblePerformanceEvents = activeTypingStartedAt
    ? performanceEvents.filter((event) => (
      event.source !== "agent" || new Date(event.createdAt).getTime() < activeTypingStartedAt
    ))
    : performanceEvents;
  const visibleInstagramPanel = instagram?.embedded && instagram.status && instagram.status !== "DISCONNECTED" && !instagramPanelClosed;
  const instagramPanelKey = [
    instagram?.browserMode || "instagram",
    instagram?.research?.person || "",
    instagram?.research?.step || "",
    instagram?.targetProfile || instagram?.account || "instagram",
    instagram?.status || "DISCONNECTED",
    instagram?.currentUrl || "",
    instagram?.lastButtonState || "",
    instagram?.message || ""
  ].join("|");
  const layoutStyle = {
    "--operator-width": `${operatorWidth}px`,
    "--instagram-width": `${instagramWidth}px`,
    "--instagram-height": `${instagramHeight}px`
  };

  return (
    <GlitchOverlay glitch={glitch}>
      <div
        className={`${styles.workspace} ${operatorOpen ? styles.workspaceWithOperator : ""}`}
        ref={workspaceRef}
        style={layoutStyle}
      >
      <button
        aria-label="Abrir manual de comandos"
        className={styles.manualButton}
        onClick={() => setManualOpen(true)}
        type="button"
      >
        ?
      </button>

      <button
        aria-label={operatorOpen ? "Esconder terminal operador" : "Abrir terminal operador ao lado"}
        aria-pressed={operatorOpen}
        className={styles.operatorButton}
        onClick={toggleOperator}
        type="button"
      >
        OP
      </button>

      {manualOpen ? (
        <div
          aria-labelledby="manual-title"
          aria-modal="true"
          className={styles.manualOverlay}
          role="dialog"
        >
          <section className={styles.manual}>
            <header className={styles.manualHeader}>
              <h2 id="manual-title">MANUAL</h2>
              <button
                aria-label="Fechar manual"
                className={styles.manualClose}
                onClick={() => setManualOpen(false)}
                type="button"
              >
                X
              </button>
            </header>

            <div className={styles.manualBody}>
              <h3>CHAT PUBLICO</h3>
              <dl>
                <div>
                  <dt>/reset</dt>
                  <dd>Limpa a conversa e reinicia a tela inicial.</dd>
                </div>
              </dl>

              <h3>OPERATOR</h3>
              <p>Acesse <strong>/operator</strong> em outra aba ou use o botao <strong>OP</strong> ao lado deste guia.</p>
              <dl>
                <div>
                  <dt>/say texto</dt>
                  <dd>Faz a Caixa Preta responder a partir de uma instrucao do operador.</dd>
                </div>
                <div>
                  <dt>/memory texto</dt>
                  <dd>Guarda uma observacao silenciosa da apresentacao.</dd>
                </div>
                <div>
                  <dt>/game [tipo|stop|replace|secret]</dt>
                  <dd>Controla jogos sem empilhar; use secret para Maria quando a Caixa adivinha.</dd>
                </div>
                <div>
                  <dt>/model modelo</dt>
                  <dd>Alterna entre gpt-5-mini e gpt-5-nano.</dd>
                </div>
                <div>
                  <dt>/phone approve|hide</dt>
                  <dd>Confirma ou corta imediatamente uma solicitacao de projecao de celular.</dd>
                </div>
                <div>
                  <dt>/instagram follow cappavictor</dt>
                  <dd>Mostra o Instagram real embutido no chat e aciona o follow permitido.</dd>
                </div>
                <div>
                  <dt>/mala</dt>
                  <dd>Entra no modo MALAS e gera uma transicao publica. /malas tambem funciona.</dd>
                </div>
                <div>
                  <dt>/reset</dt>
                  <dd>Apaga conversa, memorias e variaveis da sessao.</dd>
                </div>
              </dl>

              <h3>USO BASICO</h3>
              <p>Digite no campo inferior e pressione Enter. Respostas novas aparecem como texto digitado.</p>
            </div>
          </section>
        </div>
      ) : null}

      <section
        className={`${styles.chatPane} ${visibleInstagramPanel ? styles.chatPaneWithInstagram : ""} ${game?.id === "verdade_ou_bolo" && game.active ? styles.chatPaneWithGame : ""}`}
        aria-label="Chat publico"
        ref={chatPaneRef}
      >
        <DisplayBlackout blackout={displayBlackout} target="chatbot" />
        <SceneZeroProjectionLayer sceneZero={sceneZero} />
        <PerformanceLayer
          activities={performanceActivities}
          events={visiblePerformanceEvents}
          game={game}
          suitcase={suitcase}
          onMachineBusyChange={setPerformancePending}
          phoneProjection={phoneProjection}
        />

        <Terminal title="CAIXA PRETA" footer={footer} className={styles.embeddedTerminal}>
          <div className={styles.messages}>
            {messages.length === 0 && introStep === "cursor" ? (
              <p className={styles.introCursor}>&gt; <span>_</span></p>
            ) : null}

            {messages.length === 0 && introStep === "dots" ? (
              <p className={styles.introDots}>
                &gt; {introDotsText}
                {introDotsText !== INTRO_DOTS_TEXT ? (
                  <span className={styles.replyCursor} aria-hidden="true">_</span>
                ) : null}
              </p>
            ) : null}

            {messages.length === 0 && introStep === "ready" ? (
              <p className={styles.machine}>
                &gt; {introText}
                {introText !== INTRO_READY_TEXT ? (
                  <span className={styles.replyCursor} aria-hidden="true">_</span>
                ) : null}
              </p>
            ) : null}

            {messages.map((message) => {
              const typingStarted = Object.hasOwn(typedReplies, message.id);
              if (message.role === "assistant" && !typingStarted) {
                return null;
              }

              return (
                <p
                  className={message.role === "assistant" ? styles.machine : styles.public}
                  key={message.id}
                >
                  <span>{message.role === "assistant" ? ">" : "PUBLICO >"}</span>{" "}
                  {message.role === "assistant" ? typedReplies[message.id] ?? "" : message.content}
                  {message.role === "assistant" && typedReplies[message.id] !== message.content ? (
                    <span className={styles.replyCursor} aria-hidden="true">_</span>
                  ) : null}
                </p>
              );
            })}

            {pending ? <p className={styles.machine}>&gt; _</p> : null}
            {error ? <p className={styles.error}>&gt; {error}</p> : null}
            <div ref={scrollRef} />
          </div>
        </Terminal>
        {visibleInstagramPanel ? (
          <>
            <div
              aria-label="Redimensionar chat e Instagram"
              aria-orientation="vertical"
              className={styles.instagramResizeHandle}
              onKeyDown={resizeInstagramByKeyboard}
              onPointerDown={beginInstagramResize}
              role="separator"
              tabIndex={0}
            />
            <InstagramBrowserPanel
              key={instagramPanelKey}
              instagram={instagram}
              onClose={() => setInstagramPanelClosed(true)}
            />
          </>
        ) : null}
      </section>

      {operatorMounted && operatorOpen ? (
        <div
          aria-label="Redimensionar chat e operator"
          aria-orientation="vertical"
          className={styles.operatorResizeHandle}
          onKeyDown={resizeOperatorByKeyboard}
          onPointerDown={beginOperatorResize}
          role="separator"
          tabIndex={0}
        />
      ) : null}

      {operatorMounted ? (
        <aside
          aria-hidden={!operatorOpen}
          className={`${styles.operatorDrawer} ${operatorOpen ? styles.operatorDrawerOpen : ""}`}
          inert={!operatorOpen}
          onTransitionEnd={(event) => {
            if (event.currentTarget === event.target && !operatorOpen) {
              setOperatorMounted(false);
            }
          }}
        >
          <OperatorConsole embedded terminalClassName={styles.embeddedTerminal} />
        </aside>
      ) : null}
      </div>
    </GlitchOverlay>
  );
}
