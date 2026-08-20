import assert from "node:assert/strict";
import { readForcaGSamplerConfig } from "../lib/forca-g-sampler/config.js";
import { createInitialForcaGSamplerState, reduceForcaGSamplerState } from "../lib/forca-g-sampler/state.js";

function item(id, type, category, extra = {}) {
  return {
    id,
    label: id,
    type,
    category,
    assetPath: `sampler-forca-g/${category}/${id}.test`,
    available: true,
    loop: false,
    volume: 1,
    durationMs: 0,
    ...extra
  };
}

let state = createInitialForcaGSamplerState();
const audioA = item("audio-a", "audio", "audio");
const audioB = item("audio-b", "audio", "audio", { loop: true });

state = reduceForcaGSamplerState(state, "play", { item: audioA }).state;
state = reduceForcaGSamplerState(state, "play", { item: audioB }).state;
assert.equal(state.audioCues.length, 2, "dois áudios distintos devem tocar simultaneamente");

state = reduceForcaGSamplerState(state, "play", { item: audioA }).state;
assert.equal(state.audioCues.length, 3, "retrigger deve criar outra voz");
assert.equal(new Set(state.audioCues.map((cue) => cue.playbackId)).size, 3, "cada voz deve ter playbackId próprio");

state = reduceForcaGSamplerState(state, "stop", { category: "audio", itemId: audioA.id }).state;
assert.deepEqual(state.audioCues.map((cue) => cue.id), [audioB.id], "stop individual deve preservar outros áudios");

const fadingAudio = item("audio-fade", "audio", "audio", { fadeOutMs: 400 });
state = reduceForcaGSamplerState(state, "play", { item: fadingAudio }).state;
state = reduceForcaGSamplerState(state, "stop", { category: "audio", itemId: fadingAudio.id }).state;
assert.equal(state.audioCues.find((cue) => cue.id === fadingAudio.id)?.stopping, true, "fade out deve manter a voz durante a rampa");
state = reduceForcaGSamplerState(state, "stop", { category: "audio", itemId: fadingAudio.id, immediate: true }).state;
assert.equal(state.audioCues.some((cue) => cue.id === fadingAudio.id), false, "fim do fade deve liberar a voz");

const video = item("video", "video", "video");
const gLocA = item("g-a", "video", "gLoc");
const gLocB = item("g-b", "video", "gLoc", { loop: true });
const imageReplace = item("image-r", "image", "images", { mode: "replace" });
const imageOverlay = item("image-o", "image", "images", { mode: "overlay" });
const text = item("text", "text", "texts", { text: "4G", assetPath: "" });

for (const visual of [video, gLocA, imageReplace, imageOverlay, text]) {
  state = reduceForcaGSamplerState(state, "play", { item: visual }).state;
}
assert.equal(state.layers.video.id, video.id);
assert.equal(state.layers.gLoc.id, gLocA.id);
assert.deepEqual(state.layers.images.map((cue) => cue.id), [imageReplace.id, imageOverlay.id]);
assert.equal(state.layers.text.text, "4G");
assert.equal(state.audioCues.length, 1, "visuais e texto não devem interromper áudio");

state = reduceForcaGSamplerState(state, "play", { item: gLocB }).state;
assert.equal(state.layers.gLoc.id, gLocB.id, "G-LOC deve trocar imediatamente dentro do slot exclusivo");
const beforeRestart = state.layers.gLoc.playbackId;
state = reduceForcaGSamplerState(state, "restart", { category: "gLoc" }).state;
assert.notEqual(state.layers.gLoc.playbackId, beforeRestart, "reiniciar deve gerar novo playback");

state = reduceForcaGSamplerState(state, "update", { category: "gLoc", patch: { loop: false, muted: true } }).state;
assert.equal(state.layers.gLoc.loop, false);
assert.equal(state.layers.gLoc.muted, true);

state = reduceForcaGSamplerState(state, "clear-visual").state;
assert.equal(state.layers.video, null);
assert.equal(state.layers.gLoc, null);
assert.deepEqual(state.layers.images, []);
assert.equal(state.layers.text.id, text.id, "clear visual deve preservar texto");
assert.equal(state.audioCues.length, 1, "clear visual deve preservar áudio");

state = reduceForcaGSamplerState(state, "stop-all").state;
assert.deepEqual(state.layers, { gLoc: null, video: null, images: [], text: null });
assert.deepEqual(state.audioCues, []);

const unavailable = reduceForcaGSamplerState(state, "play", { item: { ...audioA, available: false } });
assert.equal(unavailable.applied, false, "asset ausente não deve alterar o sampler");

const config = readForcaGSamplerConfig();
assert.equal(config.sections.gLoc.length >= 3, true, "vídeos G-LOC existentes devem permanecer registrados");
assert.equal(config.sections.gLoc.every((entry) => entry.available), true, "vídeos G-LOC existentes devem estar disponíveis");
assert.equal(config.sections.gLoc.some((entry) => entry.shortcut === "1"), true, "atalhos do sampler existente devem ser preservados");

console.log("forca-g sampler tests passed");
