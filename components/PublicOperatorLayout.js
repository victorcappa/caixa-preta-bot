"use client";

import { useEffect, useState } from "react";
import { subscribePublicRealtime } from "@/lib/publicRealtime";
import PublicModule from "./PublicModule";
import PublicOperatorControls from "./PublicOperatorControls";
import styles from "./PublicOperator.module.css";

export default function PublicOperatorLayout({ children }) {
  const [color, setColor] = useState("#00ff66");
  const [visible, setVisible] = useState(false);
  useEffect(() => subscribePublicRealtime(({ state }) => {
    if (state.operatorPublic) { setVisible(Boolean(state.operatorPublic.visible)); setColor(state.operatorPublic.composition?.textColor || "#00ff66"); }
  }), []);
  return (
    <div className={styles.layout} data-operator-visible={visible}>
      <div className={styles.original} data-projection-original>{children}</div>
      <PublicModule as="aside" id="operator-rail" className={styles.rail} style={{ "--public-operator-color": color }} aria-hidden={!visible} inert={!visible}>
        <PublicOperatorControls publicSurface />
      </PublicModule>
    </div>
  );
}
