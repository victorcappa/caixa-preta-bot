"use client";

import { useEffect, useRef, useState } from "react";
import { robotSoundEngine } from "@/lib/robot-sound/RobotSoundEngine";
import {
  normalizeRobotSoundSettings,
  ROBOT_SOUND_DEFAULTS,
  ROBOT_SOUND_PRESET_NAMES,
  ROBOT_SOUND_STYLES,
  ROBOT_SOUND_STYLE_NAMES,
  robotTypingIntervalMs
} from "@/lib/robot-sound/state";
import styles from "./RobotSoundControls.module.css";

const TYPE_TEST_TEXT = "DADO REGISTRADO.";

function semitonesForPitchScale(scale) {
  return Math.round(12 * Math.log2(Number(scale) || 1));
}

function pitchScaleForSemitones(semitones) {
  return 2 ** (Number(semitones) / 12);
}

async function postSettings(settings) {
  const response = await fetch("/api/robot-sound", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "ROBOT SOUND ERROR");
  return data.robotSound;
}

export default function RobotSoundControls({ settings = ROBOT_SOUND_DEFAULTS, onLog = () => {}, relaySink = false }) {
  const [draft, setDraft] = useState(() => normalizeRobotSoundSettings(settings));
  const draftRef = useRef(normalizeRobotSoundSettings(settings));
  const [audioStatus, setAudioStatus] = useState("LOCKED");
  const saveTimerRef = useRef(null);
  const saveQueueRef = useRef(Promise.resolve());
  const pendingPatchRef = useRef({});
  const testTimersRef = useRef(new Set());
  const outputResetSequenceRef = useRef(null);
  const localRevisionRef = useRef(0);
  const settledRevisionRef = useRef(0);

  useEffect(() => {
    if (localRevisionRef.current !== settledRevisionRef.current) return;
    const normalized = normalizeRobotSoundSettings(settings);
    draftRef.current = normalized;
    setDraft(normalized);
    robotSoundEngine.setSettings(normalized);

    if (outputResetSequenceRef.current !== null && normalized.outputResetSequence !== outputResetSequenceRef.current) {
      void robotSoundEngine.reconnectOutput();
    }
    outputResetSequenceRef.current = normalized.outputResetSequence;
  }, [settings]);

  useEffect(() => robotSoundEngine.armAutoUnlock(), []);

  useEffect(() => robotSoundEngine.armAudioRelay({ sink: relaySink }), [relaySink]);

  useEffect(() => robotSoundEngine.subscribeStatus(setAudioStatus), []);

  useEffect(() => () => {
    window.clearTimeout(saveTimerRef.current);
    for (const timer of testTimersRef.current) window.clearTimeout(timer);
    testTimersRef.current.clear();
  }, []);

  async function unlock() {
    const unlocked = await robotSoundEngine.unlock();
    setAudioStatus(unlocked ? "READY" : robotSoundEngine.supported ? "BLOCKED" : "UNSUPPORTED");
    return unlocked;
  }

  function commit(patch, delayMs = 0) {
    const current = draftRef.current;
    const next = normalizeRobotSoundSettings({ ...current, ...patch }, current);
    const localRevision = localRevisionRef.current + 1;
    localRevisionRef.current = localRevision;
    draftRef.current = next;
    setDraft(next);
    robotSoundEngine.setSettings(next);
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const pendingPatch = pendingPatchRef.current;
      pendingPatchRef.current = {};
      saveQueueRef.current = saveQueueRef.current
        .catch(() => {})
        .then(() => postSettings(pendingPatch))
        .then((saved) => {
          settledRevisionRef.current = Math.max(settledRevisionRef.current, localRevision);
          if (localRevisionRef.current === localRevision) {
            const normalized = normalizeRobotSoundSettings(saved);
            draftRef.current = normalized;
            setDraft(normalized);
            robotSoundEngine.setSettings(normalized);
          }
          return saved;
        })
        .catch((error) => {
          settledRevisionRef.current = Math.max(settledRevisionRef.current, localRevision);
          onLog(error.message, "error");
        });
    }, delayMs);
  }

  async function toggleSound() {
    const current = draftRef.current;
    if (!current.enabled && !(await unlock())) return;
    commit({ enabled: !current.enabled });
  }

  async function reconnectAudio() {
    setAudioStatus("RECONNECTING");
    window.clearTimeout(saveTimerRef.current);
    const current = draftRef.current;
    outputResetSequenceRef.current = Number(current.outputResetSequence || 0) + 1;
    const localReconnect = robotSoundEngine.reconnectOutput();
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() => postSettings({ ...current, reconnectOutput: true }))
      .catch((error) => {
        onLog(error.message, "error");
        return null;
      });
    await Promise.all([localReconnect, saveQueueRef.current]);
  }

  async function testEffect(effect) {
    const current = draftRef.current;
    if (!current.enabled) {
      onLog("ROBOT SOUND IS OFF", "error");
      return;
    }
    if (!(await unlock())) {
      onLog("AUDIO BLOCKED: interact with this window", "error");
      return;
    }

    robotSoundEngine.setSettings(current);
    if (effect === "typing") {
      for (const [index, character] of [...TYPE_TEST_TEXT].entries()) {
        const timer = window.setTimeout(() => {
          testTimersRef.current.delete(timer);
          robotSoundEngine.typing(character, { force: true, localOnly: true });
        }, index * robotTypingIntervalMs(current));
        testTimersRef.current.add(timer);
      }
      return;
    }
    if (effect === "thinking") {
      robotSoundEngine.startThinking({ localOnly: true });
      const timer = window.setTimeout(() => {
        testTimersRef.current.delete(timer);
        robotSoundEngine.stopThinking({ localOnly: true });
      }, 2200);
      testTimersRef.current.add(timer);
      return;
    }
    if (effect === "countdown") {
      [3, 2, 1, 0].forEach((value, index) => {
        const timer = window.setTimeout(() => {
          testTimersRef.current.delete(timer);
          robotSoundEngine.countdown(value, { localOnly: true });
        }, index * 650);
        testTimersRef.current.add(timer);
      });
      return;
    }
    if (effect === "glitch") {
      robotSoundEngine.glitchEffect({ intensity: 0.72, localOnly: true });
      return;
    }

    robotSoundEngine[effect]?.({ localOnly: true });
  }

  return (
    <section className={styles.panel} aria-label="Robot Sound Engine">
      <header className={styles.header}>
        <strong>ROBOT SOUND ENGINE</strong>
        <span>{audioStatus}</span>
      </header>

      <button
        aria-pressed={draft.enabled}
        className={draft.enabled ? styles.enabledButton : styles.disabledButton}
        onClick={toggleSound}
        type="button"
      >
        {draft.enabled ? "SOUND ON" : "SOUND OFF"}
      </button>
      <button className={styles.reconnectButton} onClick={reconnectAudio} type="button">
        RECONECTAR ÁUDIO
      </button>

      <label className={styles.field}>
        <span>SENSIBILIDADE DO MICROFONE</span>
        <output>{Math.round(draft.microphoneSensitivity * 100)}%</output>
        <input
          aria-label="Sensibilidade do microfone"
          max="3"
          min="0.25"
          onChange={(event) => commit({ microphoneSensitivity: Number(event.target.value) }, 120)}
          step="0.05"
          type="range"
          value={draft.microphoneSensitivity}
        />
      </label>

      <label className={styles.selectField}>
        <span>ESTILO GERAL</span>
        <select
          aria-label="Estilo geral dos efeitos do robô"
          onChange={(event) => commit({ soundStyle: event.target.value })}
          value={draft.soundStyle}
        >
          {ROBOT_SOUND_STYLE_NAMES.map((soundStyle) => (
            <option key={soundStyle} value={soundStyle}>{ROBOT_SOUND_STYLES[soundStyle]}</option>
          ))}
        </select>
        <small>
          {draft.soundStyle === "system95"
            ? "BLIPS DIGITAIS E ALERTAS DE SISTEMA EM TODOS OS EFEITOS PROCEDURAIS."
            : "TIMBRE PROCEDURAL ORIGINAL DA CAIXA PRETA."}
        </small>
      </label>

      <label className={styles.field}>
        <span>VOLUME GERAL</span>
        <output>{Math.round(draft.masterVolume * 100)}%</output>
        <input
          aria-label="Volume geral dos efeitos do robô"
          max="1"
          min="0"
          onChange={(event) => commit({ masterVolume: Number(event.target.value) }, 120)}
          step="0.01"
          type="range"
          value={draft.masterVolume}
        />
      </label>

      <label className={styles.field}>
        <span>VOLUME DIGITAÇÃO</span>
        <output>{Math.round(draft.typingVolume * 100)}%</output>
        <input
          aria-label="Volume da digitação do robô"
          max="1"
          min="0"
          onChange={(event) => commit({ typingVolume: Number(event.target.value) }, 120)}
          step="0.01"
          type="range"
          value={draft.typingVolume}
        />
      </label>

      <label className={styles.field}>
        <span>ALTURA DO SOM / PITCH</span>
        <output>
          {semitonesForPitchScale(draft.pitchScale) > 0 ? "+" : ""}
          {semitonesForPitchScale(draft.pitchScale)} semitons
        </output>
        <input
          aria-label="Altura dos efeitos do robô"
          max="12"
          min="-12"
          onChange={(event) => commit({ pitchScale: pitchScaleForSemitones(event.target.value) }, 120)}
          step="1"
          type="range"
          value={semitonesForPitchScale(draft.pitchScale)}
        />
      </label>

      <label className={styles.field}>
        <span>VELOCIDADE DA DIGITAÇÃO</span>
        <output>{Math.round(1000 / draft.typingIntervalMs)} caracteres/s</output>
        <input
          aria-label="Velocidade da digitação do robô"
          max="60"
          min="5"
          onChange={(event) => commit({ typingIntervalMs: 1000 / Number(event.target.value) }, 120)}
          step="1"
          type="range"
          value={Math.round(1000 / draft.typingIntervalMs)}
        />
      </label>

      <label className={styles.field}>
        <span>FREQUÊNCIA DOS CLIQUES</span>
        <output>{Math.round(draft.typingFrequency * 100)}%</output>
        <input
          aria-label="Frequência do som de digitação do robô"
          max="1"
          min="0"
          onChange={(event) => commit({ typingFrequency: Number(event.target.value) }, 120)}
          step="0.05"
          type="range"
          value={draft.typingFrequency}
        />
      </label>

      <label className={styles.selectField}>
        <span>PRESET DIGITAÇÃO</span>
        <select
          aria-label="Preset da digitação do robô"
          onChange={(event) => commit({ preset: event.target.value })}
          value={draft.preset}
        >
          {ROBOT_SOUND_PRESET_NAMES.map((preset) => (
            <option key={preset} value={preset}>{preset.toUpperCase()}</option>
          ))}
        </select>
      </label>

      <label className={styles.checkboxField}>
        <input
          checked={draft.completeEnabled}
          onChange={(event) => commit({ completeEnabled: event.target.checked })}
          type="checkbox"
        />
        SOM COMPLETE
      </label>

      <div className={styles.tests}>
        {[
          ["typing", "DIGITAÇÃO"],
          ["wake", "WAKE"],
          ["thinking", "THINKING"],
          ["countdown", "CONTAGEM 3–2–1"],
          ["success", "SUCCESS / OBEY"],
          ["error", "ERROR"],
          ["glitch", "GLITCH"],
          ["impact", "IMPACT"]
        ].map(([effect, label]) => (
          <button key={effect} onClick={() => testEffect(effect)} type="button">TEST {label}</button>
        ))}
      </div>
      <small className={styles.note}>Se trocar fone/saída, use RECONECTAR ÁUDIO. O comando também reinicia a saída da projeção via SSE.</small>
    </section>
  );
}
