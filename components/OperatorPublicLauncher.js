"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { subscribePublicRealtime } from "@/lib/publicRealtime";
import PublicOperatorControls from "./PublicOperatorControls";
import styles from "./PublicOperator.module.css";

export default function OperatorPublicLauncher() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => subscribePublicRealtime(({ state }) => setVisible(Boolean(state.operatorPublic?.visible))), []);
  async function toggle() {
    setError("");
    try {
      const response = await fetch("/api/operator-public", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "patch", visible: !visible }), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("SYNC_FAILED");
      if (!visible) setOpen(true);
    } catch { setError("Não sincronizou. Tente novamente."); }
  }
  return (
    <div className={styles.launcher}>
      <button type="button" aria-pressed={visible} onClick={() => void toggle()}>{visible ? "OCULTAR OPERATOR" : "REVELAR OPERATOR"}</button>
      {visible ? <button type="button" onClick={() => setOpen(true)}>ABRIR CONVERSA</button> : null}
      {error ? <small role="alert">{error}</small> : null}
      {open ? createPortal(<PublicOperatorControls initialExpanded onClose={() => setOpen(false)} />, document.body) : null}
    </div>
  );
}
