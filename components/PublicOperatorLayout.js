"use client";

import { useEffect, useState } from "react";
import { subscribePublicRealtime } from "@/lib/publicRealtime";
import PublicOperatorControls from "./PublicOperatorControls";
import styles from "./PublicOperator.module.css";

export default function PublicOperatorLayout({ children }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => subscribePublicRealtime(({ state }) => {
    if (state.operatorPublic) setVisible(Boolean(state.operatorPublic.visible));
  }), []);
  return (
    <div className={styles.layout} data-operator-visible={visible}>
      <div className={styles.original} data-projection-original>{children}</div>
      <aside className={styles.rail} aria-hidden={!visible} inert={!visible}>
        <PublicOperatorControls publicSurface />
      </aside>
    </div>
  );
}
