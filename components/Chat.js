"use client";

import { useEffect, useRef, useState } from "react";
import Terminal from "./Terminal";
import styles from "./Chat.module.css";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("CONNECTING");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetch("/api/state")
      .then((response) => response.json())
      .then((data) => setMessages(data.conversation || []))
      .catch(() => setStatus("DISCONNECTED"));

    const events = new EventSource("/api/events");
    events.onopen = () => setStatus("CONNECTED");
    events.onerror = () => setStatus("DISCONNECTED");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setMessages(payload.state.conversation || []);
    };

    return () => events.close();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  async function submitMessage(event) {
    event.preventDefault();

    const content = input.trim();
    if (!content || pending) {
      return;
    }

    setInput("");
    setPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content })
      });

      if (!response.ok) {
        throw new Error("Falha ao conversar com a Caixa Preta.");
      }
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
        {messages.length === 0 ? (
          <p className={styles.machine}>&gt; TEM ALGUEM AI?</p>
        ) : null}

        {messages.map((message) => (
          <p
            className={message.role === "assistant" ? styles.machine : styles.public}
            key={message.id}
          >
            <span>{message.role === "assistant" ? ">" : "PUBLICO >"}</span>{" "}
            {message.content}
          </p>
        ))}

        {pending ? <p className={styles.machine}>&gt; _</p> : null}
        <div ref={scrollRef} />
      </div>
    </Terminal>
  );
}
