"use client";

import { useEffect, useState } from "react";
import { AUDIENCE_WARMUP_ACTIONS, AUDIENCE_WARMUP_INTENSITIES, AUDIENCE_WARMUP_PROMPTS } from "@/data/audience-warmup-prompts";
import { PLAY_UNLOCK_CONFIG } from "@/data/scene-zero-unlock";
import { AUDIENCE_WARMUP_MINIGAMES } from "@/data/audience-warmup-minigames";
import styles from "./AudienceWarmupController.module.css";

export default function AudienceWarmupController({ state, unlock, disabled = false, onLog = () => {}, showBootButton = true }) {
  const warmup = state || {};
  const playUnlock = unlock || {};
  const [progressDraft, setProgressDraft] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [requestPending, setRequestPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false);

  useEffect(() => setHydrated(true), []);
  useEffect(() => setProgressDraft(Math.max(0, Math.min(100, Number(playUnlock.progress) || 0))), [playUnlock.progress]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

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
  const previewPrompt = AUDIENCE_WARMUP_PROMPTS.find((prompt) => prompt.id === warmup.previewPromptId) || null;
  const previewDuration = previewPrompt?.durationSeconds
    || previewPrompt?.steps?.find((promptStep) => promptStep.durationSeconds)?.durationSeconds
    || null;
  const actionSeconds = warmup.actionTimer?.endsAt
    ? Math.max(0, Math.ceil((Date.parse(warmup.actionTimer.endsAt) - now) / 1000))
    : 0;
  const progress = Math.max(0, Math.min(100, Number(playUnlock.progress) || 0));
  const remaining = Math.max(0, 100 - progress);
  const standby = playUnlock.status === "STANDBY";
  const booting = playUnlock.status === "BOOTING";
  const bootFailed = playUnlock.status === "BOOT_FAILED";
  const warming = ["WAITING_FOR_AUDIENCE", "WARMING_AUDIENCE"].includes(playUnlock.status);
  const questionsReady = warmup.phase === "questions";
  const warmupDisabled = busy || !warming || !questionsReady || Boolean(playUnlock.pendingProgress);
  const minigame = warmup.minigame || {};
  const minigameStarted = ["countdown", "running", "paused", "exchange", "ready_round_two"].includes(minigame.status);
  const minigameLocked = minigame.status === "completed" || questionsReady;
  const currentProgressValue = Math.max(0, Number(sequence?.progressValue) || 0);
  const actionEvaluated = Boolean(sequence?.progressId && playUnlock.scoredActionIds?.includes(sequence.progressId) && !sequence.repeatableProgress);

  async function chooseAction(action) {
    await act("select-action", { selectedAction: action });
  }

  async function chooseIntensity(intensity) {
    await act("set-intensity", { intensity });
  }

  return (
    <section aria-busy={!hydrated || requestPending} className={styles.panel} aria-labelledby="audience-warmup-title">
      <header className={styles.header}>
        <div>
          <small>PARTITURAS DE PLATEIA</small>
          <h2 id="audience-warmup-title">ESQUENTAR PÚBLICO</h2>
        </div>
        <span className={warmup.active ? styles.live : styles.ready}>{(warmup.phase || "idle").replaceAll("_", " ").toUpperCase()}</span>
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
        {bootFailed ? (
          <button className={styles.startWarmup} disabled={busy} onClick={() => act("unlock-start-warmup")} type="button">INICIAR AQUECIMENTO</button>
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
          <button className={styles.forceUnlock} disabled={!warming || busy} onClick={() => act("unlock-unlock-now")} type="button">DESBLOQUEAR AGORA</button>
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

      <section className={styles.minigamePanel} aria-label="Minigame em dupla">
        <header>
          <div><small>PRIMEIRO TESTE · UMA VEZ</small><h3>MINIGAME EM DUPLA</h3></div>
          <strong>{minigame.selectedId ? AUDIENCE_WARMUP_MINIGAMES.find((game) => game.id === minigame.selectedId)?.name : "—"}</strong>
        </header>
        <p className={styles.minigameStatus}>ESTADO: {(minigame.status || "idle").replaceAll("_", " ").toUpperCase()} · {minigame.selectionMode ? `SELEÇÃO ${minigame.selectionMode.toUpperCase()}` : "SEM SELEÇÃO"}</p>
        <div className={styles.gameSelection}>
          <button className={styles.drawGame} disabled={busy || !warming || minigame.status !== "ready_for_draw"} onClick={() => act("minigame-draw")} type="button">SORTEAR JOGO</button>
          {AUDIENCE_WARMUP_MINIGAMES.map((game) => (
            <button
              className={minigame.selectedId === game.id ? styles.selected : ""}
              disabled={busy || !warming || minigameStarted || minigameLocked || minigame.status === "briefing"}
              key={game.id}
              onClick={() => act("minigame-select", { gameId: game.id })}
              type="button"
            >{game.name}</button>
          ))}
        </div>
        <div className={styles.durationGrid}>
          {AUDIENCE_WARMUP_MINIGAMES.filter((game) => game.id !== "tapao").map((game) => (
            <label key={game.id}>
              {game.name} · SEGUNDOS
              <input
                disabled={busy || minigameLocked}
                max="300"
                min="5"
                onChange={(event) => act("minigame-set-duration", { gameId: game.id, seconds: Number(event.target.value) })}
                type="number"
                value={minigame.durations?.[game.id] ?? game.defaultDurationSeconds}
              />
            </label>
          ))}
        </div>
        <div className={styles.minigameTransport}>
          <button disabled={busy || !["ready", "ready_round_two"].includes(minigame.status)} onClick={() => act("minigame-start")} type="button">{minigame.status === "ready_round_two" ? "INICIAR SEGUNDO TURNO" : "INICIAR"}</button>
          <button disabled={busy || minigame.status !== "running"} onClick={() => act("minigame-pause")} type="button">PAUSAR</button>
          <button disabled={busy || minigame.status !== "paused"} onClick={() => act("minigame-resume")} type="button">CONTINUAR</button>
          <button disabled={busy || !minigame.selectedId || minigameLocked} onClick={() => act("minigame-restart")} type="button">REINICIAR</button>
          <button disabled={busy || !["running", "paused"].includes(minigame.status)} onClick={() => act("minigame-adjust-time", { deltaSeconds: 5 })} type="button">+5 SEGUNDOS</button>
          <button disabled={busy || !["running", "paused"].includes(minigame.status)} onClick={() => act("minigame-adjust-time", { deltaSeconds: -5 })} type="button">−5 SEGUNDOS</button>
          {minigame.selectedId === "tapao" ? <button disabled={busy || minigame.round === 2 || !["countdown", "running", "paused"].includes(minigame.status)} onClick={() => act("minigame-tapao-swap")} type="button">TROQUEM AGORA</button> : null}
          <button className={styles.endGame} disabled={busy || !minigame.selectedId || minigameLocked} onClick={() => act("minigame-end")} type="button">ENCERRAR</button>
          <button className={styles.skipGame} disabled={busy || !warming || minigameLocked} onClick={() => act("minigame-skip")} type="button">PULAR MINIGAME</button>
        </div>
      </section>

      {!questionsReady ? <p className={styles.questionsLocked}>PERGUNTAS BLOQUEADAS · CONCLUA OU PULE O MINIGAME</p> : null}

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
                  <small>{prompt.category} · {prompt.intensity} · {prompt.interactionType} · {prompt.id}</small>
                  <p>{prompt.steps?.length ? prompt.steps.map((step) => typeof step === "string" ? step : step.text).join(" → ") : prompt.text}</p>
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
              disabled={warmupDisabled}
              key={action.id}
              onClick={() => chooseAction(action.id)}
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
              disabled={warmupDisabled}
              key={intensity.id}
              onClick={() => chooseIntensity(intensity.id)}
              type="button"
            >{intensity.label}</button>
          ))}
        </div>
      </fieldset>

      <div className={styles.preview} aria-label="Preview do esquentar público" aria-live="polite">
        <small>PRÓXIMA AÇÃO SORTEADA · TEXTO LITERAL DA BIBLIOTECA</small>
        <p>{warmup.preview || "PRESSIONE SORTEAR."}</p>
        <dl className={styles.previewMeta}>
          <div><dt>CATEGORIA</dt><dd>{previewPrompt?.category || "—"}</dd></div>
          <div><dt>INTENSIDADE</dt><dd>{previewPrompt?.intensity || "—"}</dd></div>
          <div><dt>INTERAÇÃO</dt><dd>{previewPrompt?.interactionType || "—"}</dd></div>
          <div><dt>DURAÇÃO</dt><dd>{previewDuration ? `${previewDuration}s` : "LIVRE"}</dd></div>
        </dl>
        <ol className={styles.previewSteps}>
          {(previewPrompt?.steps || []).map((promptStep, index) => <li key={`${previewPrompt.id}-${index}`}>{promptStep.text}{promptStep.durationSeconds ? ` · ${promptStep.durationSeconds}s` : ""}</li>)}
        </ol>
      </div>

      <div className={styles.cueControls}>
        <button className={styles.surprise} disabled={warmupDisabled} onClick={() => act("surprise")} type="button">SORTEAR</button>
        <button disabled={warmupDisabled || !previewPrompt} onClick={() => act("trigger-preview", { withProgress: false })} type="button">DISPARAR</button>
        <button disabled={warmupDisabled || !previewPrompt} onClick={() => act("skip")} type="button">PULAR</button>
        <button disabled={warmupDisabled || !current} onClick={() => act("repeat")} type="button">REPETIR</button>
        <button disabled={warmupDisabled || !sequence || !next} onClick={() => act("next")} type="button">PRÓXIMO</button>
        <button disabled={warmupDisabled || !warmup.actionTimer?.endsAt} onClick={() => act("add-time", { seconds: 5 })} type="button">+5s</button>
        <button className={styles.cancel} disabled={busy || !warmup.active} onClick={() => act("end-action")} type="button">ENCERRAR AÇÃO</button>
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
        <p>TIMER: {warmup.actionTimer?.endsAt ? `${actionSeconds}s` : "—"}</p>
        <p>{warmup.awaitingOperator ? "AGUARDANDO OPERADOR" : warmup.active ? "AUTOMÁTICO EM CURSO" : "PARADO"}</p>
      </div>

      <div className={styles.transport}>
        <button className={styles.cancel} disabled={busy || !warmup.active} onClick={() => act("cancel")} type="button">CANCELAR</button>
        <button className={styles.clear} disabled={busy} onClick={() => act("clear")} type="button">LIMPAR TELA</button>
      </div>
    </section>
  );
}
