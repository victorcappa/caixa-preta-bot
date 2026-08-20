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

const PEDALS = [
  ["driveEnabled", "DRIVE"],
  ["phaserEnabled", "PHASER"],
  ["wahEnabled", "WAH-WAH"],
  ["echoEnabled", "ECHO"],
  ["pitchEnabled", "PITCH"]
];

export default function SceneAudioEffectsControls({ cueId = "", cueLabel = "", settings, onChange, onPersist }) {
  const [draft, setDraft] = useState(() => normalizeSceneAudioEffects(settings));
  const [status, setStatus] = useState("READY");
  const timersRef = useRef(new Map());

  useEffect(() => {
    setDraft(normalizeSceneAudioEffects(settings));
    setStatus(cueId ? "READY" : "SELECT SAMPLE");
  }, [cueId, settings]);

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) window.clearTimeout(timer);
    timersRef.current.clear();
  }, []);

  function persist(targetCueId, next, delayMs = 120) {
    if (!targetCueId || !onPersist) return;
    window.clearTimeout(timersRef.current.get(targetCueId));
    timersRef.current.set(targetCueId, window.setTimeout(async () => {
      timersRef.current.delete(targetCueId);
      setStatus("SAVING");
      try {
        await onPersist(targetCueId, next);
        setStatus("SAVED");
      } catch {
        setStatus("ERROR");
      }
    }, delayMs));
  }

  function commit(patch, delayMs = 120) {
    if (!cueId) return;
    const next = normalizeSceneAudioEffects({ ...draft, ...patch, preset: "custom" }, draft);
    setDraft(next);
    onChange?.(cueId, next);
    persist(cueId, next, delayMs);
  }

  function applyPreset(name) {
    if (!cueId) return;
    const next = sceneAudioEffectPreset(name, draft);
    setDraft(next);
    onChange?.(cueId, next);
    persist(cueId, next, 0);
  }

  const disabled = !cueId;

  return (
    <section className={styles.panel} aria-label="Pedais do sample selecionado">
      <header className={styles.header}>
        <div>
          <span>CADEIA DO SAMPLE SELECIONADO</span>
          <strong>{cueLabel || "SELECIONE UM SAMPLE"}</strong>
        </div>
        <output className={draft.enabled ? styles.live : styles.bypass}>
          {disabled ? "SEM SAMPLE" : (draft.enabled ? status : "BYPASS")}
        </output>
      </header>

      <div className={styles.presets} aria-label="Presets de efeitos">
        {Object.keys(SCENE_AUDIO_EFFECT_PRESETS).map((name) => (
          <button
            aria-pressed={draft.preset === name}
            className={draft.preset === name ? styles.activePreset : ""}
            disabled={disabled}
            key={name}
            onClick={() => applyPreset(name)}
            type="button"
          >
            {PRESET_LABELS[name]}
          </button>
        ))}
      </div>

      <div className={styles.pedals} aria-label="Pedais individuais">
        {PEDALS.map(([key, label]) => (
          <button
            aria-pressed={Boolean(draft[key])}
            className={draft[key] ? styles.pedalOn : styles.pedalOff}
            disabled={disabled}
            key={key}
            onClick={() => commit({ enabled: true, [key]: !draft[key] }, 0)}
            type="button"
          >
            <span>{label}</span>
            <small>{draft[key] ? "ON" : "OFF"}</small>
          </button>
        ))}
      </div>

      <button
        aria-pressed={draft.enabled}
        className={draft.enabled ? styles.effectOn : styles.effectOff}
        disabled={disabled}
        onClick={() => commit({ enabled: !draft.enabled }, 0)}
        type="button"
      >
        {draft.enabled ? "PEDALEIRA LIGADA" : "EFEITOS EM BYPASS"}
      </button>

      <div className={styles.handles}>
        <EffectRange disabled={disabled} label="DISTORÇÃO" max="1" min="0" onChange={(drive) => commit({ drive })} step="0.01" value={draft.drive} valueLabel={`${Math.round(draft.drive * 100)}%`} />
        <EffectRange disabled={disabled} label="CORTE DE GRAVES" max="4000" min="20" onChange={(lowCut) => commit({ lowCut })} step="10" value={draft.lowCut} valueLabel={`${Math.round(draft.lowCut)} HZ`} />
        <EffectRange disabled={disabled} label="CORTE DE AGUDOS" max="20000" min="300" onChange={(highCut) => commit({ highCut })} step="50" value={draft.highCut} valueLabel={`${Math.round(draft.highCut)} HZ`} />
        <EffectRange disabled={disabled} label="PHASER INTENSIDADE" max="1" min="0" onChange={(phaser) => commit({ enabled: true, phaserEnabled: true, phaser })} step="0.01" value={draft.phaser} valueLabel={`${Math.round(draft.phaser * 100)}%`} />
        <EffectRange disabled={disabled} label="PHASER VELOCIDADE" max="8" min="0.05" onChange={(phaserRate) => commit({ enabled: true, phaserEnabled: true, phaserRate })} step="0.05" value={draft.phaserRate} valueLabel={`${draft.phaserRate.toFixed(2)} HZ`} />
        <EffectRange disabled={disabled} label="WAH INTENSIDADE" max="1" min="0" onChange={(wah) => commit({ enabled: true, wahEnabled: true, wah })} step="0.01" value={draft.wah} valueLabel={`${Math.round(draft.wah * 100)}%`} />
        <EffectRange disabled={disabled} label="WAH VELOCIDADE" max="8" min="0.05" onChange={(wahRate) => commit({ enabled: true, wahEnabled: true, wahRate })} step="0.05" value={draft.wahRate} valueLabel={`${draft.wahRate.toFixed(2)} HZ`} />
        <EffectRange disabled={disabled} label="ECO" max="0.75" min="0" onChange={(echo) => commit({ enabled: true, echoEnabled: true, echo })} step="0.01" value={draft.echo} valueLabel={`${Math.round(draft.echo * 100)}%`} />
        <EffectRange disabled={disabled} label="PITCH" max="12" min="-12" onChange={(pitch) => commit({ enabled: true, pitchEnabled: true, pitch })} step="1" value={draft.pitch} valueLabel={`${draft.pitch > 0 ? "+" : ""}${Math.round(draft.pitch)} ST`} />
        <EffectRange disabled={disabled} label="MIX" max="1" min="0" onChange={(mix) => commit({ mix })} step="0.01" value={draft.mix} valueLabel={`${Math.round(draft.mix * 100)}%`} />
        <EffectRange disabled={disabled} label="SAÍDA" max="1.25" min="0" onChange={(output) => commit({ output })} step="0.01" value={draft.output} valueLabel={`${Math.round(draft.output * 100)}%`} />
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
