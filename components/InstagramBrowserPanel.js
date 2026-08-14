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
  const [streamRetry, setStreamRetry] = useState(0);
  const viewportRef = useRef(null);
  const pointerRef = useRef(null);
  const ignoreNextClickRef = useRef(false);
  const wheelRef = useRef({ deltaY: 0, sentAt: 0 });
  const streamRetryTimerRef = useRef(null);

  useEffect(() => {
    if (instagram.viewport?.width && instagram.viewport?.height) {
      setFrameViewport(instagram.viewport);
    }
    setStreamError("");
  }, [instagram.status, instagram.updatedAt, instagram.viewport]);

  useEffect(() => () => {
    clearTimeout(streamRetryTimerRef.current);
  }, []);

  const streamSrc = useMemo(() => {
    const key = [instagram.updatedAt, instagram.status, instagram.currentUrl, streamRetry].filter(Boolean).join("-");
    return `/api/instagram/stream?stream=${encodeURIComponent(key || "active")}`;
  }, [instagram.currentUrl, instagram.status, instagram.updatedAt, streamRetry]);

  async function sendInput(payload) {
    await fetch("/api/instagram/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => null);
  }

  function sendSwipe(direction, source = "pointer") {
    viewportRef.current?.focus();
    sendInput({ type: "swipe", direction, source });
  }

  function handleClick(event) {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      event.preventDefault();
      return;
    }

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

  function handlePointerDown(event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    viewportRef.current?.focus();
    pointerRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) {
      return;
    }

    if (Math.abs(event.clientY - pointer.y) > 12 || Math.abs(event.clientX - pointer.x) > 12) {
      pointer.moved = true;
    }
  }

  function handlePointerUp(event) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) {
      return;
    }

    pointerRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    if (Math.abs(deltaY) < 48 || Math.abs(deltaY) < Math.abs(deltaX) * 1.4) {
      return;
    }

    ignoreNextClickRef.current = true;
    sendSwipe(deltaY < 0 ? "up" : "down");
  }

  function handlePointerCancel(event) {
    if (pointerRef.current?.id === event.pointerId) {
      pointerRef.current = null;
    }
  }

  function handleWheel(event) {
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX) || Math.abs(event.deltaY) < 8) {
      return;
    }

    event.preventDefault();
    const now = Date.now();
    const nextDeltaY = wheelRef.current.deltaY + event.deltaY;
    wheelRef.current = { deltaY: nextDeltaY, sentAt: wheelRef.current.sentAt };

    if (Math.abs(nextDeltaY) < 120 || now - wheelRef.current.sentAt < 450) {
      return;
    }

    wheelRef.current = { deltaY: 0, sentAt: now };
    sendSwipe(nextDeltaY > 0 ? "up" : "down", "wheel");
  }

  function handleStreamError() {
    setStreamError("STREAM RECONECTANDO");
    clearTimeout(streamRetryTimerRef.current);
    streamRetryTimerRef.current = setTimeout(() => {
      setStreamError("");
      setStreamRetry((retry) => retry + 1);
    }, 900);
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
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
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
            onError={handleStreamError}
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
