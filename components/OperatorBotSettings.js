"use client";

import { useEffect, useState } from "react";
import { subscribePublicRealtime } from "@/lib/publicRealtime";
import PublicOperatorControls from "./PublicOperatorControls";
import RobotSoundControls from "./RobotSoundControls";
import Terminal from "./Terminal";
import Link from "next/link";
import styles from "./OperatorBotSettings.module.css";

export default function OperatorBotSettings() {
  const [state, setState] = useState({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribePublicRealtime(({ state }) => {
    setState(state);
  }), []);

  async function changeModel(model) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/operator", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: `/model ${model}` }), signal: AbortSignal.timeout(20000)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível alterar o modelo.");
    } catch {
      setError("Não foi possível alterar o modelo. Tente novamente.");
    } finally { setPending(false); }
  }

  const models = state.context?.modelOptions || ["gpt-5-mini", "gpt-5-nano"];
  return (
    <Terminal title="OPERATOR">
      <div className={styles.settings} aria-label="Parâmetros ajustáveis do bot">
        <RobotSoundControls settings={state.robotSound} typingOnly />
        <PublicOperatorControls parametersOnly />
        <section className={styles.model}><Link href="/treinamento/controle">TREINAMENTO · ABRIR CONTROLE DO TARÔ →</Link></section>
        <section className={styles.model} aria-label="Modelo do bot">
          <label htmlFor="bot-model">MODELO DO BOT</label>
          <select id="bot-model" aria-label="Modelo GPT" value={state.model || "gpt-5-mini"}
            disabled={pending || !state.model} onChange={(event) => void changeModel(event.target.value)}>
            {models.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
        </section>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </Terminal>
  );
}
