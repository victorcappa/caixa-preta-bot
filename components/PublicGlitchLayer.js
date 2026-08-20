"use client";

import { useEffect, useState } from "react";
import GlitchOverlay from "./GlitchOverlay";
import { subscribePublicRealtime } from "@/lib/publicRealtime";

export default function PublicGlitchLayer({ children }) {
  const [glitch, setGlitch] = useState(null);

  useEffect(() => {
    return subscribePublicRealtime((payload) => {
      if (payload.state?.glitch) {
        setGlitch(payload.state.glitch);
      }
    });
  }, []);

  return <GlitchOverlay glitch={glitch}>{children}</GlitchOverlay>;
}
