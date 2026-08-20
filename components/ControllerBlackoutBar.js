"use client";

import { useEffect, useMemo, useState } from "react";
import { DISPLAY_BLACKOUT_TARGETS } from "@/lib/displayBlackout";
import styles from "./ControllerBlackoutBar.module.css";

const TARGETS = Object.values(DISPLAY_BLACKOUT_TARGETS);
const INITIAL_TARGETS = Object.fromEntries(TARGETS.map((target) => [target.id, false]));

async function postBlackout(target, enabled) {
  const response = await fetch("/api/operator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: `/blackout ${target} ${enabled ? "on" : "off"}` })
  });
  const data = await response.json();
  return { response, data };
}

export default function ControllerBlackoutBar() {
  const [targets, setTargets] = useState(INITIAL_TARGETS);
  const [pendingTarget, setPendingTarget] = useState("");
  const [status, setStatus] = useState("BLACKOUT READY");

  useEffect(() => {
    fetch("/api/state")
      .then((response) => response.json())
      .then((data) => setTargets(data.displayBlackout?.targets || INITIAL_TARGETS))
      .catch(() => setStatus("BLACKOUT DISCONNECTED"));

    const events = new EventSource("/api/events?client=controller-blackout");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const nextTargets = payload.state?.displayBlackout?.targets || payload.displayBlackout?.targets;

      if (nextTargets) {
        setTargets(nextTargets);
      }
    };
    events.onerror = () => setStatus("BLACKOUT DISCONNECTED");
    events.onopen = () => setStatus("BLACKOUT READY");

    return () => events.close();
  }, []);

  const anyActive = useMemo(() => Object.values(targets || {}).some(Boolean), [targets]);
  const allActive = useMemo(() => TARGETS.every((target) => targets?.[target.id]), [targets]);

  async function toggleTarget(target) {
    if (pendingTarget) {
      return;
    }

    const nextEnabled = !targets?.[target];
    setPendingTarget(target);
    setStatus(`BLACKOUT ${target.toUpperCase()}...`);

    try {
      const { response, data } = await postBlackout(target, nextEnabled);

      if (!response.ok) {
        setStatus(data.error || "BLACKOUT ERROR");
        return;
      }

      setStatus(data.message || "BLACKOUT UPDATED");
    } catch {
      setStatus("BLACKOUT ERROR");
    } finally {
      setPendingTarget("");
    }
  }

  async function toggleAll() {
    if (pendingTarget) {
      return;
    }

    setPendingTarget("todos");
    setStatus("BLACKOUT TODOS...");

    try {
      const { response, data } = await postBlackout("todos", !allActive);

      if (!response.ok) {
        setStatus(data.error || "BLACKOUT ERROR");
        return;
      }

      setStatus(data.message || "BLACKOUT UPDATED");
    } catch {
      setStatus("BLACKOUT ERROR");
    } finally {
      setPendingTarget("");
    }
  }

  return (
    <div className={styles.bar} aria-label="Blackout das telas publicas">
      <span className={styles.label}>{status}</span>
      <div className={styles.buttons}>
        {TARGETS.map((target) => {
          const active = Boolean(targets?.[target.id]);

          return (
            <button
              className={active ? styles.activeButton : styles.button}
              disabled={Boolean(pendingTarget)}
              key={target.id}
              onClick={() => toggleTarget(target.id)}
              type="button"
            >
              {target.label}
            </button>
          );
        })}
        <button
          className={anyActive ? styles.allActiveButton : styles.button}
          disabled={Boolean(pendingTarget)}
          onClick={toggleAll}
          type="button"
        >
          TODOS
        </button>
      </div>
    </div>
  );
}
