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
  const [streamReady, setStreamReady] = useState(false);
  const viewportRef = useRef(null);
  const streamImageRef = useRef(null);
  const streamObjectUrlRef = useRef(null);
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
    if (streamObjectUrlRef.current) {
      URL.revokeObjectURL(streamObjectUrlRef.current);
    }
  }, []);

  const streamSrc = useMemo(() => {
    const key = [instagram.updatedAt, instagram.status, instagram.currentUrl, streamRetry].filter(Boolean).join("-");
    return `/api/instagram/stream?stream=${encodeURIComponent(key || "active")}`;
  }, [instagram.currentUrl, instagram.status, instagram.updatedAt, streamRetry]);

  useEffect(() => {
    let cancelled = false;
    let buffer = new Uint8Array(0);
    const controller = new AbortController();

    async function readStream() {
      try {
        setStreamError((current) => current || "STREAM CONECTANDO");
        const response = await fetch(streamSrc, {
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok || !response.body) {
          throw new Error("STREAM UNAVAILABLE");
        }

        const reader = response.body.getReader();
        setStreamError("");

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) {
            throw new Error("STREAM ENDED");
          }

          buffer = appendBuffer(buffer, value);
          const extracted = extractJpegFrames(buffer);
          buffer = extracted.remaining;

          for (const image of extracted.images) {
            updateStreamImage(streamImageRef.current, streamObjectUrlRef, image);
            setStreamReady(true);
            setStreamError("");
          }
        }
      } catch (error) {
        if (cancelled || error.name === "AbortError") {
          return;
        }

        handleStreamError();
      }
    }

    readStream();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [streamSrc]);

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
    event.preventDefault();
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
    event.preventDefault();

    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    if (Math.abs(deltaY) < 48 || Math.abs(deltaY) < Math.abs(deltaX) * 1.4) {
      const point = normalizedPointInFrame(
        viewportRef.current?.getBoundingClientRect(),
        frameViewport,
        event.clientX,
        event.clientY
      );

      if (point) {
        ignoreNextClickRef.current = true;
        sendInput({
          type: "click",
          x: point.x,
          y: point.y
        });
      }
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
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        ref={viewportRef}
        role="application"
        style={{ aspectRatio: `${frameViewport.width || 430} / ${frameViewport.height || 760}` }}
        tabIndex={0}
      >
        {streamError && !streamReady ? (
          <div className={styles.placeholder}>{streamError}</div>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="Instagram real controlado pelo Playwright"
          className={streamReady ? "" : styles.hiddenFrame}
          draggable="false"
          onError={handleStreamError}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth && naturalHeight) {
              setFrameViewport({ width: naturalWidth, height: naturalHeight });
            }
          }}
          ref={streamImageRef}
        />
        <div
          aria-hidden="true"
          className={styles.interactionLayer}
          onClick={handleClick}
          onPointerCancel={handlePointerCancel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
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

function appendBuffer(current, next) {
  const merged = new Uint8Array(current.length + next.length);
  merged.set(current);
  merged.set(next, current.length);
  return merged;
}

function extractJpegFrames(buffer) {
  const images = [];
  let offset = 0;

  while (offset < buffer.length) {
    const start = findMarker(buffer, 0xff, 0xd8, offset);
    if (start < 0) {
      return { images, remaining: new Uint8Array(0) };
    }

    const end = findMarker(buffer, 0xff, 0xd9, start + 2);
    if (end < 0) {
      const remaining = buffer.slice(start);
      return {
        images,
        remaining: remaining.length > 2_000_000 ? remaining.slice(-2_000_000) : remaining
      };
    }

    images.push(buffer.slice(start, end + 2));
    offset = end + 2;
  }

  return { images, remaining: new Uint8Array(0) };
}

function findMarker(buffer, first, second, startAt) {
  for (let index = startAt; index < buffer.length - 1; index += 1) {
    if (buffer[index] === first && buffer[index + 1] === second) {
      return index;
    }
  }

  return -1;
}

function updateStreamImage(imageElement, objectUrlRef, image) {
  if (!imageElement) {
    return;
  }

  const previousUrl = objectUrlRef.current;
  const nextUrl = URL.createObjectURL(new Blob([image], { type: "image/jpeg" }));
  objectUrlRef.current = nextUrl;
  imageElement.src = nextUrl;

  if (previousUrl) {
    setTimeout(() => URL.revokeObjectURL(previousUrl), 1000);
  }
}
