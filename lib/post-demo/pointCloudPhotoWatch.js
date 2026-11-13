const BLOCKED_REASONS = new Set(["stop-all", "interrupted", "recovery", "reset"]);
const timestamp = value => typeof value === "number" ? value : Date.parse(value || "");
const changedAt = photo => Math.max(Number(photo.modifiedAt) || 0, Number(photo.changedAt) || 0);
const fingerprint = photo => JSON.stringify([photo.name, photo.modifiedAt, photo.changedAt, photo.size, photo.inode]);

// Runtime only: never persist timers or file fingerprints in the show snapshot.
export function createPointCloudPhotoWatch({ getState, selectPhoto, start, now = Date.now,
  schedule = setTimeout, unschedule = clearTimeout, pollMs = 1500, settleMs = 1000 }) {
  let active = null, timer = null, memory = null;
  const state = () => { try { return getState(); } catch { return null; } };
  const blocked = value => Boolean(value?.emergency || BLOCKED_REASONS.has(value?.postDemo?.pauseReason));
  function deactivate(suppress = false) {
    if (timer !== null) unschedule(timer);
    timer = null;
    if (suppress && memory) {
      memory.suppressedThrough = Math.max(memory.suppressedThrough, now());
      if (active?.candidate) memory.handled = active.candidate.signature;
    }
    active = null;
  }
  function inspect(run) {
    if (active !== run) return null;
    const value = state();
    if (!value || value.sessionId !== run.sessionId || !value.postDemo?.startedAt) { deactivate(); return null; }
    if (blocked(value)) { deactivate(true); return null; }
    if (!value.hasPostDemoWindow) {
      if (run.sawWindow || now() - run.startedAt >= 5000) deactivate();
      return null;
    }
    run.sawWindow = true;
    return value;
  }
  function queue(run, delay = pollMs) {
    if (active !== run) return;
    timer = schedule(() => { timer = null; return poll(run); }, delay);
    timer?.unref?.();
  }
  async function poll(run) {
    try {
      if (!inspect(run)) return;
      let photo;
      try { photo = await selectPhoto(); }
      catch { run.candidate = null; return; } // Empty folders/transient I/O wait for the next poll.
      let value = inspect(run);
      if (!value || !photo?.name) return;
      const signature = fingerprint(photo), cloud = value.postDemo.pointCloud || {}, record = run.memory;
      // A new manual/initial generation may already have consumed this exact saved photo.
      if (cloud.startedAt && record.cloudJob !== cloud.startedAt && (cloud.sourceName || cloud.status !== "generating")) {
        record.cloudJob = cloud.startedAt;
        if (cloud.sourceName === photo.name && changedAt(photo) <= timestamp(cloud.startedAt)) {
          record.handled = signature; run.candidate = null; return;
        }
      }
      if (signature === record.handled || changedAt(photo) <= record.suppressedThrough) { run.candidate = null; return; }
      if (run.candidate?.signature !== signature) run.candidate = { signature, since: now() };
      if (now() - run.candidate.since < settleMs) return;
      value = inspect(run);
      if (!value || value.postDemo.pointCloud?.status === "generating") return;
      try {
        const result = start();
        if (result?.busy) return; // A concurrent manual request wins; retain the pending change.
        record.handled = signature; run.candidate = null;
        void result?.finished?.catch?.(() => {});
      } catch { record.handled = signature; run.candidate = null; } // Do not retry the same failed photo forever.
    } finally { queue(run); }
  }
  function startWatching() {
    const value = state();
    if (!value?.sessionId) { deactivate(); return false; }
    if (memory?.sessionId !== value.sessionId) {
      deactivate();
      memory = { sessionId: value.sessionId, handled: null, cloudJob: null, suppressedThrough: -Infinity };
    }
    if (blocked(value)) { deactivate(true); return false; }
    if (!value.postDemo?.startedAt) { deactivate(); return false; }
    if (active?.sessionId === value.sessionId) return true;
    active = { sessionId: value.sessionId, memory, startedAt: now(), sawWindow: false, candidate: null };
    queue(active, 0);
    return true;
  }
  return { startWatching, stop: () => deactivate(true) };
}
