"use client";

import { useCallback, useEffect, useRef } from "react";
import { PERSONALITY_PARAMETERS, createOperatorPublicState } from "@/lib/operatorPublic";
import styles from "./PublicOperator.module.css";
import OperatorTypedReply from "./OperatorTypedReply";

export default function PublicOperatorPanel({ channel = createOperatorPublicState(), privateControls = null, connection = "connecting", publicSurface = false, parametersOnly = false, typingSettings, initialMessageIds }) {
  const history = useRef(null);
  const follow = useRef(true);
  const followHistory = useCallback(() => {
    if (follow.current && history.current) history.current.scrollTop = history.current.scrollHeight;
  }, []);
  useEffect(followHistory, [channel.messages, followHistory]);
  const parameters = (
    <section className={styles.personality} aria-label="Parâmetros de personalidade">
      <h3>{parametersOnly ? "PERSONALIDADE DO BOT" : "PERSONALITY PARAMETERS"}</h3>
      {PERSONALITY_PARAMETERS.map(({ id, label }) => (
        <div className={styles.parameter} key={id}>
          <label htmlFor={`${privateControls && !publicSurface ? "private" : "public"}-${id}`}>{label}<output>{channel.personality[id]}%</output></label>
          <div className={styles.sliderRow}>
            {privateControls ? <button type="button" aria-label={`Diminuir ${label}`} onClick={() => privateControls.personality(id, channel.personality[id] - 5)}>−</button> : null}
            <input id={`${privateControls && !publicSurface ? "private" : "public"}-${id}`} type="range" min="0" max="100" step="1"
              style={{ "--parameter-percent": `${channel.personality[id]}%` }}
              value={channel.personality[id]} aria-label={label} disabled={!privateControls}
              onChange={privateControls ? (event) => privateControls.personality(id, Number(event.target.value)) : undefined} />
            {privateControls ? <button type="button" aria-label={`Aumentar ${label}`} onClick={() => privateControls.personality(id, channel.personality[id] + 5)}>+</button> : null}
          </div>
        </div>
      ))}
    </section>
  );
  if (parametersOnly) return parameters;
  return (
    <section className={styles.panel} aria-label={privateControls && !publicSurface ? "Conversa e personalidade do Operator" : "Operator público"}>
      <header className={styles.header}>
        <strong>OPERATOR <span>{"// LIVE"}</span></strong>
        <small><i data-connected={connection === "connected"} /> SYSTEM {connection === "connected" ? "CONNECTED" : "RECONNECTING"}</small>
      </header>
      <div className={styles.activity} aria-live="polite">
        {channel.status === "generating" ? "MODEL ACTIVE · GERANDO" : "MODEL READY · CONVERSA PARALELA"}
      </div>
      <div className={styles.history} ref={history} role="log" aria-label="Histórico da conversa" aria-live="off"
        onScroll={() => { const el = history.current; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
        {channel.messages.map((message) => (
          <article key={message.id} data-role={message.role} data-message-id={message.id}>
            <small>{message.role === "user" ? "OPERADOR" : "BOT"}</small>
            {message.role === "assistant"
              ? <OperatorTypedReply message={message} settings={typingSettings} animate={!initialMessageIds?.has(message.id)} onProgress={followHistory} />
              : <p>{message.content}</p>}
            {message.status === "cancelled" ? <small>INTERROMPIDO</small> : null}
          </article>
        ))}
      </div>
      {parameters}
      {privateControls ? privateControls.input : (
        <div className={styles.draft} aria-label="Texto sendo digitado pelo operador"><small>OPERADOR &gt;</small><p>{channel.draft || "_"}</p></div>
      )}
    </section>
  );
}
