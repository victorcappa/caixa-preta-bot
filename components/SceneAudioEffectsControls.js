"use client";

import { useEffect, useRef, useState } from "react";
import {
  normalizeSceneAudioEffects,
  SCENE_AUDIO_EFFECT_PRESETS,
  sceneAudioEffectPreset
} from "@/lib/sceneAudioEffects";
import styles from "./SceneAudioEffectsControls.module.css";

const PRESET_LABELS = {
  clean: "LIMPO",
  radio: "RÁDIO",
  saturado: "SATURADO",
  destruido: "DESTRUÍDO",
  submerso: "SUBMERSO"
};

async function postEffects(controllerId, settings) {
  const response = await fetch("/api/controller-cues/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ controllerId, action: "audio-effects", settings })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "AUDIO EFFECTS ERROR");
  return data.settings;
}

export default function SceneAudioEffectsControls({ controllerId, settings, onChange }) {
  const [draft, setDraft] = useState(() => normalizeSceneAudioEffects(settings));
  const [status, setStatus] = useState("READY");
  const timerRef = useRef(null);
  const queueRef = useRef(Promise.resolve());

  useEffect(() => setDraft(normalizeSceneAudioEffects(settings)), [settings]);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function persist(next, delayMs = 70) {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setStatus("UPDATING");
      queueRef.current = queueRef.current
        .catch(() => {})
        .then(() => postEffects(controllerId, next))
        .then(() => setStatus("LIVE"))
        .catch(() => setStatus("ERROR"));
    }, delayMs);
  }

  function commit(patch, delayMs = 70) {
    const next = normalizeSceneAudioEffects({ ...draft, ...patch }, draft);
    setDraft(next);
    onChange(next);
    persist(next, delayMs);
  }

  function applyPreset(name) {
    const next = sceneAudioEffectPreset(name, draft);
    setDraft(next);
    onChange(next);
    persist(next, 0);
  }

  return (
    <section className={styles.panel} aria-label="Distorção do som da Cena 1">
      <header className={styles.header}>
        <div>
          <span>PROCESSAMENTO AO VIVO</span>
          <strong>DISTORÇÃO DO SOM</strong>
        </div>
        <output className={draft.enabled ? styles.live : styles.bypass}>
          {draft.enabled ? status : "BYPASS"}
        </output>
      </header>

      <div className={styles.presets} aria-label="Presets de distorção">
        {Object.keys(SCENE_AUDIO_EFFECT_PRESETS).map((name) => (
          <button
            aria-pressed={draft.preset === name}
            className={draft.preset === name ? styles.activePreset : ""}
            key={name}
            onClick={() => applyPreset(name)}
            type="button"
          >
            {PRESET_LABELS[name]}
          </button>
        ))}
      </div>

      <button
        aria-pressed={draft.enabled}
        className={draft.enabled ? styles.effectOn : styles.effectOff}
        onClick={() => commit({ enabled: !draft.enabled }, 0)}
        type="button"
      >
        {draft.enabled ? "EFEITO LIGADO" : "EFEITO EM BYPASS"}
      </button>

      <div className={styles.handles}>
        <EffectRange label="DISTORÇÃO" max="1" min="0" onChange={(drive) => commit({ drive, preset: "custom" })} step="0.01" value={draft.drive} valueLabel={`${Math.round(draft.drive * 100)}%`} />
        <EffectRange label="CORTE DE GRAVES" max="4000" min="20" onChange={(lowCut) => commit({ lowCut, preset: "custom" })} step="10" value={draft.lowCut} valueLabel={`${Math.round(draft.lowCut)} HZ`} />
        <EffectRange label="CORTE DE AGUDOS" max="20000" min="300" onChange={(highCut) => commit({ highCut, preset: "custom" })} step="50" value={draft.highCut} valueLabel={`${Math.round(draft.highCut)} HZ`} />
        <EffectRange label="ECO" max="0.75" min="0" onChange={(echo) => commit({ echo, preset: "custom" })} step="0.01" value={draft.echo} valueLabel={`${Math.round(draft.echo * 100)}%`} />
        <EffectRange label="MIX" max="1" min="0" onChange={(mix) => commit({ mix, preset: "custom" })} step="0.01" value={draft.mix} valueLabel={`${Math.round(draft.mix * 100)}%`} />
        <EffectRange label="SAÍDA" max="1.25" min="0" onChange={(output) => commit({ output, preset: "custom" })} step="0.01" value={draft.output} valueLabel={`${Math.round(draft.output * 100)}%`} />
      </div>
    </section>
  );
}

function EffectRange({ label, valueLabel, ...inputProps }) {
  return (
    <label className={styles.handle}>
      <span>{label}</span>
      <output>{valueLabel}</output>
      <input
        aria-label={label}
        type="range"
        {...inputProps}
        onChange={(event) => inputProps.onChange(Number(event.target.value))}
      />
    </label>
  );
}
