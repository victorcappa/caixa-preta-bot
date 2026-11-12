import { randomUUID } from "node:crypto";
export const POINT_CLOUD_CONTROLLER_VERSION = 1;
export function createPointCloudState() { return { status: "idle", progress: 0, phase: null, error: null, sourceName: null, current: null, jobId: null, startedAt: null }; }
export function restoredPointCloudState(value) { return { ...createPointCloudState(), current: value?.current || null, status: value?.current ? "ready" : "idle" }; }
export function publicPointCloud(value, sessionId) {
  const current = value?.current;
  return current && sessionId && current.sessionId === sessionId ? { id: current.id, url: `/api/post-demo/point-cloud/${current.id}?sessionId=${encodeURIComponent(sessionId)}` } : null;
}
const messages = { NO_AUDIENCE_PHOTO: "Nenhuma foto JPG, JPEG ou PNG em assets/publico/.", UNREADABLE_IMAGE: "A foto mais recente não pode ser lida. Substitua essa foto e tente novamente.",
  POINT_CLOUD_NOT_PREPARED: "Prepare o conversor local antes do espetáculo: npm run point-cloud:prepare.", POINT_CLOUD_TIMEOUT: "A conversão excedeu o tempo limite. Tente novamente." };
export function createPointCloudController({ get, sessionId, emit, selectPhoto, convert, discard = async () => {}, now = Date.now }) {
  let job = null;
  const publish = () => emit({ type: "post-demo:point-cloud" });
  const current = () => { const post = get(); post.pointCloud ||= createPointCloudState(); return post.pointCloud; };
  function cancel() {
    const previous = job; job = null; previous?.controller.abort();
    if (!previous) return;
    const state = current(); state.jobId = null; state.status = state.current ? "ready" : "idle"; state.progress = state.current ? 100 : 0; state.error = null; state.phase = null;
  }
  function start() {
    if (job && job.sessionId !== sessionId()) { job.controller.abort(); job = null; }
    if (job) return { busy: true };
    const state = current();
    const active = { id: randomUUID(), sessionId: sessionId(), controller: new AbortController() }; job = active;
    Object.assign(state, { status: "generating", progress: 5, phase: "selecting", error: null, sourceName: null, jobId: active.id, startedAt: new Date(now()).toISOString() }); publish();
    const valid = () => job === active && sessionId() === active.sessionId && !active.controller.signal.aborted;
    active.finished = (async () => {
      try {
        const photo = await selectPhoto(); if (!valid()) return;
        state.sourceName = photo.name; state.progress = 10; publish();
        const result = await convert({ sessionId: active.sessionId, id: active.id, photo, signal: active.controller.signal,
          onProgress: (progress, phase) => { if (valid()) { state.progress = progress; state.phase = phase; publish(); } } });
        if (!valid()) { await discard(active.sessionId, active.id); return; }
        const previous = state.current;
        state.current = { id: active.id, sessionId: active.sessionId, pointCount: result.pointCount, createdAt: new Date(now()).toISOString(), durationMs: now() - Date.parse(state.startedAt) };
        Object.assign(state, { status: "ready", progress: 100, phase: "ready", jobId: null, error: null }); job = null; publish();
        if (previous) void discard(previous.sessionId, previous.id).catch(() => {});
      } catch (error) {
        if (!valid()) return;
        Object.assign(state, { status: "failed", jobId: null, phase: null, error: messages[error.message] || "Não foi possível converter a foto. A nuvem anterior foi mantida." }); job = null; publish();
      }
    })();
    return { started: true, finished: active.finished };
  }
  return { version: POINT_CLOUD_CONTROLLER_VERSION, start, cancel };
}
