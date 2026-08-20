"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import GlitchOverlay from "@/components/GlitchOverlay";
import { GLITCH_PRESETS, presetParams } from "@/lib/glitch/state";
import styles from "./GlitchController.module.css";

const PARAM_CONTROLS = [
  ["intensity", "INTENSIDADE", 0, 1, 0.01],
  ["rgbSplit", "RGB SPLIT", 0, 1, 0.01],
  ["horizontalShift", "HORIZONTAL", 0, 1, 0.01],
  ["verticalShift", "VERTICAL", 0, 1, 0.01],
  ["horizontalTearing", "TEARING", 0, 1, 0.01],
  ["blockCount", "BLOCK COUNT", 0, 32, 1],
  ["blockSize", "BLOCK SIZE", 0, 1, 0.01],
  ["frequency", "GLITCH FREQUENCY", 0, 1, 0.01],
  ["speed", "SPEED", 0.05, 2, 0.01],
  ["flicker", "FLICKER", 0, 1, 0.01],
  ["scanlines", "SCANLINES", 0, 1, 0.01],
  ["noise", "NOISE", 0, 1, 0.01],
  ["distortion", "DISTORTION", 0, 1, 0.01],
  ["chromaticAberration", "CHROMATIC ABERRATION", 0, 1, 0.01],
  ["jitter", "JITTER", 0, 1, 0.01],
  ["flashChance", "FLASH CHANCE", 0, 1, 0.01],
  ["averageDurationMs", "DURACAO MEDIA", 80, 12000, 20],
  ["intervalMs", "INTERVALO", 40, 6000, 20],
  ["frozenFrames", "FRAMES CONGELADOS", 0, 12, 1],
  ["desync", "PERDA DE SINCRONIA", 0, 1, 0.01]
];

async function postGlitch(action, payload = {}) {
  const response = await fetch("/api/glitch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload })
  });
  const data = await response.json();
  return { response, data };
}

export default function GlitchController() {
  const [preset, setPreset] = useState("normal");
  const [params, setParams] = useState(() => presetParams("normal"));
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState("painel-aeroporto.mp4");
  const [loop, setLoop] = useState(false);
  const [connection, setConnection] = useState("CONNECTING");
  const [log, setLog] = useState("SYSTEM READY");
  const [sequence, setSequence] = useState(1);
  const [previewEnabled, setPreviewEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/glitch")
      .then((response) => response.json())
      .then((data) => {
        setVideos(data.videos || []);
        setPreset(data.glitch?.preset || "normal");
        setParams(data.glitch?.params || presetParams("normal"));
        setSelectedVideo(data.glitch?.video?.file || data.videos?.[0]?.file || "painel-aeroporto.mp4");
        setConnection("READY");
      })
      .catch(() => setConnection("DISCONNECTED"));

    const events = new EventSource("/api/events?client=glitch-controller");
    events.onopen = () => setConnection("CONNECTED");
    events.onerror = () => setConnection("DISCONNECTED");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const glitch = payload.state?.glitch;

      if (!glitch) {
        return;
      }

      setPreset(glitch.preset || "normal");
      setParams(glitch.params || presetParams("normal"));
      if (glitch.video?.file) {
        setSelectedVideo(glitch.video.file);
      }
    };

    return () => events.close();
  }, []);

  useEffect(() => {
    if (!previewEnabled) {
      return undefined;
    }

    const timer = window.setTimeout(() => setPreviewEnabled(false), 5000);
    return () => window.clearTimeout(timer);
  }, [previewEnabled, sequence]);

  const previewGlitch = useMemo(() => ({
    active: previewEnabled,
    mode: "continuous",
    sequence,
    params,
    video: { active: false }
  }), [params, previewEnabled, sequence]);

  function updateParam(key, value) {
    const nextValue = Number(value);
    setParams((current) => ({ ...current, [key]: nextValue }));
    setSequence((current) => current + 1);
  }

  async function pushUpdate(nextParams = params, nextPreset = preset) {
    const { response, data } = await postGlitch("update", {
      preset: nextPreset,
      params: nextParams
    });

    setLog(response.ok ? data.message || "GLITCH UPDATED" : data.error || "GLITCH ERROR");
  }

  async function applyPreset(nextPreset) {
    const nextParams = presetParams(nextPreset);
    setPreset(nextPreset);
    setParams(nextParams);
    setSequence((current) => current + 1);
    await pushUpdate(nextParams, nextPreset);
  }

  async function run(action, payload = {}) {
    const { response, data } = await postGlitch(action, {
      preset,
      params,
      file: selectedVideo,
      loop,
      ...payload
    });

    setLog(response.ok ? data.message || "GLITCH SENT" : data.error || "GLITCH ERROR");
  }

  return (
    <main className={styles.screen}>
      <section className={styles.preview}>
        <GlitchOverlay glitch={previewGlitch} preview={previewEnabled}>
          <div className={styles.fakeBot}>
            <span>CAIXA PRETA</span>
            <p>TEM ALGUEM AI?</p>
            <small>{previewEnabled ? `PREVIA ATIVA / ${preset.toUpperCase()} / PARA EM 5s` : "PREVIA PAUSADA"}</small>
          </div>
        </GlitchOverlay>
      </section>

      <aside className={styles.panel}>
        <header className={styles.header}>
          <div>
            <span>CONTROLLER PRIVADO</span>
            <h1>GLITCH</h1>
          </div>
          <div className={styles.headerActions}>
            <strong className={connection === "CONNECTED" ? styles.connected : styles.disconnected}>{connection}</strong>
            <Link className={styles.exitLink} href="/cena-0-controller">SAIR DO GLITCH</Link>
          </div>
        </header>

        <div className={styles.actions}>
          <button type="button" onClick={() => {
            setSequence((current) => current + 1);
            setPreviewEnabled(true);
          }}>PREVIA 5s</button>
          <button type="button" onClick={() => setPreviewEnabled(false)}>PARAR PREVIA</button>
          <button type="button" onClick={() => run("trigger")}>GLITCH</button>
          <button type="button" onClick={() => run("trigger", { preset: "strong", params: presetParams("strong") })}>GLITCH FORTE</button>
          <button type="button" onClick={() => run("continuous")}>START CONTINUO</button>
          <button type="button" onClick={() => run("stop")}>STOP</button>
          <button className={styles.primaryButton} type="button" onClick={() => run("video")}>GLITCH + VIDEO</button>
          <button className={styles.dangerButton} type="button" onClick={() => run("video-stop")}>VOLTAR AO BOT</button>
        </div>

        <label className={styles.field}>
          <span>PRESET</span>
          <select value={preset} onChange={(event) => applyPreset(event.target.value)}>
            {Object.keys(GLITCH_PRESETS).map((key) => (
              <option key={key} value={key}>{key.toUpperCase()}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>VIDEO FINAL</span>
          <select value={selectedVideo} onChange={(event) => setSelectedVideo(event.target.value)}>
            {videos.map((video) => (
              <option key={video.file} value={video.file}>{video.file}</option>
            ))}
          </select>
        </label>

        <label className={styles.checkboxField}>
          <input checked={loop} onChange={(event) => setLoop(event.target.checked)} type="checkbox" />
          LOOP VIDEO
        </label>

        <div className={styles.sliders}>
          {PARAM_CONTROLS.map(([key, label, min, max, step]) => (
            <label className={styles.sliderField} key={key}>
              <span>{label}</span>
              <output>{Number(params[key] ?? 0).toFixed(step >= 1 ? 0 : 2)}</output>
              <input
                max={max}
                min={min}
                onChange={(event) => updateParam(key, event.target.value)}
                onMouseUp={() => pushUpdate()}
                onTouchEnd={() => pushUpdate()}
                step={step}
                type="range"
                value={params[key] ?? 0}
              />
            </label>
          ))}
        </div>

        <p className={styles.log}>{log}</p>
      </aside>
    </main>
  );
}
