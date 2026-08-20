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
const MIN_FRAME_DELAY_MS = 34;
const MAX_FRAME_DELAY_MS = 250;

export default function InstagramBrowserPanel({ instagram, onClose }) {
  const personResearch = instagram.browserMode === "person_research";
  const googleGuidance = instagram.browserMode === "google_guidance";
  const publicResearch = personResearch || googleGuidance;
  const researchPerson = instagram.research?.person || "pessoa escolhida";
  const researchLabel = googleGuidance ? (instagram.research?.query || "orientação do operador") : researchPerson;
  const [activePane, setActivePane] = useState("primary");
  const [frameViewport, setFrameViewport] = useState(instagram.viewport || { width: 430, height: 760 });
  const [frameImage, setFrameImage] = useState("");
  const [frameError, setFrameError] = useState("");
  const viewportRef = useRef(null);
  const hasFrameImageRef = useRef(false);
  const pointerRef = useRef(null);
  const ignoreNextClickRef = useRef(false);
  const wheelRef = useRef({ deltaY: 0, sentAt: 0 });

  useEffect(() => {
    if (instagram.viewport?.width && instagram.viewport?.height) {
      setFrameViewport(instagram.viewport);
    }
    setFrameError("");
  }, [instagram.status, instagram.updatedAt, instagram.viewport]);

  useEffect(() => {
    if (activePane === "secondary" && !instagram.secondaryBrowser?.active) setActivePane("primary");
    setFrameImage("");
    hasFrameImageRef.current = false;
  }, [activePane, instagram.secondaryBrowser?.active]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const targetFps = Number(instagram.streamFps) || 24;
    const frameDelayMs = Math.min(
      MAX_FRAME_DELAY_MS,
      Math.max(MIN_FRAME_DELAY_MS, Math.round(1000 / targetFps))
    );

    async function loadFrame() {
      const startedAt = Date.now();

      try {
        const response = await fetch(`/api/instagram/frame?pane=${activePane}&t=${Date.now()}`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error("FRAME UNAVAILABLE");
        }

        const data = await response.json();
        if (!cancelled) {
          if (data.viewport?.width && data.viewport?.height) {
            setFrameViewport(data.viewport);
          }
          hasFrameImageRef.current = Boolean(data.image);
          setFrameImage(data.image || "");
          setFrameError("");
        }
      } catch (error) {
        if (!cancelled && !hasFrameImageRef.current) {
          setFrameError("FRAME RECONECTANDO");
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(loadFrame, Math.max(0, frameDelayMs - (Date.now() - startedAt)));
        }
      }
    }

    loadFrame();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activePane, instagram.status, instagram.streamFps]);

  async function sendInput(payload) {
    await fetch("/api/instagram/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, pane: activePane })
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

  return (
    <aside className={styles.panel} aria-label={publicResearch ? "Pesquisa pública real embutida" : "Instagram real embutido"}>
      <header className={styles.header}>
        <div>
          <span>{publicResearch ? (googleGuidance ? "GOOGLE REAL" : "PESQUISA PÚBLICA REAL") : "INSTAGRAM REAL"}</span>
          <strong>{publicResearch
            ? researchLabel
            : instagram.targetProfile ? `@${instagram.targetProfile}` : `@${instagram.account || "caixapretabot"}`}</strong>
        </div>
        <p>{instagram.message || instagram.status}</p>
        {googleGuidance && instagram.secondaryBrowser?.active ? (
          <nav className={styles.tabs} aria-label="Abas da pesquisa">
            <button className={activePane === "primary" ? styles.activeTab : ""} onClick={() => setActivePane("primary")} type="button">NOTÍCIAS</button>
            <button className={activePane === "secondary" ? styles.activeTab : ""} onClick={() => setActivePane("secondary")} type="button">INSTAGRAM</button>
          </nav>
        ) : null}
        <button aria-label={publicResearch ? "Fechar pesquisa embutida" : "Fechar Instagram embutido"} onClick={onClose} type="button">
          X
        </button>
      </header>

      <div
        aria-label={publicResearch ? "Frame interativo da pesquisa pública" : "Frame interativo do Instagram"}
        className={`${styles.viewport} ${googleGuidance && activePane === "primary" ? styles.googleViewport : ""}`}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        ref={viewportRef}
        role="application"
        style={{ aspectRatio: `${frameViewport.width || 430} / ${frameViewport.height || 760}` }}
        tabIndex={0}
      >
        {frameError && !frameImage ? (
          <div className={styles.placeholder}>{frameError}</div>
        ) : null}
        {frameImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={publicResearch ? `Pesquisa pública real por ${researchLabel}` : "Instagram real controlado pelo Playwright"}
            draggable="false"
            onError={() => setFrameError("FRAME RECONECTANDO")}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth && naturalHeight) {
                setFrameViewport({ width: naturalWidth, height: naturalHeight });
              }
            }}
            src={frameImage}
          />
        ) : null}
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
