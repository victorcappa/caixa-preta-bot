"use client";

import { useEffect, useState } from "react";
import DisplayBlackout from "@/components/DisplayBlackout";
import styles from "./TecnologiaFlorestaDisplay.module.css";

export default function TecnologiaFlorestaDisplay() {
  const [displayBlackout, setDisplayBlackout] = useState(null);

  useEffect(() => {
    fetch("/api/state")
      .then((response) => response.json())
      .then((data) => setDisplayBlackout(data.displayBlackout || null))
      .catch(() => {});

    const events = new EventSource("/api/events?client=tecnologia-floresta-display");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setDisplayBlackout(payload.state?.displayBlackout || payload.displayBlackout || null);
    };

    return () => events.close();
  }, []);

  return (
    <main className={styles.display} aria-label="Tecnologia e Floresta">
      <DisplayBlackout blackout={displayBlackout} target="tecnologia" />
    </main>
  );
}
