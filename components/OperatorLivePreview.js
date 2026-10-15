"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PublicOperator.module.css";

export default function OperatorLivePreview({ state }) {
  const video = useRef(null);
  const stream = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => stream.current?.getTracks().forEach((track) => track.stop()), []);
  function stop() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setActive(false);
  }
  async function start() {
    setError("");
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false,
        preferCurrentTab: false, selfBrowserSurface: "exclude" });
      stream.current = media;
      video.current.srcObject = media;
      media.getVideoTracks()[0].addEventListener("ended", stop, { once: true });
      await video.current.play();
      setActive(true);
    } catch {
      stop();
      setError("Selecione a aba de projeção para acompanhar a imagem ao vivo. Captura requer um navegador compatível e permissão do sistema.");
    }
  }
  return (
    <section className={styles.preview} aria-label="Monitor privado da projeção">
      <header><strong>{"PROJEÇÃO // MONITOR PRIVADO"}</strong><button type="button" onClick={active ? stop : start}>{active ? "DESCONECTAR MONITOR" : "CONECTAR PROJEÇÃO AO VIVO"}</button></header>
      <video ref={video} autoPlay muted playsInline hidden={!active} aria-label="Projeção ao vivo sem áudio duplicado" />
      {!active ? <p>Selecione a aba pública no seletor do navegador. O monitor acompanha a projeção real, incluindo vídeos e Instagram, sem executar uma segunda cena.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <dl><dt>CENA</dt><dd>{state.sceneZero?.stage || state.mode || "—"}</dd><dt>FALA PÚBLICA</dt><dd>{state.publicMessage?.content || "—"}</dd><dt>ATIVIDADE EXTERNA</dt><dd>{state.instagram?.status || "DISCONNECTED"}</dd></dl>
    </section>
  );
}
