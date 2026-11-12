import assert from "node:assert/strict";
import { POINT_CLOUD_PRESETS, normalizePointCloudSettings } from "../lib/post-demo/pointCloudSettings.js";
import { samplePointCloudMotion } from "../lib/post-demo/pointCloudMotion.js";

const defaults = normalizePointCloudSettings();
const values = sample => [...sample.camera, ...sample.target, sample.yaw, sample.opacity, sample.reveal];
const close = (left, right, tolerance = 1e-6) => values(left).every((value, index) => Math.abs(value - values(right)[index]) <= tolerance);
const sample = (elapsed, patch = {}) => samplePointCloudMotion({ ...defaults, ...patch }, elapsed);

assert.equal(sample(0).phase, "dark");
assert.equal(sample(0).opacity, 0);
assert.equal(sample(0).camera[2], defaults.endDistance);
assert(sample(1).camera[2] < sample(0).camera[2], "a câmera deve se aproximar durante o escuro");
assert.equal(sample(defaults.startDarkSeconds).camera[2], defaults.startDistance);
assert.equal(sample(defaults.startDarkSeconds).phase, "reveal");
const end = defaults.startDarkSeconds + defaults.revealSeconds;
assert.equal(sample(end).opacity, 1); assert.equal(sample(end).reveal, 1);
assert.equal(sample(end).camera[2], defaults.endDistance);
assert.notDeepEqual(sample(end + 8).camera, sample(end).camera, "o passeio deve alterar a posição real da câmera");
assert.notDeepEqual(sample(end + 8).target, sample(end).target, "o passeio deve alterar o foco espacial");

for (const boundary of [defaults.startDarkSeconds, end]) {
  assert(close(sample(boundary - 1e-5), sample(boundary + 1e-5)), `sem salto na transição ${boundary}`);
}
assert.equal(sample(0, { startDarkSeconds: 0 }).phase, "reveal");
assert(close(sample(NaN), sample(0))); assert(close(sample(-500), sample(0)));

for (const { id } of POINT_CLOUD_PRESETS) {
  const config = { ...defaults, preset: id };
  const period = id === "rotate" ? defaults.rotationPeriodSeconds : defaults.tourSeconds;
  const entry = id === "reveal-tour" ? end : 0;
  for (let index = 0; index <= 200; index++) {
    const pose = samplePointCloudMotion(config, entry + index * period / 50);
    assert(values(pose).every(Number.isFinite), `${id}: coordenadas finitas`);
    assert(pose.camera[2] > 0, `${id}: câmera deve continuar à frente da nuvem`);
    assert(pose.opacity >= 0 && pose.opacity <= 1 && pose.reveal >= 0 && pose.reveal <= 1);
    assert(Math.abs(pose.yaw) <= defaults.rotationDegrees * Math.PI / 180 + 1e-8);
    if (id !== "reveal-tour") assert.equal(pose.opacity, 1, `${id}: não deve repetir a entrada escura`);
    if (["rotate", "still", "dolly"].includes(id)) {
      assert.deepEqual(pose.camera.slice(0, 2), [0, 0]); assert.deepEqual(pose.target, [0, 0, 0]);
    }
    if (["still", "dolly"].includes(id)) assert.equal(pose.yaw, 0);
    if (["rotate", "still"].includes(id)) assert.equal(pose.camera[2], defaults.endDistance);
  }
  const loop = entry + period * 2;
  assert(close(samplePointCloudMotion(config, loop - 1e-5), samplePointCloudMotion(config, loop + 1e-5)), `${id}: loop contínuo`);
}

assert(sample(8, { preset: "rotate" }).yaw !== 0);
assert(sample(8, { preset: "dolly" }).camera[2] !== defaults.endDistance);
assert(Math.abs(sample(12, { preset: "rows" }).camera[1]) > Math.abs(sample(12, { preset: "rows" }).camera[0]));
assert(Math.abs(sample(12, { preset: "lateral" }).camera[0]) > Math.abs(sample(12, { preset: "lateral" }).camera[1]));
for (const preset of ["tour", "rows", "lateral"]) {
  const faster = sample(7, { preset, rotationPeriodSeconds: 12 });
  const slower = sample(7, { preset, rotationPeriodSeconds: 36 });
  assert(Math.abs(faster.yaw - slower.yaw) > .01, `${preset}: a duração do giro deve alterar o yaw`);
  assert.deepEqual(faster.camera, slower.camera, `${preset}: o giro não deve mudar o caminho da câmera`);
  assert.deepEqual(faster.target, slower.target, `${preset}: o giro não deve mudar o foco do passeio`);
}
for (const time of [0, 5, 25, 100]) assert(close(sample(time, { motionEnabled: false }), sample(0, { preset: "still" })));
for (const { id } of POINT_CLOUD_PRESETS) {
  const entry = id === "reveal-tour" ? end : 0;
  for (const time of [0, 5, 12, 36, 72]) {
    const stationary = sample(entry + time, { preset: id, travelAmplitude: 0 });
    assert(stationary.camera.every((value, axis) => Math.abs(value - [0, 0, defaults.endDistance][axis]) < 1e-12), `${id}: amplitude zero também deve parar o zoom`);
    assert(stationary.target.every(value => Math.abs(value) < 1e-12), `${id}: amplitude zero deve parar o foco espacial`);
  }
  for (let step = 0; step <= 100; step++) {
    const largest = sample(entry + step * defaults.tourSeconds / 25, { preset: id, travelAmplitude: .35, endDistance: .35 });
    assert(largest.camera[2] > 0, `${id}: distância positiva na amplitude máxima`);
    assert(values(largest).every(Number.isFinite));
  }
}
for (const time of [0, 3, 10, 100]) assert(values(samplePointCloudMotion({ preset: "rows", endDistance: -100, travelAmplitude: Infinity, tourSeconds: 0 }, time)).every(Number.isFinite));

console.log("POINT CLOUD MOTION PASS: dark zoom-in, gradual reveal, spatial tours, rotation-only/static modes, bounded coordinates and continuous transitions/loops");
