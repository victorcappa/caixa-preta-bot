import { randomUUID } from "crypto";

const globalKey = "__caixaPretaShowState";

function createStore() {
  const listeners = new Set();
  const state = {
    memories: [],
    conversation: [],
    variables: {}
  };

  function snapshot() {
    return {
      memories: [...state.memories],
      conversation: [...state.conversation],
      variables: { ...state.variables }
    };
  }

  function emit(event) {
    const payload = {
      event,
      state: snapshot()
    };

    for (const listener of listeners) {
      listener(payload);
    }
  }

  function addMemory(content) {
    const memory = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      source: "operator",
      type: "memory",
      content
    };

    state.memories.push(memory);
    emit({ type: "memory", memory });
    return memory;
  }

  function addMessage(role, content, source = "projection") {
    const message = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      role,
      source,
      content
    };

    state.conversation.push(message);
    emit({ type: "message", message });
    return message;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    addMemory,
    addMessage,
    snapshot,
    subscribe
  };
}

export const showState = globalThis[globalKey] || createStore();

if (!globalThis[globalKey]) {
  globalThis[globalKey] = showState;
}
