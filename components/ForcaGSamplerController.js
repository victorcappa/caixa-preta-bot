"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ForcaGShaderControls from "./ForcaGShaderControls";
import styles from "./ForcaGSamplerController.module.css";

const EMPTY_STATE = { layers: { gLoc: null, video: null, images: [], text: null }, audioCues: [], masterVolume: 1, errors: {} };
const MASTER_VOLUME_KEY = "caixa-preta.forca-g-sampler.master-volume";

function isTypingTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return ["input", "textarea", "select", "button"].includes(tag) || target?.isContentEditable;
}

function shortcutMatches(event, shortcut = "") {
  const value = shortcut.trim().toLowerCase();
  if (!value || event.metaKey || event.ctrlKey || event.altKey) return false;
  if (value === "space") return event.key === " ";
  return event.key.toLowerCase() === value;
}

async function requestSampler(action, payload = {}) {
  const response = await fetch("/api/forca-g-sampler", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "SAMPLER ERROR");
  return data;
}

function Pad({ item, active, error, pending, onPlay, onStop }) {
  const classes = [styles.pad, active ? styles.activePad : "", error ? styles.errorPad : "", pending ? styles.loadingPad : ""].filter(Boolean).join(" ");
  return (
    <article className={classes} data-item-id={item.id}>
      <button
        aria-label={`Tocar ${item.label}`}
        className={styles.padTrigger}
        disabled={!item.available || pending}
        onClick={() => onPlay(item)}
        type="button"
      >
        <span className={styles.padTopline}>
          {item.shortcut ? <kbd>{item.shortcut.toUpperCase()}</kbd> : <span />}
          <small>{pending ? "CARREGANDO" : error ? "ERRO" : active ? item.loop ? "LOOP" : "TOCANDO" : "PARADO"}</small>
        </span>
        <strong>{item.label}</strong>
      </button>
      <button aria-label={`Parar ${item.label}`} className={styles.padStop} disabled={!active} onClick={() => onStop(item)} type="button">STOP</button>
      {!item.available ? <span className={styles.assetError}>ASSET AUSENTE</span> : null}
    </article>
  );
}

function Section({ title, accent = false, controls = null, children }) {
  return (
    <section className={`${styles.section} ${accent ? styles.accentSection : ""}`} aria-label={title}>
      <header><h2>{title}</h2>{controls}</header>
      {children}
    </section>
  );
}

export default function ForcaGSamplerController() {
  const [config, setConfig] = useState(null);
  const [sampler, setSampler] = useState(EMPTY_STATE);
  const [shaders, setShaders] = useState(null);
  const [status, setStatus] = useState("CONECTANDO");
  const [pendingId, setPendingId] = useState("");
  const [freeText, setFreeText] = useState("");
  const triggerRef = useRef(null);
  const presetRef = useRef(null);

  async function loadConfig() {
    setStatus("LENDO ASSETS...");
    try {
      const response = await fetch("/api/forca-g-sampler", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "CONFIG ERROR");
      setConfig(data.config);
      let nextState = data.state || EMPTY_STATE;
      const storedVolume = window.localStorage.getItem(MASTER_VOLUME_KEY);
      if (storedVolume !== null && Number.isFinite(Number(storedVolume))) {
        const updated = await requestSampler("update", { category: "master", patch: { masterVolume: storedVolume } });
        nextState = updated.state || nextState;
      }
      setSampler(nextState);
      setShaders(data.shaders || null);
      setStatus(data.config.warnings?.length ? `${data.config.warnings.length} ASSET(S) COM ERRO` : "READY");
    } catch (error) {
      setStatus(error.message || "DESCONECTADO");
    }
  }

  useEffect(() => {
    void loadConfig();
    const events = new EventSource("/api/events?client=forca-g-sampler-controller");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const next = payload.state?.forcaGSampler || payload.forcaGSampler;
      if (next) setSampler(next);
      const nextShaders = payload.state?.forcaGShaders || payload.forcaGShaders;
      if (nextShaders) setShaders(nextShaders);
    };
    return () => events.close();
  }, []);

  async function send(action, payload = {}, busyId = "") {
    if (busyId) setPendingId(busyId);
    try {
      const data = await requestSampler(action, payload);
      if (data.state) setSampler(data.state);
      setStatus("READY");
      return data;
    } catch (error) {
      setStatus(error.message || "SAMPLER ERROR");
      return null;
    } finally {
      if (busyId) setPendingId("");
    }
  }

  function play(item) {
    void send("play", { itemId: item.id }, item.id);
  }

  function stop(item) {
    void send("stop", { category: item.category, itemId: item.id });
  }

  function playPreset(preset) {
    void send("preset", { presetId: preset.id }, preset.id);
  }

  async function applyShader(shaderAction, payload = {}) {
    const data = await send("shader", { shaderAction, payload });
    if (data?.shaders) setShaders(data.shaders);
  }

  function updateMasterVolume(value) {
    window.localStorage.setItem(MASTER_VOLUME_KEY, `${value}`);
    void send("update", { category: "master", patch: { masterVolume: value } });
  }

  triggerRef.current = play;
  presetRef.current = playPreset;

  const allItems = useMemo(() => Object.values(config?.sections || {}).flat(), [config]);
  const shortcutConflicts = useMemo(() => {
    const counts = new Map();
    for (const item of [...allItems, ...(config?.presets || [])]) {
      const key = item.shortcut?.trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts].filter(([, count]) => count > 1).map(([key]) => key.toUpperCase());
  }, [allItems, config?.presets]);

  useEffect(() => {
    function onKeydown(event) {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      const item = allItems.find((candidate) => shortcutMatches(event, candidate.shortcut));
      const preset = (config?.presets || []).find((candidate) => shortcutMatches(event, candidate.shortcut));
      if (!item && !preset) return;
      event.preventDefault();
      if (item) triggerRef.current?.(item);
      else presetRef.current?.(preset);
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [allItems, config?.presets]);

  const activeIds = useMemo(() => new Set([
    sampler.layers?.gLoc?.id,
    sampler.layers?.video?.id,
    sampler.layers?.text?.id,
    ...(sampler.layers?.images || []).map((item) => item.id),
    ...(sampler.audioCues || []).map((item) => item.id)
  ].filter(Boolean)), [sampler]);

  function pads(section) {
    const items = config?.sections?.[section] || [];
    if (!items.length) return <p className={styles.empty}>Coloque arquivos na pasta correspondente ou adicione itens ao manifest.</p>;
    return (
      <div className={styles.padGrid}>
        {items.map((item) => (
          <Pad
            active={activeIds.has(item.id)}
            error={Boolean(sampler.errors?.[item.id])}
            item={item}
            key={item.id}
            onPlay={play}
            onStop={stop}
            pending={pendingId === item.id}
          />
        ))}
      </div>
    );
  }

  const gLoc = sampler.layers?.gLoc;
  const video = sampler.layers?.video;
  const masterVolume = Number(sampler.masterVolume ?? 1);

  return (
    <main className={styles.controller}>
      <header className={styles.hero}>
        <div><p>CENA 2A</p><h1>SAMPLER — FORÇA G</h1></div>
        <div className={styles.status}><span className={status === "READY" ? styles.readyDot : styles.statusDot} />{status}</div>
      </header>

      <Section
        accent
        controls={<div className={styles.inlineControls}>
          <button onClick={() => send("stop", { category: "gLoc" })} type="button">PARAR G-LOC</button>
          <button disabled={!gLoc} onClick={() => send("restart", { category: "gLoc" })} type="button">REINICIAR</button>
          <button disabled={!gLoc} onClick={() => send("update", { category: "gLoc", patch: { loop: !gLoc?.loop } })} type="button">LOOP {gLoc?.loop ? "ON" : "OFF"}</button>
        </div>}
        title="G-LOC"
      >{pads("gLoc")}</Section>

      <Section controls={<button className={styles.dangerSmall} onClick={() => send("stop-audio")} type="button">STOP ALL AUDIO</button>} title="SOM">
        {pads("audio")}
      </Section>

      <Section controls={<button onClick={() => send("clear-text")} type="button">LIMPAR TEXTO</button>} title="TEXTO">
        {pads("texts")}
        <form className={styles.freeText} onSubmit={(event) => { event.preventDefault(); if (freeText.trim()) void send("free-text", { text: freeText }, "free-text"); }}>
          <textarea aria-label="Texto livre" onChange={(event) => setFreeText(event.target.value)} placeholder="TEXTO LIVRE PARA A PROJEÇÃO" rows="2" value={freeText} />
          <button disabled={!freeText.trim() || pendingId === "free-text"} type="submit">DISPARAR TEXTO</button>
        </form>
      </Section>

      <Section controls={<button onClick={() => send("stop", { category: "images" })} type="button">LIMPAR IMAGEM</button>} title="IMAGEM">
        {pads("images")}
      </Section>

      <Section
        controls={<div className={styles.inlineControls}>
          <button onClick={() => send("stop", { category: "video" })} type="button">STOP</button>
          <button disabled={!video} onClick={() => send("restart", { category: "video" })} type="button">REINICIAR</button>
          <button disabled={!video} onClick={() => send("update", { category: "video", patch: { loop: !video?.loop } })} type="button">LOOP {video?.loop ? "ON" : "OFF"}</button>
          <button disabled={!video} onClick={() => send("update", { category: "video", patch: { muted: !video?.muted } })} type="button">{video?.muted ? "MUTED" : "SOM ON"}</button>
          <label className={styles.miniVolume}>VOL {Math.round(Number(video?.volume ?? 1) * 100)}%
            <input aria-label="Volume do vídeo atual" disabled={!video} max="1" min="0" onChange={(event) => send("update", { category: "video", patch: { volume: event.target.value } })} step="0.05" type="range" value={Number(video?.volume ?? 1)} />
          </label>
        </div>}
        title="VÍDEO"
      >{pads("video")}</Section>

      <Section title="PRESETS">
        {(config?.presets || []).length ? <div className={styles.presetGrid}>{config.presets.map((preset) => (
          <button className={styles.preset} disabled={pendingId === preset.id} key={preset.id} onClick={() => playPreset(preset)} type="button">
            {preset.shortcut ? <kbd>{preset.shortcut.toUpperCase()}</kbd> : null}<strong>{preset.label}</strong>
          </button>
        ))}</div> : <p className={styles.empty}>Defina combinações em manifest.json.</p>}
      </Section>

      <Section title="SHADERS / EFEITOS"><ForcaGShaderControls externalShaders={shaders} onApply={applyShader} /></Section>

      <Section title="MASTER">
        <div className={styles.master}>
          <button className={styles.emergency} onClick={() => send("stop-all")} type="button">STOP ALL</button>
          <button onClick={() => send("stop-audio")} type="button">STOP AUDIO</button>
          <button onClick={() => send("clear-visual")} type="button">CLEAR VISUAL</button>
          <button onClick={() => send("clear-text")} type="button">CLEAR TEXT</button>
          <button onClick={() => send("reset")} type="button">RESET SAMPLER</button>
          <label className={styles.volume}>VOLUME MASTER {Math.round(masterVolume * 100)}%
            <input aria-label="Volume master" max="1" min="0" onChange={(event) => updateMasterVolume(event.target.value)} step="0.01" type="range" value={masterVolume} />
          </label>
          <button onClick={loadConfig} type="button">RECARREGAR ASSETS</button>
        </div>
      </Section>

      {shortcutConflicts.length ? <p className={styles.warning}>ATALHOS DUPLICADOS: {shortcutConflicts.join(", ")}. O primeiro pad vence.</p> : null}
      {(config?.warnings || []).map((warning) => <p className={styles.warning} key={warning}>{warning}</p>)}
    </main>
  );
}
