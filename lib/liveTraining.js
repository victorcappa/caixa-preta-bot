export const LIVE_TRAINING_RATINGS = ["perfect", "almost", "bad"];

export function createLiveTrainingState() {
  return { messages: [], status: "idle", requestId: null, error: null, completedRequests: [] };
}

export function restoredLiveTrainingState(value = {}) {
  return { ...createLiveTrainingState(), ...value, status: "idle", requestId: null, error: null,
    messages: (value.messages || []).map(message => ({ ...message,
      status: message.status === "streaming" ? "cancelled" : message.status })) };
}

export function liveTrainingSnapshot(value = createLiveTrainingState(), includePrivate = false) {
  if (includePrivate) return structuredClone(value);
  return { status: value.status, messages: value.messages.map(({ id, role, content, status, kind, parentId }) =>
    ({ id, role, content, status, kind, parentId })) };
}

// The store owns the state; only the in-flight AbortController lives in this adapter.
export function createLiveTrainingController({ get, emit, saveExample }) {
  let job = null;
  const changed = (type = "live-training") => emit({ type });
  function begin({ requestId, text = "", parentId = null }) {
    const state = get();
    if (state.completedRequests.includes(requestId)) return { duplicate: true };
    if (job) return { busy: true };
    const parent = parentId && state.messages.find(message => message.id === parentId);
    if (parentId !== null && (!parent || parent.role !== "assistant" || parent.status !== "complete")) return { error: "Esta resposta ainda não está disponível." };
    if (!parentId) {
      const existing = state.messages.find(message => message.id === `bot-${requestId}`);
      if (existing) {
        existing.content = "";
        existing.status = "streaming";
      } else {
        state.messages.push({ id: requestId, role: "user", content: text, status: "complete", kind: "conversation" });
        state.messages.push({ id: `bot-${requestId}`, role: "assistant", content: "", status: "streaming", kind: "conversation", promptId: requestId });
      }
    }
    state.error = null;
    state.requestId = requestId;
    state.status = parentId ? "alternatives" : "generating";
    job = { requestId, parentId, messageId: parentId ? null : `bot-${requestId}`, controller: new AbortController() };
    changed();
    return job;
  }
  function append(activeJob, delta) {
    if (!job || job !== activeJob || !job.messageId) return false;
    const message = get().messages.find(message => message.id === job.messageId);
    message.content = (message.content + delta).slice(0, 12000);
    changed();
    return true;
  }
  function finish(activeJob, { alternatives = [], error = null } = {}) {
    if (!job || job !== activeJob) return false;
    const { requestId } = job;
    const state = get();
    if (job.messageId) state.messages.find(message => message.id === job.messageId).status = error ? "failed" : "complete";
    if (!error && job.parentId) {
      alternatives.filter(text => typeof text === "string" && text.trim()).slice(0, 3).forEach((content, index) => {
        state.messages.push({ id: `alt-${requestId}-${index}`, role: "assistant", content: content.trim().slice(0, 12000),
          status: "complete", kind: "alternative", parentId: job.parentId,
          promptId: state.messages.find(message => message.id === job.parentId)?.promptId });
      });
    }
    if (!error) state.completedRequests = [...state.completedRequests, requestId].slice(-500);
    state.status = "idle";
    state.requestId = null;
    state.error = error;
    job = null;
    changed();
    return true;
  }
  function cancel() {
    if (!job) return;
    job.controller.abort();
    const state = get();
    const message = state.messages.find(message => message.id === job.messageId);
    if (message) message.status = "cancelled";
    state.status = "idle";
    state.requestId = null;
    job = null;
    changed();
  }
  function rate(messageId, rating) {
    const state = get();
    const index = state.messages.findIndex(message => message.id === messageId);
    const message = state.messages[index];
    if (!LIVE_TRAINING_RATINGS.includes(rating) || message?.role !== "assistant" || message.status !== "complete") return { error: "AVALIACAO_INVALIDA" };
    const promptIndex = state.messages.findIndex(candidate => candidate.id === message.promptId);
    const conversation = state.messages.slice(0, promptIndex >= 0 ? promptIndex + 1 : index);
    const userMessage = [...conversation].reverse().find(message => message.role === "user")?.content || "";
    const example = saveExample({ source: "live-training", sourceMessageId: messageId, rating,
      mode: "live-training", userMessage, modelResponse: message.content,
      conversation: conversation.slice(-20).map(({ role, content }) => ({ role, content })),
      tags: ["treino-ao-vivo"] });
    message.rating = rating;
    message.exampleId = example.id;
    changed("live-training-feedback");
    return { ok: true };
  }
  return { begin, append, finish, cancel, rate };
}
