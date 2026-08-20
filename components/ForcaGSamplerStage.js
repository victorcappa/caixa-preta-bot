"use client";

import { useEffect, useRef, useState } from "react";
import {
  attachSceneAudioEffects,
  detachSceneAudioEffects,
  updateSceneAudioEffects
} from "@/lib/sceneAudioGraph";
import DisplayBlackout from "./DisplayBlackout";
import GlitchOverlay from "./GlitchOverlay";
import styles from "./ForcaGSamplerStage.module.css";

const TUNNEL_REFERENCE_SRC = "/api/game-assets?file=imagens%2Fforca-g%2Fvisao-tunel.jpeg";

function assetSrc(assetPath = "") {
  return assetPath ? `/api/game-assets?file=${encodeURIComponent(assetPath)}` : "";
}

function post(action, payload = {}) {
  return fetch("/api/forca-g-sampler", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  }).catch(() => {});
}

function reportError(item, message) {
  console.error(`SamplerForcaG: falha ao reproduzir assets/${item.assetPath || item.id}: ${message}`);
  void post("error", { itemId: item.id, message });
}

function VisualMedia({ item, category }) {
  const mediaRef = useRef(null);
  const itemRef = useRef(item);
  const src = assetSrc(item.assetPath);
  itemRef.current = item;

  useEffect(() => {
    if (!item.durationMs) return undefined;
    const timer = window.setTimeout(() => void post("stop", { category, itemId: item.id }), item.durationMs);
    return () => window.clearTimeout(timer);
  }, [category, item.durationMs, item.id, item.playbackId]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || item.type !== "video") return;
    media.volume = Math.max(0, Math.min(1, Number(itemRef.current.volume ?? 1)));
    media.muted = Boolean(itemRef.current.muted);
    media.currentTime = 0;
    media.play().catch(async (error) => {
      if (error?.name === "AbortError") return;

      if (!itemRef.current.muted) {
        media.muted = true;
        try {
          await media.play();
          void post("update", { category, patch: { muted: true } });
          console.warn(`SamplerForcaG: autoplay com áudio bloqueado; ${itemRef.current.label} iniciou em MUTED`);
          return;
        } catch (mutedError) {
          if (mutedError?.name === "AbortError") return;
          reportError(itemRef.current, mutedError.message || "play bloqueado");
          return;
        }
      }

      reportError(itemRef.current, error.message || "play bloqueado");
    });
    return () => {
      media.pause();
      media.removeAttribute("src");
      media.load();
    };
  }, [category, item.playbackId, item.type]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || item.type !== "video") return;
    media.volume = Math.max(0, Math.min(1, Number(item.volume ?? 1)));
    media.muted = Boolean(item.muted);
  }, [item.muted, item.type, item.volume]);

  useEffect(() => {
    if (!item.stopping) return undefined;
    const timer = window.setTimeout(() => void post("stop", { category, itemId: item.id, immediate: true }), item.fadeOutMs);
    return () => window.clearTimeout(timer);
  }, [category, item.fadeOutMs, item.id, item.stopping]);

  const className = `${styles.visualMedia} ${item.fadeInMs ? styles.fadeIn : ""} ${item.stopping ? styles.fadeOut : ""}`;
  const style = { objectFit: item.fit || "contain", "--fade-in-ms": `${item.fadeInMs || 0}ms`, "--fade-out-ms": `${item.fadeOutMs || 0}ms` };

  if (item.type === "video") {
    return (
      <video
        autoPlay
        className={className}
        controls={false}
        loop={Boolean(item.loop)}
        onEnded={() => void post("stop", { category, itemId: item.id })}
        onError={() => reportError(item, "vídeo indisponível ou formato não suportado")}
        playsInline
        preload="auto"
        ref={mediaRef}
        src={src}
        style={style}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className={className}
      onError={() => reportError(item, "imagem indisponível ou formato não suportado")}
      src={src}
      style={style}
    />
  );
}

function AudioVoice({ item, masterVolume }) {
  const ref = useRef(null);
  const itemRef = useRef(item);
  itemRef.current = item;

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    let cancelled = false;
    audio.currentTime = 0;
    audio.play().catch((error) => {
      if (cancelled || error?.name === "AbortError") return;
      reportError(itemRef.current, error.message || "áudio bloqueado");
    });
    return () => {
      cancelled = true;
      audio.pause();
      detachSceneAudioEffects(audio);
      audio.removeAttribute("src");
      audio.load();
    };
  }, [item.playbackId]);

  useEffect(() => {
    if (ref.current) ref.current.volume = Math.max(0, Math.min(1, Number(item.volume ?? 1) * masterVolume));
  }, [item.volume, masterVolume]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio || !item.audioEffects) return undefined;
    if (updateSceneAudioEffects(audio, item.audioEffects) || !item.audioEffects.enabled) return undefined;
    let cancelled = false;
    void attachSceneAudioEffects(audio, item.audioEffects).then(() => {
      if (cancelled) detachSceneAudioEffects(audio);
    });
    return () => { cancelled = true; };
  }, [item.audioEffects]);

  useEffect(() => {
    if (!item.durationMs) return undefined;
    const timer = window.setTimeout(() => {
      void post("stop", { category: "audio", itemId: item.id, playbackId: item.playbackId });
    }, item.durationMs);
    return () => window.clearTimeout(timer);
  }, [item.durationMs, item.id, item.playbackId]);

  useEffect(() => {
    if (!item.stopping || !ref.current) return undefined;
    const audio = ref.current;
    const startVolume = audio.volume;
    const startedAt = performance.now();
    let frame = 0;
    function fade(now) {
      const progress = Math.min(1, (now - startedAt) / Math.max(1, item.fadeOutMs));
      audio.volume = startVolume * (1 - progress);
      if (progress < 1) frame = requestAnimationFrame(fade);
      else void post("stop", { category: "audio", itemId: item.id, playbackId: item.playbackId, immediate: true });
    }
    frame = requestAnimationFrame(fade);
    return () => cancelAnimationFrame(frame);
  }, [item.fadeOutMs, item.id, item.playbackId, item.stopping]);

  return (
    <audio
      autoPlay
      loop={Boolean(item.loop)}
      onEnded={() => void post("stop", { category: "audio", itemId: item.id, playbackId: item.playbackId })}
      onError={() => reportError(item, "áudio indisponível ou formato não suportado")}
      preload="auto"
      ref={ref}
      src={assetSrc(item.assetPath)}
    />
  );
}

function TextLayer({ item }) {
  useEffect(() => {
    if (!item.durationMs) return undefined;
    const timer = window.setTimeout(() => void post("clear-text"), item.durationMs);
    return () => window.clearTimeout(timer);
  }, [item.durationMs, item.playbackId]);

  useEffect(() => {
    if (!item.stopping) return undefined;
    const timer = window.setTimeout(() => void post("stop", { category: "texts", itemId: item.id, immediate: true }), item.fadeOutMs);
    return () => window.clearTimeout(timer);
  }, [item.fadeOutMs, item.id, item.stopping]);

  return (
    <div
      className={`${styles.textLayer} ${item.fadeInMs ? styles.fadeIn : ""} ${item.stopping ? styles.fadeOut : ""}`}
      style={{ ...item.style, "--fade-in-ms": `${item.fadeInMs || 0}ms`, "--fade-out-ms": `${item.fadeOutMs || 0}ms` }}
    >
      {item.text || item.label}
    </div>
  );
}

function ShaderLayer({ shaders }) {
  const intensity = Math.max(0, Math.min(100, Number(shaders?.intensity) || 0)) / 100;
  if (!shaders?.tunnel && !shaders?.redout && !shaders?.distortion) return null;
  const className = [
    styles.shaderLayer,
    shaders.tunnel ? styles.shaderTunnel : "",
    shaders.redout ? styles.shaderRedout : "",
    shaders.distortion ? styles.shaderDistortion : ""
  ].filter(Boolean).join(" ");
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        "--shader-tunnel": `${0.72 + intensity * 0.26}`,
        "--tunnel-clear": `${Math.max(12, 48 - intensity * 30)}%`,
        "--tunnel-mid": `${Math.max(30, 68 - intensity * 24)}%`,
        "--shader-redout": `${0.12 + intensity * 0.42}`,
        "--shader-a": `${0.04 + intensity * 0.12}`,
        "--shader-b": `${0.03 + intensity * 0.08}`,
        "--shader-shift": `${intensity * 18}px`
      }}
    />
  );
}

function preload(config) {
  const releases = [];
  const tunnelReference = new Image();
  tunnelReference.src = TUNNEL_REFERENCE_SRC;
  releases.push(() => { tunnelReference.src = ""; });
  for (const item of Object.values(config?.sections || {}).flat()) {
    if (!item.available || !item.assetPath) continue;
    const src = assetSrc(item.assetPath);
    if (item.type === "image") {
      const image = new Image();
      image.src = src;
      releases.push(() => { image.src = ""; });
    } else if (item.type === "audio") {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = src;
      audio.load();
      releases.push(() => { audio.removeAttribute("src"); audio.load(); });
    } else if (item.type === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = src;
      video.load();
      releases.push(() => { video.removeAttribute("src"); video.load(); });
    }
  }
  return () => releases.forEach((release) => release());
}

const EMPTY_STATE = { layers: { gLoc: null, video: null, images: [], text: null }, audioCues: [], masterVolume: 1 };

export default function ForcaGSamplerStage() {
  const [sampler, setSampler] = useState(EMPTY_STATE);
  const [shaders, setShaders] = useState(null);
  const [glitch, setGlitch] = useState(null);
  const [blackout, setBlackout] = useState(null);

  useEffect(() => {
    let releasePreload = () => {};
    fetch("/api/forca-g-sampler", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setSampler(data.state || EMPTY_STATE);
        setShaders(data.shaders || null);
        setGlitch(data.glitch || null);
        setBlackout(data.displayBlackout || null);
        releasePreload = preload(data.config);
      })
      .catch(() => {});

    const events = new EventSource("/api/events?client=forca-g-sampler-display");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const state = payload.state || {};
      if (state.forcaGSampler || payload.forcaGSampler) setSampler(state.forcaGSampler || payload.forcaGSampler);
      if (state.forcaGShaders || payload.forcaGShaders) setShaders(state.forcaGShaders || payload.forcaGShaders);
      if (state.glitch || payload.glitch) setGlitch(state.glitch || payload.glitch);
      if (state.displayBlackout || payload.displayBlackout) setBlackout(state.displayBlackout || payload.displayBlackout);
    };
    return () => { events.close(); releasePreload(); };
  }, []);

  const { layers = EMPTY_STATE.layers, audioCues = [], masterVolume = 1 } = sampler;
  const hasVisualMedia = Boolean(layers.video || layers.gLoc || (layers.images || []).length);
  return (
    <GlitchOverlay glitch={glitch}>
    <main className={styles.stage} aria-label="Projeção do sampler Força G">
      {shaders?.tunnel && !hasVisualMedia ? (
        <div className={styles.tunnelReferenceLayer}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Teste de visão em túnel" src={TUNNEL_REFERENCE_SRC} />
        </div>
      ) : null}
      <div className={styles.videoLayer}>{layers.video ? <VisualMedia category="video" item={layers.video} key={layers.video.playbackId} /> : null}</div>
      <div className={styles.gLocLayer}>{layers.gLoc ? <VisualMedia category="gLoc" item={layers.gLoc} key={layers.gLoc.playbackId} /> : null}</div>
      <div className={styles.imageLayer}>{(layers.images || []).map((item) => <VisualMedia category="images" item={item} key={item.playbackId} />)}</div>
      <ShaderLayer shaders={shaders} />
      <div className={styles.textSlot}>{layers.text ? <TextLayer item={layers.text} key={layers.text.playbackId} /> : null}</div>
      {audioCues.map((item) => <AudioVoice item={item} key={item.playbackId} masterVolume={masterVolume} />)}
      <DisplayBlackout blackout={blackout} target="cenas" />
    </main>
    </GlitchOverlay>
  );
}
