"use client";

import { useEffect, useRef, useState } from "react";
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
  const [frame, setFrame] = useState(null);
  const [frameError, setFrameError] = useState("");
  const viewportRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function loadFrame() {
      try {
        const response = await fetch(`/api/instagram/frame?t=${Date.now()}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("FRAME UNAVAILABLE");
        }

        const data = await response.json();
        if (!cancelled) {
          setFrame(data);
          setFrameError("");
        }
      } catch {
        if (!cancelled) {
          setFrameError("FRAME UNAVAILABLE");
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(loadFrame, instagram.status === "ACTING" || instagram.status === "NAVIGATING" ? 500 : 900);
        }
      }
    }

    loadFrame();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [instagram.status]);

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
      frame?.viewport,
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
        style={{ aspectRatio: `${frame?.viewport?.width || 430} / ${frame?.viewport?.height || 760}` }}
        tabIndex={0}
      >
        {frame?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Instagram real controlado pelo Playwright" draggable="false" src={frame.image} />
        ) : (
          <div className={styles.placeholder}>{frameError || "CARREGANDO FRAME"}</div>
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
