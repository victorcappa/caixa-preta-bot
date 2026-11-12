import { randomUUID } from "node:crypto";
import { createPointCloudState, restoredPointCloudState, publicPointCloud } from "./post-demo/pointCloudState.js";
import { redactAudienceNames } from "./post-demo/privacy.js";
import { buildPostDemoOpening } from "./post-demo/opening.js";
import { normalizePostDemoConfig, patchPostDemoConfig, postDemoPresentation, POST_DEMO_SETTINGS_VERSION, POST_DEMO_RUNTIME_VERSION, POST_DEMO_CARD_LIMIT } from "./post-demo/settings.js";
export { normalizePostDemoConfig } from "./post-demo/settings.js";
export function createPostDemoState() {
  return { active: false, status: "idle", startedAt: null, completedAt: null, pauseReason: null, error: null,
    opening: null, autoCloudStartedAt: null, rounds: [], totalRounds: 0, pointCloud: createPointCloudState(), pointCloudView: { sequence: 0, startedAt: null }, usedCardIds: [], cycle: 1, nextAt: null, config: normalizePostDemoConfig() };
}
export function restoredPostDemoState(value) {
  const pointCloud = restoredPointCloudState(value?.pointCloud);
  // Existing presentations keep their current round/cloud when this entry sequence is introduced.
  const autoCloudStartedAt = value?.autoCloudStartedAt || value?.startedAt || null;
  if (!value?.startedAt) return { ...createPostDemoState(), pointCloud, config: normalizePostDemoConfig(value?.config) };
  if (value.status === "completed" && value.totalRounds >= POST_DEMO_CARD_LIMIT) return { ...createPostDemoState(), ...value,
    pointCloud, autoCloudStartedAt, active: false, nextAt: null, pauseReason: null, error: null, config: normalizePostDemoConfig(value.config) };
  return { ...createPostDemoState(), ...value, active: false, status: "paused", pauseReason: "recovery", nextAt: null, error: null,
    pointCloud, autoCloudStartedAt, config: normalizePostDemoConfig(value.config) };
}
export function postDemoSnapshot(value = createPostDemoState(), includePrivate = false, sessionId) {
  if (includePrivate) return { ...structuredClone(value), config: normalizePostDemoConfig(value.config) };
  const cloud = publicPointCloud(value.pointCloud, sessionId);
  const epochs = cloud ? [value.pointCloud.current.createdAt, value.startedAt, value.pointCloudView?.startedAt].map(date => Date.parse(date)).filter(Number.isFinite) : [];
  const startedAt = epochs.length ? new Date(Math.max(...epochs)).toISOString() : null;
  return { active: value.active, status: value.status, startedAt: value.startedAt, totalRounds: value.totalRounds,
    completedAt: value.completedAt, targetRounds: POST_DEMO_CARD_LIMIT,
    opening: value.opening ? { id: value.opening.id, content: redactAudienceNames(value.opening.content), createdAt: value.opening.createdAt, presentedAt: value.opening.presentedAt } : null,
    layout: normalizePostDemoConfig(value.config).layout,
    pointCloud: cloud, cloudPresentation: { settings: normalizePostDemoConfig(value.config).pointCloud,
      playback: { token: cloud ? `${cloud.id}:${startedAt}:${value.pointCloudView?.sequence || 0}` : "idle", startedAt } },
    nextAt: value.nextAt, presentation: postDemoPresentation(value.config),
    rounds: value.rounds.slice(-20).map(({ id, card, content, createdAt, presentedAt, usedNames }) => ({ id, card, content: redactAudienceNames(content, [...(value.audienceNames || []), ...(usedNames || [])]), createdAt, presentedAt })) };
}

// Timers and request controllers are ephemeral; presentation state belongs to showState.
export function createPostDemoController({ get, set, emit, runTurn, hasProjection = () => true, saveExample,
  openingText = () => buildPostDemoOpening(), startCloud = () => {},
  now = Date.now, schedule = setTimeout, unschedule = clearTimeout }) {
  let job = null, timer = null;
  const publish = () => emit({ type: "post-demo" });
  const clear = () => { if (timer !== null) unschedule(timer); timer = null; };
  function complete() {
    clear(); job?.controller.abort(); job = null;
    Object.assign(get(), { active: false, status: "completed", completedAt: new Date(now()).toISOString(), nextAt: null, pauseReason: null, error: null });
    publish();
  }
  const kick = () => { void runTurn().catch(() => { pause("generation-failed"); get().status = "failed"; get().error = "Não foi possível criar a próxima carta."; publish(); }); };
  function pause(reason = "operator") {
    clear(); job?.controller.abort(); job = null;
    const state = get();
    if (!state.startedAt || state.status === "completed") return;
    state.active = false; state.status = "paused"; state.nextAt = null; state.pauseReason = reason;
    publish();
  }
  function enter() {
    const state = get();
    if (state.startedAt) return { duplicate: true };
    state.startedAt = new Date(now()).toISOString();
    state.opening = { id: randomUUID(), content: openingText(), createdAt: state.startedAt, presentedAt: null };
    state.active = true; state.status = "opening"; state.pauseReason = null;
    const generateCloud = !state.autoCloudStartedAt;
    if (generateCloud) state.autoCloudStartedAt = state.startedAt;
    publish();
    if (generateCloud) {
      try { startCloud(); }
      catch {
        Object.assign(state.pointCloud, { status: "failed", error: "Não foi possível iniciar a nuvem. Use Gerar point cloud para tentar novamente." }); publish();
      }
    }
    return { ok: true };
  }
  function acknowledgeOpening(openingId) {
    const state = get();
    if (!state.active || state.status !== "opening" || !state.opening || state.opening.id !== openingId || state.opening.presentedAt) return false;
    state.opening.presentedAt = new Date(now()).toISOString(); state.status = "ready";
    publish(); kick(); return true;
  }
  function begin() {
    const state = get();
    if (!state.active || !["ready", "waiting"].includes(state.status) || job) return null;
    if (state.totalRounds >= POST_DEMO_CARD_LIMIT) { complete(); return null; }
    clear(); state.nextAt = null; state.status = "generating"; state.error = null;
    job = { id: randomUUID(), controller: new AbortController() }; publish(); return job;
  }
  function finish(activeJob, result) {
    if (!job || job !== activeJob || !get().active || activeJob.controller.signal.aborted) return false;
    const state = get();
    if (state.totalRounds >= POST_DEMO_CARD_LIMIT) { complete(); return false; }
    const round = { id: activeJob.id, ...result, createdAt: new Date(now()).toISOString(), presentedAt: null };
    state.rounds = [...state.rounds, round].slice(-120); state.totalRounds++;
    state.usedCardIds.push(result.card.id); state.status = "presenting"; job = null; publish(); return true;
  }
  function fail(activeJob, error) {
    if (!job || job !== activeJob) return false;
    job = null; clear(); const state = get();
    state.active = false; state.status = "failed"; state.nextAt = null; state.pauseReason = "generation-failed";
    state.error = error || "Não foi possível criar a próxima carta."; publish(); return true;
  }
  function hold() {
    clear(); const state = get(), round = state.rounds.at(-1);
    if (!state.active || !round?.presentedAt) return;
    state.status = "waiting";
    state.nextAt = Date.parse(round.presentedAt) + normalizePostDemoConfig(state.config).cardHoldMs;
    timer = schedule(() => {
      timer = null;
      if (!get().active || get().status !== "waiting") return;
      if (get().totalRounds >= POST_DEMO_CARD_LIMIT) { complete(); return; }
      if (!hasProjection()) { pause("projection-disconnected"); return; }
      kick();
    }, Math.max(0, state.nextAt - now()));
    timer?.unref?.(); publish();
  }
  function acknowledge(roundId) {
    const state = get(), round = state.rounds.at(-1);
    if (!state.active || state.status !== "presenting" || !round || round.id !== roundId || round.presentedAt) return false;
    round.presentedAt = new Date(now()).toISOString(); hold(); return true;
  }
  function resume() {
    const state = get();
    if (!state.startedAt || state.active || state.status === "completed") return false;
    state.active = true; state.pauseReason = null; state.error = null;
    if (state.opening && !state.opening.presentedAt && state.totalRounds === 0) { state.status = "opening"; publish(); }
    else if (state.rounds.at(-1) && !state.rounds.at(-1).presentedAt) { state.status = "presenting"; publish(); }
    else if (state.totalRounds >= POST_DEMO_CARD_LIMIT) hold();
    else { state.status = "ready"; publish(); kick(); }
    return true;
  }
  function config(patch) {
    const previousPreset = normalizePostDemoConfig(get().config).pointCloud.preset;
    get().config = patchPostDemoConfig(get().config, patch);
    if (get().config.pointCloud.preset !== previousPreset) replayCloud(false);
    if (get().status === "waiting") hold(); else publish();
  }
  function replayCloud(notify = true) {
    get().pointCloudView = { sequence: (get().pointCloudView?.sequence || 0) + 1, startedAt: new Date(now()).toISOString() };
    if (notify) publish();
    return true;
  }
  function restart() {
    const previousConfig = get().config, pointCloud = get().pointCloud, autoCloudStartedAt = get().autoCloudStartedAt || get().startedAt;
    pause(); set({ ...createPostDemoState(), pointCloud, autoCloudStartedAt, config: previousConfig }); return enter();
  }
  function rate(roundId, rating) {
    const round = get().rounds.find(round => round.id === roundId);
    if (!round || !["perfect", "almost", "bad"].includes(rating)) return false;
    const example = saveExample({ source: "post-demo", sourceMessageId: roundId, mode: "post-demo", rating,
      userMessage: `Continuação da peça / ${round.card.name}`, modelResponse: round.content, tags: ["pos-demo", "ilha-futura"] });
    round.rating = rating; round.exampleId = example.id; publish(); return true;
  }
  return { runtimeVersion: POST_DEMO_RUNTIME_VERSION, settingsVersion: POST_DEMO_SETTINGS_VERSION, enter, begin, finish, fail, pause, resume, acknowledge, acknowledgeOpening, config, restart, replayCloud, rate };
}
