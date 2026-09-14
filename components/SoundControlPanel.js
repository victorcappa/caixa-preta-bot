"use client";

import { useEffect, useState } from "react";
import { ROBOT_SOUND_DEFAULTS } from "@/lib/robot-sound/state";
import RobotSoundControls from "./RobotSoundControls";
import styles from "./SoundControlPanel.module.css";

export default function SoundControlPanel() {
  const [settings, setSettings] = useState(ROBOT_SOUND_DEFAULTS);
  const [connection, setConnection] = useState("CONNECTING");
  const [notice, setNotice] = useState("USE TEST DIGITAÇÃO PARA OUVIR O TIMBRE ATUAL.");

  useEffect(() => {
    fetch("/api/robot-sound", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setSettings(data.robotSound || ROBOT_SOUND_DEFAULTS))
      .catch(() => setConnection("OFFLINE"));

    const events = new EventSource("/api/events?client=sound-control");
    events.onopen = () => setConnection("CONNECTED");
    events.onerror = () => setConnection("DISCONNECTED");
    events.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.state?.robotSound) setSettings(payload.state.robotSound);
      } catch {
        setConnection("DISCONNECTED");
      }
    };

    return () => events.close();
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <small>CONTROLE PRIVADO</small>
          <h1>SOUND CONTROL</h1>
        </div>
        <strong data-status={connection}>{connection}</strong>
      </header>

      <p className={styles.intro}>
        Ajustes compartilhados: sensibilidade do microfone da Cena 0, frequência dos cliques, altura, velocidade, volume e estilo dos efeitos procedurais.
      </p>

      <RobotSoundControls
        onLog={(message) => setNotice(message)}
        relaySink
        settings={settings}
      />

      <output className={styles.notice}>{notice}</output>
    </main>
  );
}
