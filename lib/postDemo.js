import { randomUUID } from "node:crypto";

export function normalizePostDemoConfig(value = {}) {
  return { cardHoldMs: Number.isFinite(value.cardHoldMs) ? Math.max(1000, Math.min(60000, Math.round(value.cardHoldMs))) : 8000 };
}
export function createPostDemoState() {
  return { active: false, status: "idle", startedAt: null, pauseReason: null, error: null,
    rounds: [], totalRounds: 0, audienceNames: [], usedCardIds: [], cycle: 1, nextAt: null, config: normalizePostDemoConfig() };
}
export function restoredPostDemoState(value) {
  if (!value?.startedAt) return { ...createPostDemoState(), config: normalizePostDemoConfig(value?.config) };
  return { ...createPostDemoState(), ...value, active: false, status: "paused", pauseReason: "recovery", nextAt: null, error: null,
    config: normalizePostDemoConfig(value.config) };
}
export function postDemoSnapshot(value = createPostDemoState(), includePrivate = false) {
  if (includePrivate) return structuredClone(value);
  return { active: value.active, status: value.status, startedAt: value.startedAt, totalRounds: value.totalRounds,
    audienceNames: [...value.audienceNames], nextAt: value.nextAt, config: normalizePostDemoConfig(value.config),
    rounds: value.rounds.slice(-20).map(({ id, card, content, createdAt, presentedAt }) => ({ id, card, content, createdAt, presentedAt })) };
}

// Timers and request controllers are ephemeral; presentation state belongs to showState.
export function createPostDemoController({ get, set, emit, runTurn, hasProjection = () => true, saveExample,
  now = Date.now, schedule = setTimeout, unschedule = clearTimeout }) {
  let job = null, timer = null;
  const publish = () => emit({ type: "post-demo" });
  const clear = () => { if (timer !== null) unschedule(timer); timer = null; };
  const kick = () => { void runTurn().catch(() => { pause("generation-failed"); get().status = "failed"; get().error = "Não foi possível criar a próxima carta."; publish(); }); };
  function pause(reason = "operator") {
    clear(); job?.controller.abort(); job = null;
    const state = get();
    if (!state.startedAt) return;
    state.active = false; state.status = "paused"; state.nextAt = null; state.pauseReason = reason;
    publish();
  }
  function enter(audienceNames = []) {
    const state = get();
    if (state.startedAt) return { duplicate: true };
    state.startedAt = new Date(now()).toISOString(); state.audienceNames = [...audienceNames];
    state.active = true; state.status = "ready"; state.pauseReason = null;
    publish(); kick(); return { ok: true };
  }
  function begin() {
    const state = get();
    if (!state.active || !["ready", "waiting"].includes(state.status) || job) return null;
    clear(); state.nextAt = null; state.status = "generating"; state.error = null;
    job = { id: randomUUID(), controller: new AbortController() }; publish(); return job;
  }
  function finish(activeJob, result) {
    if (!job || job !== activeJob || !get().active || activeJob.controller.signal.aborted) return false;
    const state = get();
    const round = { id: activeJob.id, ...result, createdAt: new Date(now()).toISOString(), presentedAt: null };
    state.rounds = [...state.rounds, round].slice(-120); state.totalRounds++;
    if (Array.isArray(result.roster)) state.audienceNames = [...result.roster];
    if (result.cycleReset) { state.usedCardIds = []; state.cycle++; }
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
    if (!state.startedAt || state.active) return false;
    state.active = true; state.pauseReason = null; state.error = null;
    if (state.rounds.at(-1) && !state.rounds.at(-1).presentedAt) { state.status = "presenting"; publish(); }
    else { state.status = "ready"; publish(); kick(); }
    return true;
  }
  function config(patch) {
    get().config = normalizePostDemoConfig({ ...get().config, ...patch });
    if (get().status === "waiting") hold(); else publish();
  }
  function restart(audienceNames) {
    const previousConfig = get().config; pause(); set({ ...createPostDemoState(), config: previousConfig }); return enter(audienceNames);
  }
  function rate(roundId, rating) {
    const round = get().rounds.find(round => round.id === roundId);
    if (!round || !["perfect", "almost", "bad"].includes(rating)) return false;
    const example = saveExample({ source: "post-demo", sourceMessageId: roundId, mode: "post-demo", rating,
      userMessage: `Continuação da peça / ${round.card.name}`, modelResponse: round.content, tags: ["pos-demo", "ilha-futura"] });
    round.rating = rating; round.exampleId = example.id; publish(); return true;
  }
  return { enter, begin, finish, fail, pause, resume, acknowledge, config, restart, rate };
}
