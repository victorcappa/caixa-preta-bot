"use client";

import { useEffect, useState } from "react";
import { AUDIENCE_WARMUP_ACTIONS, AUDIENCE_WARMUP_INTENSITIES, AUDIENCE_WARMUP_PROMPTS } from "@/data/audience-warmup-prompts";
import { PLAY_UNLOCK_CONFIG } from "@/data/scene-zero-unlock";
import styles from "./AudienceWarmupController.module.css";

export default function AudienceWarmupController({ state, unlock, disabled = false, onLog = () => {}, showBootButton = true }) {
  const warmup = state || {};
  const playUnlock = unlock || {};
  const [manual, setManual] = useState("");
  const [manualProgress, setManualProgress] = useState(0);
  const [progressDraft, setProgressDraft] = useState(0);
  const [requestPending, setRequestPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false);

  useEffect(() => setHydrated(true), []);
  useEffect(() => setProgressDraft(Math.max(0, Math.min(100, Number(playUnlock.progress) || 0))), [playUnlock.progress]);

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
  const progress = Math.max(0, Math.min(100, Number(playUnlock.progress) || 0));
  const remaining = Math.max(0, 100 - progress);
  const standby = playUnlock.status === "STANDBY";
  const booting = playUnlock.status === "BOOTING";
  const warming = ["WAITING_FOR_AUDIENCE", "WARMING_AUDIENCE"].includes(playUnlock.status);
  const warmupDisabled = busy || !warming || Boolean(playUnlock.pendingProgress);
  const currentProgressValue = Math.max(0, Number(sequence?.progressValue) || 0);
  const actionEvaluated = Boolean(sequence?.progressId && playUnlock.scoredActionIds?.includes(sequence.progressId) && !sequence.repeatableProgress);

  function sendManual() {
    const text = manual.trim();
    if (!text || busy) return;
    void act("send", { text, progressValue: manualProgress }).then((result) => result && setManual(""));
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

      <section className={styles.unlockPanel} aria-label="Desbloqueio da peça">
        <div className={styles.unlockHeading}>
          <div>
            <small>DEPENDÊNCIA CENTRAL</small>
            <h3>DESBLOQUEIO DA PEÇA</h3>
          </div>
          <strong>{progress}%</strong>
        </div>
        <div
          aria-label={`Progresso do desbloqueio: ${progress}%`}
          aria-valuemax="100"
          aria-valuemin="0"
          aria-valuenow={progress}
          className={styles.unlockTrack}
          role="progressbar"
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <dl className={styles.unlockReadouts}>
          <div><dt>ESTADO</dt><dd>{playUnlock.status || "—"}</dd></div>
          <div><dt>TRAVA DA BIOS</dt><dd>{playUnlock.bootLimit ?? PLAY_UNLOCK_CONFIG.bootLimit}%</dd></div>
          <div><dt>FALTA</dt><dd>{remaining}%</dd></div>
          <div><dt>ÚLTIMA AVALIAÇÃO</dt><dd>{playUnlock.lastProgressAction || "—"}</dd></div>
          <div><dt>ÚLTIMA AÇÃO QUE AUMENTOU</dt><dd>{playUnlock.lastIncreaseAction || "—"}</dd></div>
        </dl>
        {standby && showBootButton ? (
          <button className={styles.bootButton} disabled={busy} onClick={() => act("unlock-boot")} type="button">BOOT</button>
        ) : null}
        {booting ? (
          <div className={styles.bootControls}>
            <button disabled={busy} onClick={() => act(playUnlock.bootPaused ? "unlock-resume-boot" : "unlock-pause-boot")} type="button">
              {playUnlock.bootPaused ? "RETOMAR BIOS" : "PAUSAR BIOS"}
            </button>
            <button disabled={busy} onClick={() => act("unlock-advance-boot")} type="button">AVANÇAR BIOS</button>
          </div>
        ) : null}
        {warming ? (
          <>
            <p className={styles.unlockRule}>PROTOCOLO DE VERIFICAÇÃO HUMANA. CADA AÇÃO PONTUA UMA VEZ, EXCETO QUANDO MARCADA COMO REPETÍVEL.</p>
            <div className={styles.unlockControls}>
              <button disabled={busy || !sequence || !currentProgressValue || actionEvaluated || playUnlock.pendingProgress} onClick={() => act("unlock-increment", { amount: currentProgressValue, label: sequence?.steps?.[0]?.text || sequence?.label })} type="button">CONFIRMAR AÇÃO +{currentProgressValue}%</button>
              <button disabled={busy || !sequence || actionEvaluated || playUnlock.pendingProgress} onClick={() => act("unlock-decrement", { amount: PLAY_UNLOCK_CONFIG.manualProgressStep, label: current?.text || sequence?.label })} type="button">AÇÃO DIMINUIU −{PLAY_UNLOCK_CONFIG.manualProgressStep}%</button>
            </div>
          </>
        ) : null}
        <div className={styles.progressSetter}>
          <label>
            DEFINIR PROGRESSO
            <input max="100" min="0" onChange={(event) => setProgressDraft(event.target.value)} type="number" value={progressDraft} />
          </label>
          <button disabled={!warming || busy || playUnlock.pendingProgress} onClick={() => act("unlock-set-progress", { progress: progressDraft })} type="button">APLICAR PROGRESSO</button>
          <button disabled={!warming || busy || playUnlock.pendingProgress} onClick={() => act("unlock-increase-participation", { amount: PLAY_UNLOCK_CONFIG.manualProgressStep })} type="button">+ PARTICIPAÇÃO</button>
          <button disabled={!warming || busy || playUnlock.pendingProgress} onClick={() => act("unlock-decrease-participation", { amount: PLAY_UNLOCK_CONFIG.manualProgressStep })} type="button">− PARTICIPAÇÃO</button>
          <button className={styles.completeBar} disabled={!warming || busy} onClick={() => act("unlock-complete")} type="button">COMPLETAR BARRA</button>
          <button className={styles.forceUnlock} disabled={standby || busy} onClick={() => act("unlock-unlock-now")} type="button">DESBLOQUEAR AGORA</button>
          <label className={styles.soundToggle}>
            <input
              checked={playUnlock.soundEnabled !== false}
              disabled={busy}
              onChange={(event) => act("unlock-toggle-sound", { enabled: event.target.checked })}
              type="checkbox"
            />
            ÁUDIO BIOS / UNLOCK
          </label>
          <button className={styles.resetUnlock} disabled={busy} onClick={() => act("unlock-reset")} type="button">REINICIAR DESBLOQUEIO</button>
        </div>
      </section>

      <section className={styles.promptLibraryDisclosure} aria-label="Ações configuradas da verificação humana">
        <button aria-expanded={promptLibraryOpen} onClick={() => setPromptLibraryOpen((currentValue) => !currentValue)} type="button">
          <span><strong>AÇÕES CONFIGURADAS</strong><small>{AUDIENCE_WARMUP_PROMPTS.length} FALAS DISPONÍVEIS</small></span>
          <b>{promptLibraryOpen ? "COMPRIMIR" : "EXPANDIR"}</b>
        </button>
        {promptLibraryOpen ? <div className={styles.promptLibrary}>
          <header>
            <small>LISTA EDITÁVEL · data/audience-warmup-prompts.js</small>
            <h3>AÇÕES CONFIGURADAS</h3>
          </header>
          <div className={styles.promptList}>
          {AUDIENCE_WARMUP_PROMPTS.map((prompt) => {
            const scored = playUnlock.scoredActionIds?.includes(prompt.id) && !prompt.repeatableProgress;
            return (
              <article className={styles.promptItem} key={prompt.id}>
                <div>
                  <small>{prompt.category} · {prompt.id}</small>
                  <p>{prompt.text}</p>
                  <strong>{prompt.progressValue > 0 ? `+${prompt.progressValue}%` : "0% · SEM PROGRESSO"} · {prompt.repeatableProgress ? "REPETÍVEL" : scored ? "JÁ PONTUOU" : "AINDA NÃO PONTUOU"}</strong>
                </div>
                <div>
                  <button disabled={warmupDisabled} onClick={() => act("trigger-prompt", { promptId: prompt.id, withProgress: true })} type="button">DISPARAR{prompt.progressValue > 0 ? ` +${prompt.progressValue}%` : ""}</button>
                  <button disabled={warmupDisabled} onClick={() => act("trigger-prompt", { promptId: prompt.id, withProgress: false })} type="button">DISPARAR SEM PROGRESSO</button>
                </div>
              </article>
            );
          })}
          </div>
        </div> : null}
      </section>

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
        <button disabled={warmupDisabled} onClick={() => { setManual(""); act("generate"); }} type="button">GERAR PERGUNTA</button>
        <button className={styles.surprise} disabled={warmupDisabled} onClick={() => { setManual(""); act("surprise"); }} type="button">SURPREENDA-ME</button>
      </div>

      <label className={styles.manualField}>
        FRASE MANUAL
        <textarea
          maxLength={500}
          disabled={warmupDisabled}
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
      <label className={styles.manualProgress}>
        PROGRESSO DA FRASE MANUAL
        <input max="100" min="0" onChange={(event) => setManualProgress(Number(event.target.value))} type="number" value={manualProgress} />
      </label>

      <div className={styles.preview} aria-label="Preview do esquentar público" aria-live="polite">
        <small>{manual.trim() ? "FRASE MANUAL — ENTER ENVIA" : "ÚLTIMA FRASE GERADA E ENVIADA"}</small>
        <p>{manual.trim() || warmup.preview || "Escolha uma ação e gere uma pergunta."}</p>
        <strong>
          A BARRA CONTINUA DA BIOS · FEEDBACK TÉCNICO ANTES DE CADA AUMENTO
        </strong>
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
        <button disabled={warmupDisabled || !sequence || !next} onClick={() => act("next")} type="button">PRÓXIMO</button>
        <button disabled={warmupDisabled || !current} onClick={() => act("repeat")} type="button">REPETIR</button>
        <button className={styles.cancel} disabled={busy || !warmup.active} onClick={() => act("cancel")} type="button">CANCELAR</button>
        <button className={styles.clear} disabled={busy} onClick={() => act("clear")} type="button">LIMPAR TELA</button>
      </div>
    </section>
  );
}
