import { randomUUID } from "node:crypto";
import { normalizeSceneAudioEffects } from "../sceneAudioEffects.js";

export function createInitialForcaGSamplerState(masterVolume = 1) {
  return {
    layers: { gLoc: null, video: null, images: [], text: null },
    audioCues: [],
    masterVolume: Math.max(0, Math.min(1, Number(masterVolume) || 0)),
    errors: {},
    updatedAt: new Date().toISOString(),
    sequence: 0
  };
}

export function publicForcaGSamplerSnapshot(state = createInitialForcaGSamplerState()) {
  return {
    layers: {
      gLoc: state.layers?.gLoc ? { ...state.layers.gLoc } : null,
      video: state.layers?.video ? { ...state.layers.video } : null,
      images: (state.layers?.images || []).map((item) => ({ ...item })),
      text: state.layers?.text ? { ...state.layers.text } : null
    },
    audioCues: (state.audioCues || []).map((item) => ({ ...item })),
    masterVolume: Math.max(0, Math.min(1, Number(state.masterVolume) || 0)),
    errors: { ...(state.errors || {}) },
    updatedAt: state.updatedAt || null,
    sequence: Number(state.sequence || 0)
  };
}

function stamped(state) {
  return { ...state, updatedAt: new Date().toISOString(), sequence: Number(state.sequence || 0) + 1 };
}

function runtimeItem(item) {
  return { ...item, playbackId: randomUUID(), triggeredAt: new Date().toISOString() };
}

export function reduceForcaGSamplerState(current, action, payload = {}) {
  const state = publicForcaGSamplerSnapshot(current);
  const normalizedAction = `${action || ""}`.toLowerCase();

  if (normalizedAction === "play") {
    const item = payload.item;
    if (!item?.available) return { state, applied: false, error: "SAMPLER ASSET UNAVAILABLE" };
    const playing = runtimeItem(item);
    const errors = { ...state.errors };
    delete errors[item.id];

    if (item.type === "audio") {
      return { state: stamped({ ...state, errors, audioCues: [...state.audioCues, playing].slice(-96) }), applied: true };
    }
    if (item.category === "gLoc") {
      return { state: stamped({ ...state, errors, layers: { ...state.layers, gLoc: playing } }), applied: true };
    }
    if (item.type === "video") {
      return { state: stamped({ ...state, errors, layers: { ...state.layers, video: playing } }), applied: true };
    }
    if (item.type === "image") {
      const images = item.mode === "overlay" ? [...state.layers.images, playing].slice(-12) : [playing];
      return { state: stamped({ ...state, errors, layers: { ...state.layers, images } }), applied: true };
    }
    if (item.type === "text") {
      return { state: stamped({ ...state, errors, layers: { ...state.layers, text: playing } }), applied: true };
    }
  }

  if (normalizedAction === "stop") {
    const { category, itemId, playbackId, immediate } = payload;
    if (category === "audio") {
      const matches = (item) => playbackId ? item.playbackId === playbackId : item.id === itemId;
      const audioCues = state.audioCues.flatMap((item) => {
        if (!matches(item)) return [item];
        if (!immediate && item.fadeOutMs > 0 && !item.stopping) return [{ ...item, stopping: true }];
        return [];
      });
      return { state: stamped({ ...state, audioCues }), applied: true };
    }
    if (category === "images") {
      const images = itemId ? state.layers.images.flatMap((item) => {
        if (item.id !== itemId) return [item];
        if (!immediate && item.fadeOutMs > 0 && !item.stopping) return [{ ...item, stopping: true }];
        return [];
      }) : [];
      return { state: stamped({ ...state, layers: { ...state.layers, images } }), applied: true };
    }
    const layerKey = category === "texts" ? "text" : category;
    if (["gLoc", "video", "text"].includes(layerKey)) {
      const item = state.layers[layerKey];
      const nextItem = item && !immediate && item.fadeOutMs > 0 && !item.stopping ? { ...item, stopping: true } : null;
      return { state: stamped({ ...state, layers: { ...state.layers, [layerKey]: nextItem } }), applied: true };
    }
  }

  if (normalizedAction === "restart") {
    const layerKey = payload.category === "texts" ? "text" : payload.category;
    const item = state.layers[layerKey];
    if (!item) return { state, applied: true };
    return { state: stamped({ ...state, layers: { ...state.layers, [layerKey]: runtimeItem(item) } }), applied: true };
  }

  if (normalizedAction === "update") {
    const patch = payload.patch || {};
    if (payload.category === "master") {
      const masterVolume = Math.max(0, Math.min(1, Number(patch.masterVolume) || 0));
      return { state: stamped({ ...state, masterVolume }), applied: true };
    }
    const layerKey = payload.category === "texts" ? "text" : payload.category;
    if (["gLoc", "video"].includes(layerKey) && state.layers[layerKey]) {
      const item = state.layers[layerKey];
      const next = {
        ...item,
        ...(patch.loop === undefined ? {} : { loop: Boolean(patch.loop) }),
        ...(patch.muted === undefined ? {} : { muted: Boolean(patch.muted) }),
        ...(patch.volume === undefined ? {} : { volume: Math.max(0, Math.min(1, Number(patch.volume) || 0)) })
      };
      return { state: stamped({ ...state, layers: { ...state.layers, [layerKey]: next } }), applied: true };
    }
  }

  if (normalizedAction === "update-audio") {
    const itemId = `${payload.itemId || ""}`;
    const audioEffects = normalizeSceneAudioEffects(payload.audioEffects);
    const audioCues = state.audioCues.map((item) => item.id === itemId ? { ...item, audioEffects } : item);
    return { state: stamped({ ...state, audioCues }), applied: true };
  }

  if (normalizedAction === "error") {
    const itemId = `${payload.itemId || "unknown"}`;
    return { state: stamped({ ...state, errors: { ...state.errors, [itemId]: `${payload.message || "Falha ao carregar asset"}`.slice(0, 300) } }), applied: true };
  }

  if (["stop-audio", "clear-audio"].includes(normalizedAction)) {
    return { state: stamped({ ...state, audioCues: [] }), applied: true };
  }
  if (normalizedAction === "clear-text") {
    return { state: stamped({ ...state, layers: { ...state.layers, text: null } }), applied: true };
  }
  if (normalizedAction === "clear-visual") {
    return { state: stamped({ ...state, layers: { ...state.layers, gLoc: null, video: null, images: [] } }), applied: true };
  }
  if (["stop-all", "reset"].includes(normalizedAction)) {
    const reset = createInitialForcaGSamplerState(state.masterVolume);
    return { state: { ...reset, sequence: state.sequence + 1 }, applied: true };
  }

  return { state, applied: false, error: "SAMPLER ACTION UNKNOWN" };
}
