"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { subscribePublicRealtime } from "@/lib/publicRealtime";
import PublicModule from "./PublicModule";
import PublicOperatorControls from "./PublicOperatorControls";
import styles from "./PublicOperator.module.css";
import { normalizePublicComposition } from "@/lib/publicComposition";
import ProjectionMenu from "./ProjectionMenu";

export default function PublicOperatorLayout({ children }) {
  const pathname = usePathname();
  const [composition, setComposition] = useState(() => normalizePublicComposition());
  const [visible, setVisible] = useState(false);
  useEffect(() => subscribePublicRealtime(({ state }) => {
    if (state.operatorPublic) { setVisible(Boolean(state.operatorPublic.visible)); setComposition(normalizePublicComposition(state.operatorPublic.composition)); }
  }), []);
  const r = composition.readability;
  return (
    <div className={styles.layout} data-operator-visible={visible} data-projection-readability={r.enabled} data-projection-font={r.font} data-projection-reflow={pathname === '/' || pathname === '/treinamento'}
      data-projection-no-glow={r.enabled && r.noGlow} style={{
        '--projection-font': r.font === 'sans' ? 'Arial, Helvetica, sans-serif' : '"Courier New", monospace',
        '--projection-weight': r.weight,
        ...(r.enabled ? { '--projection-ink': composition.textColor, '--projection-leading': r.lineHeight } : {})
      }}>
      <div className={styles.original} data-projection-original>{children}</div>
      <PublicModule as="aside" id="operator-rail" className={styles.rail} style={{ "--public-operator-color": composition.textColor }} aria-hidden={!visible} inert={!visible}>
        <PublicOperatorControls publicSurface />
      </PublicModule>
      <ProjectionMenu />
    </div>
  );
}
