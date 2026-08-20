"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./EditableCueController.module.css";

const EMPTY_ASSETS = { audio: [], video: [], image: [] };
const DEFAULT_EDITOR_WIDTH = 380;
const MIN_EDITOR_WIDTH = 280;
const MIN_PREVIEW_WIDTH = 320;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function editorWidthStorageKey(controllerId) {
  return `caixa-preta.cue-editor-width.${controllerId}`;
}

function storedEditorWidth(controllerId) {
  if (typeof window === "undefined") {
    return DEFAULT_EDITOR_WIDTH;
  }

  const value = Number(window.localStorage.getItem(editorWidthStorageKey(controllerId)));
  return Number.isFinite(value) ? value : DEFAULT_EDITOR_WIDTH;
}

function isTypingTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return ["input", "textarea", "select"].includes(tagName) || target?.isContentEditable;
}

function assetSrc(assetPath = "") {
  return assetPath ? `/api/game-assets?file=${encodeURIComponent(assetPath)}` : "";
}

function shortcutMatches(event, shortcut = "") {
  const normalized = shortcut.trim().toLowerCase();

  if (!normalized || event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }

  if (normalized === "space") {
    return event.key === " ";
  }

  return event.key.toLowerCase() === normalized;
}

function createCue(allowedTypes, colors) {
  return {
    id: crypto.randomUUID(),
    label: "Novo Botão",
    shortcut: "",
    type: allowedTypes[0] || "audio",
    assetPath: "",
    durationMs: 0,
    color: colors[0] || "#00ff66"
  };
}

async function fetchCueConfig(controllerId) {
  const response = await fetch(`/api/controller-cues?id=${encodeURIComponent(controllerId)}`, { cache: "no-store" });
  const data = await response.json();
  return { response, data };
}

async function saveCueConfig(controllerId, config) {
  const response = await fetch("/api/controller-cues", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: controllerId, config })
  });
  const data = await response.json();
  return { response, data };
}

async function postSceneCue(controllerId, action, cue = null) {
  const response = await fetch("/api/controller-cues/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      controllerId,
      action,
      cue,
      cueId: cue?.id || ""
    })
  });
  const data = await response.json();
  return { response, data };
}

export default function EditableCueController({ controllerId }) {
  const [config, setConfig] = useState(null);
  const [assets, setAssets] = useState(EMPTY_ASSETS);
  const [colors, setColors] = useState(["#00ff66"]);
  const [selectedCueId, setSelectedCueId] = useState("");
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("CONNECTING");
  const [saving, setSaving] = useState(false);
  const [editorWidth, setEditorWidth] = useState(DEFAULT_EDITOR_WIDTH);
  const audioRef = useRef(null);
  const clearPreviewRef = useRef(null);
  const screenRef = useRef(null);
  const triggerCueRef = useRef(null);

  useEffect(() => {
    setEditorWidth(storedEditorWidth(controllerId));
  }, [controllerId]);

  useEffect(() => {
    let active = true;

    fetchCueConfig(controllerId)
      .then(({ response, data }) => {
        if (!active) {
          return;
        }

        if (!response.ok) {
          setStatus(data.error || "CUES ERROR");
          return;
        }

        setConfig(data.config);
        setAssets(data.assets || EMPTY_ASSETS);
        setColors(data.colors || ["#00ff66"]);
        setSelectedCueId(data.config?.cues?.[0]?.id || "");
        setStatus("READY");
      })
      .catch(() => setStatus("DISCONNECTED"));

    return () => {
      active = false;
    };
  }, [controllerId]);

  const cues = useMemo(() => config?.cues || [], [config?.cues]);
  const selectedCue = cues.find((cue) => cue.id === selectedCueId) || cues[0] || null;
  const allowedTypes = useMemo(() => config?.allowedTypes || ["audio"], [config?.allowedTypes]);
  triggerCueRef.current = triggerCue;

  const availableAssets = useMemo(() => {
    const grouped = {};
    allowedTypes.forEach((type) => {
      grouped[type] = assets[type] || [];
    });
    return grouped;
  }, [allowedTypes, assets]);

  useEffect(() => {
    function handleKeydown(event) {
      if (isTypingTarget(event.target)) {
        return;
      }

      const cue = cues.find((item) => shortcutMatches(event, item.shortcut));

      if (!cue) {
        return;
      }

      event.preventDefault();
      triggerCueRef.current?.(cue);
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [cues]);

  function updateCue(cueId, patch) {
    setConfig((current) => ({
      ...current,
      cues: current.cues.map((cue) => cue.id === cueId ? { ...cue, ...patch } : cue)
    }));
  }

  function addCue() {
    const cue = createCue(allowedTypes, colors);
    setConfig((current) => ({
      ...current,
      cues: [...current.cues, cue]
    }));
    setSelectedCueId(cue.id);
  }

  function duplicateCue() {
    if (!selectedCue) {
      return;
    }

    const cue = {
      ...selectedCue,
      id: crypto.randomUUID(),
      label: `${selectedCue.label} copia`,
      shortcut: ""
    };

    setConfig((current) => ({
      ...current,
      cues: [...current.cues, cue]
    }));
    setSelectedCueId(cue.id);
  }

  function removeCue() {
    if (!selectedCue || cues.length <= 1) {
      return;
    }

    const nextCues = cues.filter((cue) => cue.id !== selectedCue.id);
    setConfig((current) => ({
      ...current,
      cues: nextCues
    }));
    setSelectedCueId(nextCues[0]?.id || "");
  }

  function triggerCue(cue) {
    window.clearTimeout(clearPreviewRef.current);
    setSelectedCueId(cue.id);
    setStatus(`PLAY ${cue.label}`);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const src = assetSrc(cue.assetPath);
    setPreview({ ...cue, src, sequence: crypto.randomUUID() });
    void triggerPublicCue(cue);

    if (cue.type === "audio" && src) {
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.play().catch(() => setStatus("AUDIO PLAY BLOCKED"));
    }

    if (cue.durationMs > 0) {
      clearPreviewRef.current = window.setTimeout(() => {
        setPreview(null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      }, cue.durationMs);
    }
  }

  function stopCue(cue) {
    window.clearTimeout(clearPreviewRef.current);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPreview(null);
    setStatus(`STOP ${cue.label}`);
    void stopPublicCue(cue);
  }

  async function triggerPublicCue(cue) {
    try {
      const { response, data } = await postSceneCue(controllerId, "play", cue);

      if (!response.ok) {
        setStatus(data.error || "PUBLIC CUE ERROR");
      }
    } catch {
      setStatus("PUBLIC CUE ERROR");
    }
  }

  async function stopPublicCue(cue) {
    try {
      const { response, data } = await postSceneCue(controllerId, "stop", cue);

      if (!response.ok) {
        setStatus(data.error || "PUBLIC STOP ERROR");
      }
    } catch {
      setStatus("PUBLIC STOP ERROR");
    }
  }

  function setStoredEditorWidth(nextWidth) {
    setEditorWidth(nextWidth);
    window.localStorage.setItem(editorWidthStorageKey(controllerId), `${Math.round(nextWidth)}`);
  }

  function beginEditorResize(event) {
    const screenRect = screenRef.current?.getBoundingClientRect();

    if (!screenRect) {
      return;
    }

    event.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onPointerMove(pointerEvent) {
      const nextWidth = clamp(
        screenRect.right - pointerEvent.clientX,
        MIN_EDITOR_WIDTH,
        Math.max(MIN_EDITOR_WIDTH, screenRect.width - MIN_PREVIEW_WIDTH)
      );

      setStoredEditorWidth(nextWidth);
    }

    function onPointerUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  function resizeEditorByKeyboard(event) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }

    const screenRect = screenRef.current?.getBoundingClientRect();

    if (!screenRect) {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? 1 : -1;
    const nextWidth = clamp(
      editorWidth + (direction * 24),
      MIN_EDITOR_WIDTH,
      Math.max(MIN_EDITOR_WIDTH, screenRect.width - MIN_PREVIEW_WIDTH)
    );

    setStoredEditorWidth(nextWidth);
  }

  async function saveDefault() {
    if (!config || saving) {
      return;
    }

    setSaving(true);
    setStatus("SAVING...");

    try {
      const { response, data } = await saveCueConfig(controllerId, config);

      if (!response.ok) {
        setStatus(data.error || "SAVE ERROR");
        return;
      }

      setConfig(data.config);
      setAssets(data.assets || assets);
      setColors(data.colors || colors);
      setStatus("PADRÃO SALVO");
    } catch {
      setStatus("SAVE ERROR");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.set("id", controllerId);
    formData.set("file", file);
    setStatus("UPLOAD...");

    try {
      const response = await fetch("/api/controller-cues", {
        method: "POST",
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "UPLOAD ERROR");
        return;
      }

      setAssets(data.assets || assets);
      if (selectedCue) {
        updateCue(selectedCue.id, { assetPath: data.asset.path });
      }
      setStatus("ARQUIVO ADICIONADO");
    } catch {
      setStatus("UPLOAD ERROR");
    } finally {
      event.target.value = "";
    }
  }

  if (!config) {
    return (
      <main className={styles.screen}>
        <p className={styles.loading}>{status}</p>
      </main>
    );
  }

  return (
    <main
      className={styles.screen}
      ref={screenRef}
      style={{ "--cue-editor-width": `${editorWidth}px` }}
    >
      <section className={styles.preview}>
        <header className={styles.header}>
          <div>
            <span>CONTROLLER EDITÁVEL</span>
            <h1>{config.title}</h1>
            <p>{config.description}</p>
          </div>
          <strong>{status}</strong>
        </header>

        <div className={styles.stage}>
          {preview?.type === "video" && preview.src ? (
            <video key={preview.sequence} autoPlay className={styles.media} src={preview.src} />
          ) : null}
          {preview?.type === "image" && preview.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className={styles.media} src={preview.src} />
          ) : null}
          {preview?.type === "audio" ? (
            <div className={styles.audioPreview}>
              <span style={{ color: preview.color }}>{preview.label}</span>
              <small>{preview.assetPath || "SEM ARQUIVO"}</small>
            </div>
          ) : null}
          {!preview ? <p>Selecione ou dispare um botão.</p> : null}
        </div>

        <section className={styles.cueGrid} aria-label="Botões de sample">
          {cues.map((cue) => (
            <div className={styles.cueItem} key={cue.id} style={{ "--cue-color": cue.color }}>
              <button
                className={cue.id === selectedCue?.id ? styles.selectedCue : styles.cue}
                onClick={() => triggerCue(cue)}
                type="button"
              >
                <span>{cue.shortcut || "-"}</span>
                <strong>{cue.label}</strong>
              </button>
              <button
                aria-label={`Parar ${cue.label}`}
                className={styles.cueStop}
                onClick={() => stopCue(cue)}
                type="button"
              >
                STOP
              </button>
            </div>
          ))}
        </section>
      </section>

      <div
        aria-label="Redimensionar palco e editor de samples"
        aria-orientation="vertical"
        className={styles.editorResizeHandle}
        onKeyDown={resizeEditorByKeyboard}
        onPointerDown={beginEditorResize}
        role="separator"
        tabIndex={0}
      />

      <aside className={styles.editor}>
        <div className={styles.editorActions}>
          <button onClick={addCue} type="button">NOVO BOTÃO</button>
          <button disabled={!selectedCue} onClick={duplicateCue} type="button">DUPLICAR</button>
          <button disabled={!selectedCue || cues.length <= 1} onClick={removeCue} type="button">REMOVER</button>
          <button className={styles.saveButton} disabled={saving} onClick={saveDefault} type="button">SALVAR PADRÃO</button>
        </div>

        {selectedCue ? (
          <section className={styles.form}>
            <label>
              <span>Nome do botão</span>
              <input value={selectedCue.label} onChange={(event) => updateCue(selectedCue.id, { label: event.target.value })} />
            </label>
            <label>
              <span>Atalho</span>
              <input value={selectedCue.shortcut} onChange={(event) => updateCue(selectedCue.id, { shortcut: event.target.value })} />
            </label>
            <label>
              <span>Tipo</span>
              <select value={selectedCue.type} onChange={(event) => updateCue(selectedCue.id, { type: event.target.value, assetPath: "" })}>
                {allowedTypes.map((type) => <option key={type} value={type}>{type.toUpperCase()}</option>)}
              </select>
            </label>
            <label>
              <span>Material</span>
              <select value={selectedCue.assetPath} onChange={(event) => updateCue(selectedCue.id, { assetPath: event.target.value })}>
                <option value="">SEM MATERIAL</option>
                {(availableAssets[selectedCue.type] || []).map((asset) => (
                  <option key={asset.path} value={asset.path}>{asset.path}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Duração em ms</span>
              <input
                min="0"
                onChange={(event) => updateCue(selectedCue.id, { durationMs: Number(event.target.value) })}
                step="100"
                type="number"
                value={selectedCue.durationMs}
              />
            </label>
            <label>
              <span>Cor</span>
              <input value={selectedCue.color} onChange={(event) => updateCue(selectedCue.id, { color: event.target.value })} type="color" />
            </label>
            <div className={styles.swatches}>
              {colors.map((color) => (
                <button
                  aria-label={`Cor ${color}`}
                  key={color}
                  onClick={() => updateCue(selectedCue.id, { color })}
                  style={{ background: color }}
                  type="button"
                />
              ))}
            </div>
            <label className={styles.upload}>
              <span>Adicionar arquivo</span>
              <input onChange={uploadAsset} type="file" />
            </label>
          </section>
        ) : null}
      </aside>
    </main>
  );
}
