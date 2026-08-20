"use client";

import { useEffect, useState } from "react";
import styles from "./ForcaGShaderControls.module.css";

const INITIAL_SHADERS = {
  tunnel: false,
  redout: false,
  distortion: false,
  intensity: 55
};

async function updateShader(shaderAction, payload = {}) {
  const response = await fetch("/api/controller-cues/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      controllerId: "forca-g-shaders",
      action: "shader",
      shaderAction,
      payload
    })
  });
  const data = await response.json();
  return { response, data };
}

export default function ForcaGShaderControls() {
  const [shaders, setShaders] = useState(INITIAL_SHADERS);
  const [status, setStatus] = useState("SHADERS READY");

  useEffect(() => {
    fetch("/api/state")
      .then((response) => response.json())
      .then((data) => setShaders(data.forcaGShaders || INITIAL_SHADERS))
      .catch(() => setStatus("SHADERS DISCONNECTED"));

    const events = new EventSource("/api/events?client=forca-g-shaders-controller");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const nextShaders = payload.state?.forcaGShaders || payload.forcaGShaders;

      if (nextShaders) {
        setShaders(nextShaders);
      }
    };

    return () => events.close();
  }, []);

  async function apply(shaderAction, payload = {}) {
    setStatus("SHADERS...");

    try {
      const { response, data } = await updateShader(shaderAction, payload);

      if (!response.ok) {
        setStatus(data.error || "SHADER ERROR");
        return;
      }

      setShaders(data.state || INITIAL_SHADERS);
      setStatus("SHADERS READY");
    } catch {
      setStatus("SHADER ERROR");
    }
  }

  return (
    <section className={styles.controls} aria-label="Shaders sobre vídeo">
      <div className={styles.buttons}>
        {[
          ["tunnel", "TÚNEL"],
          ["redout", "REDOUT"],
          ["distortion", "DEFORMAR"]
        ].map(([id, label]) => (
          <button
            className={shaders[id] ? styles.active : styles.button}
            key={id}
            onClick={() => apply(id)}
            type="button"
          >
            {label}
          </button>
        ))}
        <button className={styles.clear} onClick={() => apply("clear")} type="button">LIMPAR</button>
      </div>
      <label className={styles.intensity}>
        <span>INTENSIDADE {shaders.intensity}</span>
        <input
          max="100"
          min="0"
          onChange={(event) => apply("intensity", { intensity: event.target.value })}
          step="1"
          type="range"
          value={shaders.intensity}
        />
      </label>
      <small>{status}</small>
    </section>
  );
}
