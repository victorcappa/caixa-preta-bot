"use client";

import { useEffect, useRef, useState } from "react";
import Terminal from "./Terminal";
import styles from "./Chat.module.css";

const INTRO_READY_TEXT = "TEM ALGUEM AI?";
const INTRO_DOTS_TEXT = "...";
const TYPE_INTERVAL_MS = 42;

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [typedReplies, setTypedReplies] = useState({});
  const [introText, setIntroText] = useState("");
  const [introDotsText, setIntroDotsText] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("CONNECTING");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [introStep, setIntroStep] = useState("cursor");
  const scrollRef = useRef(null);
  const initializedMessagesRef = useRef(false);
  const seenMessageIdsRef = useRef(new Set());
  const typingTimersRef = useRef(new Map());
  const introTimerRef = useRef(null);
  const introDotsTimerRef = useRef(null);

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
        if (!initializedMessagesRef.current) {
          hydrateInitialMessages(data.conversation || []);
          return;
        }

        setMessages(data.conversation || []);
      })
      .catch(() => setStatus("DISCONNECTED"));

    const events = new EventSource("/api/events");
    events.onopen = () => setStatus("CONNECTED");
    events.onerror = () => setStatus("DISCONNECTED");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      if (!initializedMessagesRef.current && payload.event?.type === "snapshot") {
        hydrateInitialMessages(payload.state.conversation || []);
        return;
      }

      setMessages(payload.state.conversation || []);
    };

    return () => events.close();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, introStep, introDotsText, introText, typedReplies]);

  useEffect(() => {
    if (initializedMessagesRef.current && messages.length === 0) {
      for (const timer of typingTimersRef.current.values()) {
        clearInterval(timer);
      }

      typingTimersRef.current.clear();
      seenMessageIdsRef.current.clear();
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

      if (message.role !== "assistant") {
        continue;
      }

      setTypedReplies((current) => ({ ...current, [message.id]: "" }));

      let index = 0;
      const timer = setInterval(() => {
        index += 1;
        setTypedReplies((current) => ({
          ...current,
          [message.id]: message.content.slice(0, index)
        }));

        if (index >= message.content.length) {
          clearInterval(timer);
          typingTimersRef.current.delete(message.id);
        }
      }, TYPE_INTERVAL_MS);

      typingTimersRef.current.set(message.id, timer);
    }

    return undefined;
  }, [messages]);

  useEffect(() => {
    const typingTimers = typingTimersRef.current;

    return () => {
      for (const timer of typingTimers.values()) {
        clearInterval(timer);
      }

      clearInterval(introTimerRef.current);
      clearInterval(introDotsTimerRef.current);
    };
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

    let index = 0;
    introTimerRef.current = setInterval(() => {
      index += 1;
      setIntroText(INTRO_READY_TEXT.slice(0, index));

      if (index >= INTRO_READY_TEXT.length) {
        clearInterval(introTimerRef.current);
        introTimerRef.current = null;
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
    if (!content || pending) {
      return;
    }

    setInput("");
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao conversar com a Caixa Preta.");
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  const footer = (
    <form className={styles.form} onSubmit={submitMessage}>
      <span aria-hidden="true">&gt;</span>
      <input
        aria-label="Mensagem para a Caixa Preta"
        autoComplete="off"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={pending}
      />
      <span className={styles.status}>{pending ? "PROCESSING" : status}</span>
    </form>
  );

  return (
    <Terminal title="CAIXA PRETA" footer={footer}>
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

        {messages.map((message) => (
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
        ))}

        {pending ? <p className={styles.machine}>&gt; _</p> : null}
        {error ? <p className={styles.error}>&gt; {error}</p> : null}
        <div ref={scrollRef} />
      </div>
    </Terminal>
  );
}
