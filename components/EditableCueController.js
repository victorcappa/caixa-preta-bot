"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./EditableCueController.module.css";

const EMPTY_ASSETS = { audio: [], video: [], image: [] };

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

export default function EditableCueController({ controllerId }) {
  const [config, setConfig] = useState(null);
  const [assets, setAssets] = useState(EMPTY_ASSETS);
  const [colors, setColors] = useState(["#00ff66"]);
  const [selectedCueId, setSelectedCueId] = useState("");
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("CONNECTING");
  const [saving, setSaving] = useState(false);
  const audioRef = useRef(null);
  const clearPreviewRef = useRef(null);

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
      triggerCue(cue);
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
    <main className={styles.screen}>
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
            <button
              className={cue.id === selectedCue?.id ? styles.selectedCue : styles.cue}
              key={cue.id}
              onClick={() => triggerCue(cue)}
              style={{ "--cue-color": cue.color }}
              type="button"
            >
              <span>{cue.shortcut || "-"}</span>
              <strong>{cue.label}</strong>
            </button>
          ))}
        </section>
      </section>

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
