"use client";

import { useEffect, useRef, useState } from "react";
import { robotTypingDelayMs } from "@/lib/robot-sound/state";
import styles from "./PublicOperator.module.css";

export default function OperatorTypedReply({ message, settings, animate, onProgress, onComplete, onCharacter, paused = false }) {
  const [text, setText] = useState(() => animate ? "" : message.content);
  const [stopped, setStopped] = useState(false);
  const progress = useRef({ text, lastAt: null });
  const completed = useRef(null);
  const characterCallback = useRef(onCharacter);
  characterCallback.current = onCharacter;
  useEffect(() => { if (!paused) setStopped(false); }, [paused]);

  useEffect(() => {
    const stop = () => setStopped(true);
    window.addEventListener("caixa-preta:stopall", stop);
    return () => window.removeEventListener("caixa-preta:stopall", stop);
  }, []);

  useEffect(() => {
    if (!animate) {
      progress.current.text = message.content;
      setText(message.content);
      return;
    }
    if (paused || stopped || message.status === "cancelled") return;
    const current = progress.current;
    // A failed return can replace the partial stream with its safe fallback.
    if (!message.content.startsWith(current.text)) {
      current.text = "";
      current.lastAt = null;
      setText("");
    }
    let timer;
    const schedule = () => {
      if (current.text.length >= message.content.length) return;
      if (current.lastAt === null) current.lastAt = performance.now();
      const delay = robotTypingDelayMs(settings, [...current.text].at(-1) || "");
      const remaining = Math.max(0, current.lastAt + delay - performance.now());
      timer = window.setTimeout(() => {
        const codePoint = message.content.codePointAt(current.text.length);
        const nextLength = current.text.length + (codePoint > 0xffff ? 2 : 1);
        current.text = message.content.slice(0, nextLength);
        current.lastAt = performance.now();
        setText(current.text);
        characterCallback.current?.(String.fromCodePoint(codePoint), { messageId: message.id, index: nextLength });
        schedule();
      }, remaining);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [message.id, message.content, message.status, settings, animate, stopped, paused]);

  useEffect(() => { onProgress?.(); }, [text, onProgress]);
  useEffect(() => {
    if (onComplete && !paused && !stopped && message.status === "complete" && text.length >= message.content.length && completed.current !== message.id) {
      completed.current = message.id; onComplete(message.id);
    }
  }, [onComplete, paused, stopped, message.status, message.id, message.content, text]);
  const typing = !paused && !stopped && message.status !== "cancelled"
    && (message.status === "streaming" || text.length < message.content.length);
  return <p data-typing={typing ? "true" : "false"}>{text}{typing ? <span className={styles.cursor} aria-hidden="true">_</span> : null}</p>;
}
