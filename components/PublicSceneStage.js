"use client";

import { useEffect, useRef, useState } from "react";
import DisplayBlackout from "./DisplayBlackout";
import styles from "./PublicSceneStage.module.css";

function assetSrc(assetPath = "") {
  return assetPath ? `/api/game-assets?file=${encodeURIComponent(assetPath)}` : "";
}

function PublicCueMedia({ cue, onEnded = null }) {
  const mediaRef = useRef(null);
  const src = assetSrc(cue?.assetPath);

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
      media.removeAttribute("src");
      media.load();
    };
  }, [cue?.sequence, cue?.type, src]);

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
      volume={Math.max(0, Math.min(1, Number(cue.volume ?? 1)))}
    />
  );
}

export function PublicSceneAudioOutput({ controllerId = "", sceneCue = null }) {
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
      key={cue.playbackId || `${cue.id}-${cue.sequence}`}
      onEnded={() => reportEnded(cue)}
    />
  ));
}

export default function PublicSceneStage({ blackoutTarget = "cenas", controllerId = "" }) {
  const [displayBlackout, setDisplayBlackout] = useState(null);
  const [sceneCue, setSceneCue] = useState(null);
  const [forcaGShaders, setForcaGShaders] = useState(null);

  useEffect(() => {
    fetch("/api/state")
      .then((response) => response.json())
      .then((data) => {
        setDisplayBlackout(data.displayBlackout || null);
        setSceneCue(data.sceneCue || null);
        setForcaGShaders(data.forcaGShaders || null);
      })
      .catch(() => {});

    const events = new EventSource("/api/events?client=public-scene-stage");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setDisplayBlackout(payload.state?.displayBlackout || payload.displayBlackout || null);
      setSceneCue(payload.state?.sceneCue || payload.sceneCue || null);
      setForcaGShaders(payload.state?.forcaGShaders || payload.forcaGShaders || null);
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
      {cue ? <PublicCueMedia cue={cue} key={cue.sequence} /> : null}
      <PublicSceneAudioOutput controllerId={controllerId} sceneCue={sceneCue} />
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
