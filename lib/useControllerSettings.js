"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeControllerSettings } from "./controllerSettingsSchema.js";
import { createSettingsSaveQueue } from "./settingsSaveQueue.js";

export function useControllerSettings(scope) {
  const [settings, setSettings] = useState(() => normalizeControllerSettings(scope)), [ready, setReady] = useState(false), [error, setError] = useState("");
  const mounted = useRef(false);
  const queue = useMemo(() => createSettingsSaveQueue({
    save: async patch => {
      const response = await fetch("/api/controller-settings", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, patch }), keepalive: true });
      const result = await response.json(); if (!response.ok) throw new Error(result.error); return result.settings;
    }, onStatus: (status, failure) => { if (mounted.current) setError(status === "error" ? failure.message : ""); }
  }), [scope]);
  useEffect(() => {
    mounted.current = true;
    fetch(`/api/controller-settings?scope=${encodeURIComponent(scope)}`, { cache: "no-store" })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data.settings; })
      .then(value => { if (mounted.current) { setSettings(value); setReady(true); } })
      .catch(failure => { if (mounted.current) setError(failure.message); });
    const flush = () => void queue.flush(); window.addEventListener("pagehide", flush);
    return () => { mounted.current = false; window.removeEventListener("pagehide", flush); flush(); };
  }, [scope, queue]);
  const change = useCallback(patch => { if (!ready) return; setSettings(value => normalizeControllerSettings(scope, { ...value, ...patch })); queue.enqueue(patch); }, [scope, ready, queue]);
  return { settings, ready, error, change };
}
