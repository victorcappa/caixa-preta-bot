"use client";

import { useEffect, useRef, useState } from "react";
import DisplayBlackout from "./DisplayBlackout";
import styles from "./PublicSceneStage.module.css";

function assetSrc(assetPath = "") {
  return assetPath ? `/api/game-assets?file=${encodeURIComponent(assetPath)}` : "";
}

function PublicCueMedia({ cue }) {
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
  }, [cue?.sequence, cue?.type, src]);

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

  return <audio autoPlay ref={mediaRef} src={src} />;
}

export default function PublicSceneStage({ blackoutTarget = "cenas", controllerId = "" }) {
  const [displayBlackout, setDisplayBlackout] = useState(null);
  const [sceneCue, setSceneCue] = useState(null);

  useEffect(() => {
    fetch("/api/state")
      .then((response) => response.json())
      .then((data) => {
        setDisplayBlackout(data.displayBlackout || null);
        setSceneCue(data.sceneCue || null);
      })
      .catch(() => {});

    const events = new EventSource("/api/events?client=public-scene-stage");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setDisplayBlackout(payload.state?.displayBlackout || payload.displayBlackout || null);
      setSceneCue(payload.state?.sceneCue || payload.sceneCue || null);
    };

    return () => events.close();
  }, []);

  const cue = sceneCue?.controllerId === controllerId && sceneCue.cue
    ? { ...sceneCue.cue, sequence: sceneCue.sequence }
    : null;

  return (
    <main className={styles.stage} aria-label="Cena publica">
      {cue ? <PublicCueMedia cue={cue} /> : null}
      <DisplayBlackout blackout={displayBlackout} target={blackoutTarget} />
    </main>
  );
}
