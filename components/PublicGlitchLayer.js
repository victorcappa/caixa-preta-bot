"use client";

import { useEffect, useState } from "react";
import GlitchOverlay from "./GlitchOverlay";

export default function PublicGlitchLayer({ children }) {
  const [glitch, setGlitch] = useState(null);

  useEffect(() => {
    fetch("/api/state")
      .then((response) => response.json())
      .then((data) => setGlitch(data.glitch || null))
      .catch(() => {});

    const events = new EventSource("/api/events?client=public-glitch");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      if (payload.state?.glitch) {
        setGlitch(payload.state.glitch);
      }
    };

    return () => events.close();
  }, []);

  return <GlitchOverlay glitch={glitch}>{children}</GlitchOverlay>;
}
