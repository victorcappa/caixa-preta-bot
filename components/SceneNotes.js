"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SceneNotes.module.css";

const COLLAPSED_STORAGE_KEY = "caixa-preta.sceneNotesCollapsed";
const noteStorageKey = (sceneId) => `caixa-preta.sceneNote.${sceneId}`;

export default function SceneNotes({ scene }) {
  const [content, setContent] = useState("");
  const [loadedSceneId, setLoadedSceneId] = useState("");
  const [status, setStatus] = useState("CARREGANDO");
  const [collapsed, setCollapsed] = useState(false);
  const saveSequenceRef = useRef(0);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!scene?.id) return undefined;

    const controller = new AbortController();
    const localContent = window.localStorage.getItem(noteStorageKey(scene.id));
    setContent(localContent || "");
    setLoadedSceneId(scene.id);
    setStatus(localContent === null ? "CARREGANDO" : "SALVO LOCAL");

    fetch(`/api/scene-notes?sceneId=${encodeURIComponent(scene.id)}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error("LOAD ERROR");
        return response.json();
      })
      .then((data) => {
        if (window.localStorage.getItem(noteStorageKey(scene.id)) === null) {
          const serverContent = data.content || "";
          setContent(serverContent);
          window.localStorage.setItem(noteStorageKey(scene.id), serverContent);
        }
        setStatus("SALVO");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("SALVO LOCAL");
      });

    return () => controller.abort();
  }, [scene?.id]);

  useEffect(() => {
    if (!scene?.id || loadedSceneId !== scene.id) return undefined;

    const sequence = ++saveSequenceRef.current;
    setStatus("DIGITANDO...");
    const timer = window.setTimeout(async () => {
      setStatus("SALVANDO...");

      try {
        const response = await fetch("/api/scene-notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneId: scene.id, content })
        });

        if (!response.ok) throw new Error("SAVE ERROR");
        if (saveSequenceRef.current === sequence) setStatus("SALVO");
      } catch {
        if (saveSequenceRef.current === sequence) setStatus("ERRO AO SALVAR");
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [content, loadedSceneId, scene?.id]);

  function updateContent(nextContent) {
    setContent(nextContent);
    window.localStorage.setItem(noteStorageKey(scene.id), nextContent);
    setStatus("SALVO LOCAL");
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, `${next}`);
  }

  return (
    <aside className={`${styles.notes} ${collapsed ? styles.collapsed : ""}`} aria-label={`Anotações de ${scene.sceneNumber}`}>
      <header className={styles.header}>
        <button aria-expanded={!collapsed} onClick={toggleCollapsed} type="button">
          <span>{scene.sceneNumber} — ANOTAÇÕES</span>
          <small>{status}</small>
          <strong>{collapsed ? "ABRIR" : "MINIMIZAR"}</strong>
        </button>
      </header>
      {!collapsed ? (
        <textarea
          aria-label={`Bloquinho de anotações de ${scene.sceneNumber}`}
          disabled={loadedSceneId !== scene.id}
          maxLength={20000}
          onChange={(event) => updateContent(event.target.value)}
          placeholder="Escreva aqui lembretes, entradas, falas, tempos e próximos passos..."
          spellCheck="true"
          value={content}
        />
      ) : null}
    </aside>
  );
}
