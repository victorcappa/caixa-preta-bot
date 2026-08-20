"use client";

import { useEffect, useRef, useState } from "react";
import { robotSoundEngine } from "@/lib/robot-sound/RobotSoundEngine";
import {
  normalizeRobotSoundSettings,
  ROBOT_SOUND_DEFAULTS,
  ROBOT_SOUND_PRESET_NAMES
} from "@/lib/robot-sound/state";
import styles from "./RobotSoundControls.module.css";

const TYPE_TEST_TEXT = "DADO REGISTRADO.";

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
  const [audioStatus, setAudioStatus] = useState("LOCKED");
  const saveTimerRef = useRef(null);
  const saveQueueRef = useRef(Promise.resolve());
  const testTimersRef = useRef(new Set());
  const outputResetSequenceRef = useRef(null);

  useEffect(() => {
    const normalized = normalizeRobotSoundSettings(settings);
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
    const next = normalizeRobotSoundSettings({ ...draft, ...patch }, draft);
    setDraft(next);
    robotSoundEngine.setSettings(next);
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .catch(() => {})
        .then(() => postSettings(next))
        .catch((error) => onLog(error.message, "error"));
    }, delayMs);
  }

  async function toggleSound() {
    if (!draft.enabled && !(await unlock())) return;
    commit({ enabled: !draft.enabled });
  }

  async function reconnectAudio() {
    setAudioStatus("RECONNECTING");
    window.clearTimeout(saveTimerRef.current);
    outputResetSequenceRef.current = Number(draft.outputResetSequence || 0) + 1;
    const localReconnect = robotSoundEngine.reconnectOutput();
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() => postSettings({ ...draft, reconnectOutput: true }))
      .catch((error) => {
        onLog(error.message, "error");
        return null;
      });
    await Promise.all([localReconnect, saveQueueRef.current]);
  }

  async function testEffect(effect) {
    if (!draft.enabled) {
      onLog("ROBOT SOUND IS OFF", "error");
      return;
    }
    if (!(await unlock())) {
      onLog("AUDIO BLOCKED: interact with this window", "error");
      return;
    }

    robotSoundEngine.setSettings(draft);
    if (effect === "typing") {
      for (const [index, character] of [...TYPE_TEST_TEXT].entries()) {
        const timer = window.setTimeout(() => {
          testTimersRef.current.delete(timer);
          robotSoundEngine.typing(character, { force: true });
        }, index * 42);
        testTimersRef.current.add(timer);
      }
      return;
    }
    if (effect === "thinking") {
      robotSoundEngine.startThinking();
      const timer = window.setTimeout(() => {
        testTimersRef.current.delete(timer);
        robotSoundEngine.stopThinking();
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
      robotSoundEngine.setGlitch({ active: true, sequence: Date.now(), params: { intensity: 0.72 }, audio: { ghostTyping: false } });
      const timer = window.setTimeout(() => {
        testTimersRef.current.delete(timer);
        robotSoundEngine.setGlitch({ active: false, sequence: Date.now() });
      }, 420);
      testTimersRef.current.add(timer);
      return;
    }

    robotSoundEngine[effect]?.();
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

      <label className={styles.selectField}>
        <span>PRESET DIGITAÇÃO</span>
        <select onChange={(event) => commit({ preset: event.target.value })} value={draft.preset}>
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
