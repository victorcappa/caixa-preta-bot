"use client";

import { useEffect, useState } from "react";
import { AUDIENCE_WARMUP_ACTIONS, AUDIENCE_WARMUP_INTENSITIES } from "@/data/audience-warmup-prompts";
import styles from "./AudienceWarmupController.module.css";

export default function AudienceWarmupController({ state, disabled = false, onLog = () => {} }) {
  const warmup = state || {};
  const [manual, setManual] = useState("");
  const [requestPending, setRequestPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  async function act(action, payload = {}) {
    setRequestPending(true);
    try {
      const response = await fetch("/api/audience-warmup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "WARMUP ERROR");
      onLog(data.message || `WARMUP ${action.toUpperCase()}`, "ok");
      return data;
    } catch (error) {
      onLog(error.message || "WARMUP ERROR", "error");
      return null;
    } finally {
      setRequestPending(false);
    }
  }

  const busy = disabled || requestPending || !hydrated;
  const sequence = warmup.sequence;
  const current = sequence?.steps?.[warmup.currentStep] || null;
  const next = sequence?.steps?.[warmup.currentStep + 1] || null;

  function sendManual() {
    const text = manual.trim();
    if (!text || busy) return;
    void act("send", { text }).then((result) => result && setManual(""));
  }

  return (
    <section aria-busy={!hydrated || requestPending} className={styles.panel} aria-labelledby="audience-warmup-title">
      <header className={styles.header}>
        <div>
          <small>PARTITURAS DE PLATEIA</small>
          <h2 id="audience-warmup-title">ESQUENTAR PÚBLICO</h2>
        </div>
        <span className={warmup.active ? styles.live : styles.ready}>{warmup.active ? "EM CURSO" : "PRONTO"}</span>
      </header>

      <fieldset className={styles.fieldset}>
        <legend>TIPO DE AÇÃO</legend>
        <div className={styles.actionGrid}>
          {AUDIENCE_WARMUP_ACTIONS.map((action) => (
            <button
              aria-pressed={warmup.selectedAction === action.id}
              className={warmup.selectedAction === action.id ? styles.selected : ""}
              disabled={busy}
              key={action.id}
              onClick={() => act("select-action", { selectedAction: action.id })}
              type="button"
            >
              <span aria-hidden="true">{action.icon}</span> {action.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>INTENSIDADE</legend>
        <div className={styles.intensityGrid}>
          {AUDIENCE_WARMUP_INTENSITIES.map((intensity) => (
            <button
              aria-pressed={warmup.intensity === intensity.id}
              className={warmup.intensity === intensity.id ? styles.selected : ""}
              disabled={busy}
              key={intensity.id}
              onClick={() => act("set-intensity", { intensity: intensity.id })}
              type="button"
            >{intensity.label}</button>
          ))}
        </div>
      </fieldset>

      <div className={styles.generateRow}>
        <button disabled={busy} onClick={() => { setManual(""); act("generate"); }} type="button">GERAR PERGUNTA</button>
        <button className={styles.surprise} disabled={busy} onClick={() => { setManual(""); act("surprise"); }} type="button">SURPREENDA-ME</button>
      </div>

      <label className={styles.manualField}>
        FRASE MANUAL
        <textarea
          maxLength={500}
          onChange={(event) => setManual(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            sendManual();
          }}
          placeholder="Quem nasceu em São Paulo levanta a mão."
          value={manual}
        />
        <small>ENTER ENVIA · SHIFT+ENTER QUEBRA A LINHA</small>
      </label>

      <div className={styles.preview} aria-label="Preview do esquentar público" aria-live="polite">
        <small>{manual.trim() ? "FRASE MANUAL — ENTER ENVIA" : "ÚLTIMA FRASE GERADA E ENVIADA"}</small>
        <p>{manual.trim() || warmup.preview || "Escolha uma ação e gere uma pergunta."}</p>
      </div>

      <div className={styles.timing}>
        <label>
          <input
            checked={Boolean(warmup.automatic)}
            disabled={busy}
            onChange={(event) => act("set-automatic", { automatic: event.target.checked })}
            type="checkbox"
          />
          AVANÇO AUTOMÁTICO
        </label>
        <label>
          INTERVALO
          <input
            aria-label="Intervalo automático em segundos"
            disabled={busy}
            max="15"
            min="0.8"
            onChange={(event) => act("set-interval", { intervalMs: Number(event.target.value) * 1000 })}
            step="0.1"
            type="number"
            value={(Number(warmup.intervalMs || 2500) / 1000).toFixed(1)}
          /> s
        </label>
      </div>

      <div className={styles.sequenceStatus} aria-live="polite">
        <strong>{sequence ? sequence.label.toUpperCase() : "SEM SEQUÊNCIA"}</strong>
        <p>ATUAL: {current?.text || "—"}</p>
        <p>PRÓXIMO: {next?.text || "—"}</p>
        <p>{warmup.awaitingOperator ? "AGUARDANDO OPERADOR" : warmup.active ? "AUTOMÁTICO EM CURSO" : "PARADO"}</p>
      </div>

      <div className={styles.transport}>
        <button disabled={busy || !sequence || !next} onClick={() => act("next")} type="button">PRÓXIMO</button>
        <button disabled={busy || !current} onClick={() => act("repeat")} type="button">REPETIR</button>
        <button className={styles.cancel} disabled={busy || !warmup.active} onClick={() => act("cancel")} type="button">CANCELAR</button>
        <button className={styles.clear} disabled={busy} onClick={() => act("clear")} type="button">LIMPAR TELA</button>
      </div>
    </section>
  );
}
