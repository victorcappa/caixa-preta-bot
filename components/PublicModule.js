"use client";

import { useEffect, useState } from 'react';
import { subscribePublicRealtime } from '@/lib/publicRealtime';
import { normalizePublicComposition, publicModuleStyle, publicTextScale } from '@/lib/publicComposition';
import styles from './PublicComposition.module.css';

export default function PublicModule({ id, as: Tag = 'div', className = '', style, children, disabled = false, ...props }) {
  const [composition, setComposition] = useState(() => normalizePublicComposition());
  useEffect(() => disabled ? undefined : subscribePublicRealtime(({ state }) => {
    if (state.operatorPublic) setComposition(normalizePublicComposition(state.operatorPublic.composition));
  }), [disabled]);
  const rect = disabled ? null : composition.modules[id];
  return <Tag {...props} data-public-module={disabled ? undefined : id} data-module-custom={Boolean(rect)}
    className={`${className} ${rect ? styles.module : ''}`} style={{ ...style, ...publicModuleStyle(rect),
      ...(!disabled ? { '--public-text-scale': publicTextScale(composition, id) } : {}) }}>{children}</Tag>;
}
