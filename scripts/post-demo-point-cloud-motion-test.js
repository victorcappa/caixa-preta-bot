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
    assert(stationary.camera.slice(0, 2).every(value => Math.abs(value) < 1e-12), `${id}: amplitude zero deve parar o deslocamento XY`);
    if (id !== "reveal-tour") assert.equal(stationary.camera[2], defaults.endDistance, `${id}: amplitude zero também deve parar o zoom`);
    assert(stationary.target.every(value => Math.abs(value) < 1e-12), `${id}: amplitude zero deve parar o foco espacial`);
  }
  for (let step = 0; step <= 100; step++) {
    const largest = sample(entry + step * defaults.tourSeconds / 25, { preset: id, travelAmplitude: .35, endDistance: .35 });
    assert(largest.camera[2] > 0, `${id}: distância positiva na amplitude máxima`);
    assert(values(largest).every(Number.isFinite));
  }
}
for (const time of [0, 3, 10, 100]) assert(values(samplePointCloudMotion({ preset: "rows", endDistance: -100, travelAmplitude: Infinity, tourSeconds: 0 }, time)).every(Number.isFinite));

// The default keeps travelling between the configured distances, even with XY travel disabled.
for (const patch of [{}, { startDistance: .12, endDistance: 1.2, tourSeconds: 20, revealSeconds: 7, startDarkSeconds: 1 },
  { startDistance: -3, endDistance: 90, tourSeconds: 0 }]) {
  const settings = normalizePointCloudSettings({ ...defaults, ...patch, travelAmplitude: 0 });
  const entry = settings.startDarkSeconds + settings.revealSeconds, period = settings.tourSeconds;
  for (const [time, distance] of [[0, settings.endDistance], [period / 2, settings.startDistance], [period, settings.endDistance], [period * 1.5, settings.startDistance]]) {
    const pose = samplePointCloudMotion(settings, entry + time);
    assert(Math.abs(pose.camera[2] - distance) < 1e-12, "o passeio padrão deve alcançar os limites configurados sem depender da amplitude XY");
    assert.equal(pose.opacity, 1); assert.equal(pose.reveal, 1); assert.equal(pose.target[2], 0);
  }
}

const rotationPresets = ["rotate", "tour", "rows", "lateral", "reveal-tour"];
for (const preset of rotationPresets) {
  const settings = normalizePointCloudSettings({ ...defaults, preset, rotationDegrees: 360, rotationPeriodSeconds: 12 });
  assert.equal(settings.rotationDegrees, 360, "o schema deve aceitar voltas completas");
  const entry = preset === "reveal-tour" ? end : 0, period = settings.rotationPeriodSeconds;
  for (const turns of [.5, 1, 2]) {
    const pose = samplePointCloudMotion(settings, entry + turns * period);
    assert(Math.abs(pose.yaw - turns * Math.PI * 2) < 1e-10, `${preset}: deve completar ${turns} volta(s) reais`);
  }
  let previous = -Infinity;
  for (let time = 0; time <= period * 2; time += .25) {
    const yaw = samplePointCloudMotion(settings, entry + time).yaw;
    assert(yaw >= previous, `${preset}: o giro completo não deve inverter ou voltar a zero no wrap`); previous = yaw;
  }
  for (const boundary of [period, period * 2]) {
    const before = samplePointCloudMotion(settings, entry + boundary - 1e-5), after = samplePointCloudMotion(settings, entry + boundary + 1e-5);
    assert(Math.abs(after.yaw - before.yaw) < 1e-3, `${preset}: sem salto angular ao cruzar uma volta`);
  }
  for (const degrees of [0, 8, 90, 180, 359.5]) for (const time of [0, 3, 8, 25, 49]) {
    const yaw = samplePointCloudMotion({ ...settings, rotationDegrees: degrees }, entry + time).yaw;
    assert(Math.abs(yaw) <= degrees * Math.PI / 180 + 1e-10, `${preset}: oscilações parciais respeitam o ângulo real`);
  }
}

// Position and velocity remain continuous when the reveal hands over to the cyclic tour.
for (const boundary of [end, end + defaults.tourSeconds, end + defaults.tourSeconds * 2]) {
  const delta = 1e-4, before = values(sample(boundary - delta)), center = values(sample(boundary)), after = values(sample(boundary + delta));
  assert(close(sample(boundary - delta), sample(boundary + delta), 1e-4));
  for (let axis = 0; axis < center.length; axis++) {
    const leftVelocity = (center[axis] - before[axis]) / delta, rightVelocity = (after[axis] - center[axis]) / delta;
    assert(Math.abs(leftVelocity - rightVelocity) < .001, "sem salto de velocidade após a entrada ou nos loops");
  }
}

console.log("POINT CLOUD MOTION PASS: dark reveal, recurring near/far tour, literal angles/full continuous turns, bounded coordinates and continuous transitions/loops");
