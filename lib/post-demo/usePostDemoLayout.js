"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizePostDemoLayout, patchPostDemoLayout } from "./layout.js";

// Layout patches share the existing post-demo config endpoint and preference writer.
// Keep pending gestures over SSE snapshots until the server acknowledges them.
export function usePostDemoLayout(layout, sessionId, controller) {
  const [value, setValue] = useState(() => normalizePostDemoLayout(layout)), [error, setError] = useState("");
  const queue = useMemo(() => ({ sessionId, controller, pending: {}, flight: null, timer: null, mounted: true, saving: null }), [sessionId, controller]);
  const flush = useCallback(async function flush() {
    clearTimeout(queue.timer); queue.timer = null;
    if (queue.flight) return queue.saving;
    if (!controller || !sessionId || !Object.keys(queue.pending).length) return { ok: true };
    const patch = queue.pending; queue.pending = {}; queue.flight = patch;
    let finish;
    queue.saving = new Promise(resolve => { finish = resolve; });
    let succeeded = false;
    try {
      const response = await fetch("/api/post-demo", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "config", config: { layout: patch }, sessionId }), keepalive: true, signal: AbortSignal.timeout(10000) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Não foi possível salvar a composição.");
      succeeded = true; if (queue.mounted) setError("");
    } catch (failure) {
      queue.pending = { ...patch, ...queue.pending };
      if (queue.mounted) setError(failure.message || "Composição não salva.");
    } finally { queue.flight = null; }
    const next = succeeded && Object.keys(queue.pending).length ? await flush() : null;
    const result = { ok: succeeded && next?.ok !== false }; finish(result); return result;
  }, [controller, sessionId, queue]);
  useEffect(() => {
    setValue(patchPostDemoLayout(layout, { ...queue.flight, ...queue.pending }));
  }, [layout, queue]);
  useEffect(() => {
    queue.mounted = true; setError("");
    return () => { queue.mounted = false; clearTimeout(queue.timer); void flush(); };
  }, [flush, queue]);
  function change(patch) {
    setValue(current => patchPostDemoLayout(current, patch));
    queue.pending = { ...queue.pending, ...patch }; setError("");
    if (!queue.timer) queue.timer = setTimeout(() => { queue.timer = null; void flush(); }, 150);
  }
  return { value, error, change, flush, reset: () => { change({ card: null, text: null, cloud: null }); void flush(); } };
}
