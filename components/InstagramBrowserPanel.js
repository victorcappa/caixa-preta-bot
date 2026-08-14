"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./InstagramBrowserPanel.module.css";

const INPUT_KEYS = [
  "Backspace",
  "Delete",
  "Enter",
  "Escape",
  "Tab",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown"
];

export default function InstagramBrowserPanel({ instagram, onClose }) {
  const [frameViewport, setFrameViewport] = useState(instagram.viewport || { width: 430, height: 760 });
  const [streamError, setStreamError] = useState("");
  const viewportRef = useRef(null);

  useEffect(() => {
    if (instagram.viewport?.width && instagram.viewport?.height) {
      setFrameViewport(instagram.viewport);
    }
    setStreamError("");
  }, [instagram.status, instagram.updatedAt, instagram.viewport]);

  const streamSrc = useMemo(() => {
    const key = [instagram.updatedAt, instagram.status, instagram.currentUrl].filter(Boolean).join("-");
    return `/api/instagram/stream?stream=${encodeURIComponent(key || "active")}`;
  }, [instagram.currentUrl, instagram.status, instagram.updatedAt]);

  async function sendInput(payload) {
    await fetch("/api/instagram/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => null);
  }

  function handleClick(event) {
    const point = normalizedPointInFrame(
      viewportRef.current?.getBoundingClientRect(),
      frameViewport,
      event.clientX,
      event.clientY
    );

    if (!point) {
      return;
    }

    viewportRef.current.focus();
    sendInput({
      type: "click",
      x: point.x,
      y: point.y
    });
  }

  function handleKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.key.length === 1 || INPUT_KEYS.includes(event.key)) {
      event.preventDefault();
      sendInput({ type: "key", key: event.key });
    }
  }

  return (
    <aside className={styles.panel} aria-label="Instagram real embutido">
      <header className={styles.header}>
        <div>
          <span>INSTAGRAM REAL</span>
          <strong>{instagram.targetProfile ? `@${instagram.targetProfile}` : `@${instagram.account || "caixapretabot"}`}</strong>
        </div>
        <p>{instagram.message || instagram.status}</p>
        <button aria-label="Fechar Instagram embutido" onClick={onClose} type="button">
          X
        </button>
      </header>

      <div
        aria-label="Frame interativo do Instagram"
        className={styles.viewport}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        ref={viewportRef}
        role="application"
        style={{ aspectRatio: `${frameViewport.width || 430} / ${frameViewport.height || 760}` }}
        tabIndex={0}
      >
        {streamError ? (
          <div className={styles.placeholder}>{streamError}</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="Instagram real controlado pelo Playwright"
            draggable="false"
            onError={() => setStreamError("STREAM INDISPONIVEL")}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth && naturalHeight) {
                setFrameViewport({ width: naturalWidth, height: naturalHeight });
              }
            }}
            src={streamSrc}
          />
        )}
      </div>
    </aside>
  );
}

function normalizedPointInFrame(rect, viewport, clientX, clientY) {
  if (!rect) {
    return null;
  }

  const sourceWidth = Number(viewport?.width) || 430;
  const sourceHeight = Number(viewport?.height) || 760;
  const sourceRatio = sourceWidth / sourceHeight;
  const boxRatio = rect.width / rect.height;
  let frameLeft = rect.left;
  let frameTop = rect.top;
  let frameWidth = rect.width;
  let frameHeight = rect.height;

  if (boxRatio > sourceRatio) {
    frameWidth = rect.height * sourceRatio;
    frameLeft = rect.left + ((rect.width - frameWidth) / 2);
  } else {
    frameHeight = rect.width / sourceRatio;
    frameTop = rect.top + ((rect.height - frameHeight) / 2);
  }

  const x = (clientX - frameLeft) / frameWidth;
  const y = (clientY - frameTop) / frameHeight;

  if (x < 0 || x > 1 || y < 0 || y > 1) {
    return null;
  }

  return { x, y };
}
