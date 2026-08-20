"use client";

import { useEffect, useRef, useState } from "react";
import {
  attachSceneAudioEffects,
  detachSceneAudioEffects,
  fadeOutMedia,
  updateSceneAudioEffects
} from "@/lib/sceneAudioGraph";
import DisplayBlackout from "./DisplayBlackout";
import styles from "./PublicSceneStage.module.css";

function assetSrc(assetPath = "") {
  return assetPath ? `/api/game-assets?file=${encodeURIComponent(assetPath)}` : "";
}

function PublicCueMedia({ cue, globalVolume = 1, onEnded = null }) {
  const mediaRef = useRef(null);
  const onEndedRef = useRef(onEnded);
  const src = assetSrc(cue?.assetPath);
  onEndedRef.current = onEnded;

  useEffect(() => {
    const media = mediaRef.current;

    if (!media || !src) {
      return;
    }

    media.currentTime = 0;
    media.play().catch(() => {
      if (cue.type !== "video") {
        return;
      }

      media.muted = true;
      media.play().catch(() => {});
    });

    return () => {
      media.pause();
      detachSceneAudioEffects(media);
      media.removeAttribute("src");
      media.load();
    };
  }, [cue?.sequence, cue?.type, src]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !["audio", "video"].includes(cue?.type)) return;
    media.volume = Math.max(0, Math.min(1, Number(cue.volume ?? 1) * globalVolume));
  }, [cue.volume, cue?.type, globalVolume]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || cue?.type !== "audio" || !cue.audioEffects) return;
    if (!updateSceneAudioEffects(media, cue.audioEffects) && cue.audioEffects.enabled) {
      void attachSceneAudioEffects(media, cue.audioEffects);
    }
  }, [cue.audioEffects, cue?.type]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || cue?.type !== "audio" || !cue.fadeOutSequence) return;
    return fadeOutMedia(media, cue.fadeOutMs, () => onEndedRef.current?.());
  }, [cue.fadeOutMs, cue.fadeOutSequence, cue?.type]);

  if (cue.type === "text") {
    return (
      <div
        className={styles.risingText}
        style={{ "--cue-color": cue.color, "--cue-text-duration": `${Math.max(1000, cue.durationMs || 15000)}ms` }}
      >
        {cue.text || cue.label}
      </div>
    );
  }

  if (!src) {
    return null;
  }

  if (cue.type === "video") {
    return <video autoPlay className={styles.media} controls={false} playsInline ref={mediaRef} src={src} />;
  }

  if (cue.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" className={styles.media} src={src} />;
  }

  return (
    <audio
      autoPlay
      loop={Boolean(cue.loop)}
      onEnded={onEnded || undefined}
      ref={mediaRef}
      src={src}
      volume={Math.max(0, Math.min(1, Number(cue.volume ?? 1) * globalVolume))}
    />
  );
}

export function PublicSceneAudioOutput({ controllerId = "", globalVolume = 1, sceneCue = null }) {
  const audioCues = (sceneCue?.audioCues || []).filter((cue) => (
    cue.controllerId === controllerId && cue.type === "audio" && cue.assetPath
  ));

  function reportEnded(cue) {
    fetch("/api/controller-cues/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        controllerId,
        action: "stop-instance",
        cueId: cue.id,
        playbackId: cue.playbackId
      })
    }).catch(() => {});
  }

  return audioCues.map((cue) => (
    <PublicCueMedia
      cue={cue}
      globalVolume={globalVolume}
      key={cue.playbackId || `${cue.id}-${cue.sequence}`}
      onEnded={() => reportEnded(cue)}
    />
  ));
}

function PublicAudioCueText({ controllerId = "", sceneCue = null }) {
  const cue = (sceneCue?.audioCues || []).findLast((item) => (
    item.controllerId === controllerId && item.type === "audio" && item.text
  ));

  if (!cue) {
    return null;
  }

  return (
    <div className={styles.staticText} style={{ "--cue-color": cue.color }}>
      {cue.text}
    </div>
  );
}

export default function PublicSceneStage({ blackoutTarget = "cenas", controllerId = "" }) {
  const [displayBlackout, setDisplayBlackout] = useState(null);
  const [sceneCue, setSceneCue] = useState(null);
  const [forcaGShaders, setForcaGShaders] = useState(null);
  const [globalVolume, setGlobalVolume] = useState(1);

  useEffect(() => {
    fetch("/api/state")
      .then((response) => response.json())
      .then((data) => {
        setDisplayBlackout(data.displayBlackout || null);
        setSceneCue(data.sceneCue || null);
        setForcaGShaders(data.forcaGShaders || null);
        setGlobalVolume(data.globalVolume ?? 1);
      })
      .catch(() => {});

    const events = new EventSource("/api/events?client=public-scene-stage");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setDisplayBlackout(payload.state?.displayBlackout || payload.displayBlackout || null);
      setSceneCue(payload.state?.sceneCue || payload.sceneCue || null);
      setForcaGShaders(payload.state?.forcaGShaders || payload.forcaGShaders || null);
      setGlobalVolume(payload.state?.globalVolume ?? payload.globalVolume ?? 1);
    };

    return () => events.close();
  }, []);

  const cue = sceneCue?.controllerId === controllerId && sceneCue.cue
    ? { ...sceneCue.cue, sequence: sceneCue.sequence }
    : null;
  const shaderActive = controllerId === "forca-g-shaders"
    && Boolean(forcaGShaders?.tunnel || forcaGShaders?.redout || forcaGShaders?.distortion);
  const shaderClassName = [
    styles.shaderOverlay,
    forcaGShaders?.tunnel ? styles.shaderTunnel : "",
    forcaGShaders?.redout ? styles.shaderRedout : "",
    forcaGShaders?.distortion ? styles.shaderDistortion : ""
  ].filter(Boolean).join(" ");
  const shaderIntensity = Math.max(0, Math.min(100, Number(forcaGShaders?.intensity) || 0)) / 100;
  const shaderStyle = {
    "--shader-tunnel": `${0.72 + shaderIntensity * 0.26}`,
    "--shader-redout": `${0.12 + shaderIntensity * 0.42}`,
    "--shader-distortion-a": `${0.04 + shaderIntensity * 0.12}`,
    "--shader-distortion-b": `${0.03 + shaderIntensity * 0.08}`,
    "--shader-shift": `${shaderIntensity * 18}px`
  };

  return (
    <main className={styles.stage} aria-label="Cena publica">
      {cue ? <PublicCueMedia cue={cue} globalVolume={globalVolume} key={cue.sequence} /> : null}
      <PublicSceneAudioOutput controllerId={controllerId} globalVolume={globalVolume} sceneCue={sceneCue} />
      <PublicAudioCueText controllerId={controllerId} sceneCue={sceneCue} />
      {shaderActive ? (
        <div
          aria-hidden="true"
          className={shaderClassName}
          style={shaderStyle}
        />
      ) : null}
      <DisplayBlackout blackout={displayBlackout} target={blackoutTarget} />
    </main>
  );
}
