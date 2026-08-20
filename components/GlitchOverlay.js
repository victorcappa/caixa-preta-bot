"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./GlitchOverlay.module.css";

const DEFAULT_GLITCH = {
  active: false,
  mode: "idle",
  sequence: 0,
  params: {},
  video: {}
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function buildSlices(count, strength) {
  return Array.from({ length: count }, (_, index) => {
    const top = randomBetween(0, 96);
    const height = randomBetween(2, 8 + strength * 18);
    const shift = randomBetween(-1, 1) * (6 + strength * 44);
    return {
      id: `${index}-${top.toFixed(2)}-${shift.toFixed(2)}`,
      top,
      height,
      shift,
      opacity: randomBetween(0.08, 0.42 + strength * 0.36)
    };
  });
}

export default function GlitchOverlay({ children, glitch = DEFAULT_GLITCH, preview = false }) {
  const params = useMemo(() => glitch?.params || {}, [glitch?.params]);
  const active = Boolean(glitch?.active || preview);
  const video = glitch?.video || {};
  const [burst, setBurst] = useState({ level: active ? 0.6 : 0, flash: false, slices: [] });
  const [videoDominance, setVideoDominance] = useState(video.takeover ? 0 : 0);
  const videoRef = useRef(null);
  const startedAtRef = useRef(0);
  const videoEstablished = Boolean(video?.takeover && videoDominance >= 1);

  useEffect(() => {
    startedAtRef.current = Date.now();
    setVideoDominance(video.takeover ? 0 : 0);
  }, [glitch?.sequence, video?.src, video?.takeover]);

  useEffect(() => {
    if (!active) {
      setBurst({ level: 0, flash: false, slices: [] });
      setVideoDominance(0);
      return undefined;
    }

    let cancelled = false;
    let timer = null;

    function pulse() {
      if (cancelled) {
        return;
      }

      if (document.hidden) {
        timer = setTimeout(pulse, 500);
        return;
      }

      const baseIntensity = clamp(Number(params.intensity ?? 0.5), 0, 1);
      const frequency = clamp(Number(params.frequency ?? 0.5), 0, 1);
      const jitter = clamp(Number(params.jitter ?? 0.4), 0, 1);
      const flashChance = clamp(Number(params.flashChance ?? 0.2), 0, 1);
      const modeBoost = glitch?.mode === "continuous" || glitch?.mode === "video" ? randomBetween(0.2, 1) : randomBetween(0.45, 1);
      const level = clamp(baseIntensity * modeBoost + randomBetween(0, jitter * 0.42), 0, 1);
      const maxBlockCount = preview ? 10 : 32;
      const blockCount = Math.round(clamp(Number(params.blockCount ?? 8), 0, maxBlockCount) * randomBetween(0.35, 1));

      if (video?.takeover) {
        const transitionMs = Math.max(600, Number(video.transitionMs || 5200));
        const elapsed = Date.now() - startedAtRef.current;
        const progress = clamp(elapsed / transitionMs, 0, 1);

        if (progress >= 1) {
          setVideoDominance(1);
          setBurst({ level: 0, flash: false, slices: [] });
          return;
        }

        const invaded = clamp(progress + (Math.random() < 0.34 ? randomBetween(0, level * 0.28) : 0), 0, 1);
        setVideoDominance(invaded);
      }

      setBurst({
        level,
        flash: Math.random() < flashChance * (0.22 + level),
        slices: buildSlices(blockCount, level)
      });

      const interval = clamp(Number(params.intervalMs ?? 360), 40, 6000);
      const frequencyScale = 1 - frequency * 0.72;
      const minimumInterval = preview ? 120 : 35;
      timer = setTimeout(pulse, Math.max(minimumInterval, interval * frequencyScale * randomBetween(0.35, 1.35)));
    }

    pulse();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, glitch?.mode, glitch?.sequence, params, preview, video?.takeover, video?.transitionMs]);

  useEffect(() => {
    const element = videoRef.current;

    if (!element || !video?.src || !active) {
      return;
    }

    element.muted = false;
    element.play().catch(() => {
      element.muted = true;
      element.play().catch(() => {});
    });
  }, [active, video?.src, glitch?.sequence]);

  const cssVars = useMemo(() => {
    const intensity = clamp(Number(params.intensity ?? 0), 0, 1) * (0.3 + burst.level * 0.9);
    const rgb = clamp(Number(params.rgbSplit ?? params.chromaticAberration ?? 0), 0, 1) * (0.4 + burst.level);
    const horizontal = clamp(Number(params.horizontalShift ?? 0), 0, 1) * (0.2 + burst.level);
    const vertical = clamp(Number(params.verticalShift ?? 0), 0, 1) * burst.level;
    const tearing = clamp(Number(params.horizontalTearing ?? 0), 0, 1) * (0.35 + burst.level);
    const speed = clamp(Number(params.speed ?? 1), 0.05, 2);
    const desync = clamp(Number(params.desync ?? 0), 0, 1) * burst.level;

    return {
      "--glitch-intensity": intensity,
      "--glitch-rgb": `${Math.round(rgb * 22)}px`,
      "--glitch-shift-x": `${Math.round(horizontal * 42)}px`,
      "--glitch-shift-y": `${Math.round(vertical * 24)}px`,
      "--glitch-tear": `${Math.round(tearing * 68)}px`,
      "--glitch-noise": clamp(Number(params.noise ?? 0), 0, 1) * (0.4 + burst.level),
      "--glitch-flicker": clamp(Number(params.flicker ?? 0), 0, 1) * (0.3 + burst.level),
      "--glitch-scanlines": clamp(Number(params.scanlines ?? 0), 0, 1),
      "--glitch-distortion": clamp(Number(params.distortion ?? 0), 0, 1) * (0.35 + burst.level),
      "--glitch-desync": `${Math.round(desync * 110)}ms`,
      "--glitch-video": video?.takeover ? videoDominance : 0,
      "--glitch-speed": `${Math.max(80, Math.round(420 / speed))}ms`
    };
  }, [burst.level, params, video?.takeover, videoDominance]);

  const wrapperClass = [
    styles.wrapper,
    preview ? styles.preview : "",
    active ? styles.active : "",
    videoEstablished ? styles.videoEstablished : "",
    glitch?.mode === "continuous" ? styles.continuous : "",
    glitch?.mode === "video" ? styles.videoMode : ""
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass} style={cssVars}>
      <div className={styles.content}>{children}</div>
      {active && !videoEstablished ? (
        <div className={styles.overlay} aria-hidden="true">
          <div className={styles.rgbA} />
          <div className={styles.rgbB} />
          <div className={styles.noise} />
          <div className={styles.scanlines} />
          <div className={styles.vSync} />
          {burst.flash ? <div className={styles.flash} /> : null}
          {burst.slices.map((slice) => (
            <span
              className={styles.slice}
              key={slice.id}
              style={{
                top: `${slice.top}%`,
                height: `${slice.height}%`,
                transform: `translate3d(${slice.shift}px, 0, 0)`,
                opacity: slice.opacity
              }}
            />
          ))}
        </div>
      ) : null}
      {active && video?.src ? (
        <video
          className={`${styles.invadingVideo} ${videoEstablished ? styles.establishedVideo : ""}`}
          controls={false}
          loop={Boolean(video.loop)}
          playsInline
          preload="auto"
          ref={videoRef}
          src={video.src}
        />
      ) : null}
    </div>
  );
}
