import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { POINT_CLOUD_PRESETS } from "../lib/post-demo/pointCloudSettings.js";

const CLOUD_LABEL = "Nuvem de pontos 3D da plateia";
const parseVector = value => `${value || ""}`.split(",").map(Number);
const vectorDistance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

// Runs only against the isolated browser fixture. Never creates/resets a presentation.
export async function auditPointCloudControls({ projection, control, output, base, sessionId }) {
  const url = new URL(base);
  assert(["127.0.0.1", "localhost"].includes(url.hostname) && url.port !== "3000", "A auditoria dos controles exige servidor isolado.");
  const report = { ok: false, physicalProjector: false, presets: {}, checks: [], failures: [] };
  const check = (condition, message) => { if (!condition) report.failures.push(message); };
  async function get(route) { const response = await fetch(base + route); assert(response.ok, route); return response.json(); }
  async function command(action, data = {}) {
    const response = await fetch(base + "/api/post-demo", { method: "POST", headers: { "Content-Type": "application/json", origin: base }, body: JSON.stringify({ action, sessionId, ...data }) });
    const value = await response.json(); assert(response.ok, JSON.stringify(value)); return value;
  }
  async function poll(run, label, timeout = 12000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await run()) return; await new Promise(resolve => setTimeout(resolve, 70)); }
    throw Error(`Timeout: ${label}`);
  }
  const details = async () => (await get("/api/post-demo")).postDemo;
  const publicState = () => get("/api/state");
  const canvas = () => projection.getByLabel(CLOUD_LABEL, { exact: true });
  const preset = () => control.getByRole("combobox", { name: "Preset de movimento da nuvem", exact: true });
  async function setField(label, value) {
    await control.getByRole("slider", { name: `${label} da nuvem`, exact: true }).fill(`${value}`);
  }
  async function sample(seconds = 1.2) {
    return canvas().evaluate((element, duration) => new Promise((resolve, reject) => {
      const start = performance.now(), samples = [];
      function frame() {
        if (!element.isConnected) { reject(Error("O canvas foi substituído ao ajustar os controles.")); return; }
        samples.push({ at: performance.now(), camera: element.dataset.camera, pan: element.dataset.pan,
          yaw: Number(element.dataset.yaw), distance: Number(element.dataset.distance), phase: element.dataset.phase,
          preset: element.dataset.preset, time: element.__pointCloudAnimationProbe?.uniforms.uTime });
        if (performance.now() - start >= duration * 1000) resolve(samples); else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }), seconds);
  }
  function summarize(samples) {
    const camera = samples.map(sample => parseVector(sample.camera)), target = samples.map(sample => parseVector(sample.pan));
    const maxCamera = Math.max(...camera.map(value => vectorDistance(camera[0], value)));
    const maxTarget = Math.max(...target.map(value => vectorDistance(target[0], value)));
    const yaw = samples.map(value => value.yaw), distance = samples.map(value => value.distance);
    return { cameraTravel: maxCamera, targetTravel: maxTarget, yawTravel: Math.max(...yaw) - Math.min(...yaw),
      distanceTravel: Math.max(...distance) - Math.min(...distance), shaderTime: samples.at(-1).time - samples[0].time,
      first: samples[0], last: samples.at(-1) };
  }
  async function waitPreset(id) {
    await poll(async () => (await details()).config.pointCloud.preset === id && await canvas().getAttribute("data-preset") === id, `preset ${id} salvo e aplicado`);
  }
  async function selectPreset(id) { await preset().selectOption(id); await waitPreset(id); }
  async function shaderUniforms() { return canvas().evaluate(element => ({ ...element.__pointCloudAnimationProbe?.uniforms })); }
  async function pixels() {
    return canvas().evaluate(element => new Promise(resolve => requestAnimationFrame(() => {
      const gl = element.getContext("webgl2"), bytes = new Uint8Array(element.width * element.height * 4);
      gl.readPixels(0, 0, element.width, element.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      let hash = 2166136261, lit = 0;
      for (let index = 0; index < bytes.length; index += 4) {
        if (bytes[index] + bytes[index + 1] + bytes[index + 2] > 24) lit++;
        if (index % 64 === 0) hash = Math.imul(hash ^ (bytes[index] + bytes[index + 1] * 3 + bytes[index + 2] * 7), 16777619);
      }
      resolve({ hash: hash >>> 0, lit, time: element.__pointCloudAnimationProbe?.uniforms.uTime });
    })));
  }
  let original;
  try {
    await command("pause");
    const before = await publicState(), beforePrivate = await details();
    original = structuredClone(beforePrivate.config.pointCloud);
    report.originalSettings = original;
    check(original.preset === "reveal-tour", "O passeio com entrada no escuro não é o preset padrão.");
    check(original.startDarkSeconds > 0 && original.revealSeconds > 0, "A entrada padrão deve reservar escuridão e revelação gradual.");
    await canvas().evaluate(element => { window.__pointCloudControlsCanvas = element; });
    const originalRef = before.postDemo.pointCloud;
    check(await projection.getByRole("combobox").count() === 0 && await projection.getByRole("slider").count() === 0 && await projection.getByRole("checkbox").count() === 0,
      "A projeção exibiu controles privados da nuvem.");
    const options = await preset().locator("option").evaluateAll(elements => elements.map(element => element.value));
    check(POINT_CLOUD_PRESETS.every(value => options.includes(value.id)), "Faltam opções de passeio no painel.");

    // Two rapid edits to the same nested object must survive save coalescing/in-flight requests.
    await setField("Intensidade da luz", .27); await setField("Pulso do tamanho dos pontos", .11);
    await setField("Distância final / zoom-out", .9); await setField("Duração do passeio", 8);
    await setField("Duração do giro", 6); await setField("Amplitude do passeio", .2);
    await poll(async () => { const settings = (await details()).config.pointCloud; return settings.pulseIntensity === .27 && settings.pulseSize === .11 && settings.endDistance === .9 && settings.tourSeconds === 8 && settings.rotationPeriodSeconds === 6 && settings.travelAmplitude === .2; }, "edições rápidas preservadas");
    await poll(async () => { const uniforms = await shaderUniforms(); return Math.abs(uniforms.uPulseIntensity - .27) < .001 && Math.abs(uniforms.uPulseSize - .11) < .001; }, "shader atualizado sem recarregar");
    const publicCloud = (await publicState()).postDemo;
    check(Object.keys(publicCloud.pointCloud).sort().join(",") === "id,url", "A referência pública da nuvem foi ampliada com dados privados.");
    assert.deepEqual(publicCloud.cloudPresentation.settings, (await details()).config.pointCloud);
    check(!JSON.stringify(publicCloud.cloudPresentation).includes("personality") && !JSON.stringify(publicCloud.cloudPresentation).includes("sourceName"), "Parâmetros privados vazaram na apresentação visual.");
    report.checks.push("controles somente privados; alterações rápidas preservadas e refletidas no shader/publicação sem reload");

    for (const id of ["rotate", "tour", "rows", "lateral", "dolly", "still"]) {
      await selectPreset(id);
      // Allow the camera's damped transition to settle; time comes from rendered frames.
      await sample(1.8);
      const result = summarize(await sample(1.25)); report.presets[id] = result;
      check(Number.isFinite(result.shaderTime) && result.shaderTime > 1, `${id}: o relógio do shader parou.`);
      if (id === "rotate") {
        check(result.cameraTravel < .015 && result.targetTravel < .015, "Só rotacionar também deslocou a câmera/alvo.");
        check(result.yawTravel > .005, "Só rotacionar não produziu giro lateral.");
      } else if (id === "still") {
        check(result.cameraTravel < .015 && result.targetTravel < .015 && result.yawTravel < .005, "Câmera parada ainda executou um passeio.");
      } else if (id === "dolly") {
        check(result.distanceTravel > .005, "Aproximar e afastar não alterou a distância.");
        check(result.yawTravel < .005 && result.targetTravel < .015, "Aproximar e afastar também girou/deslocou o alvo.");
      } else check(result.cameraTravel > .005 || result.targetTravel > .005, `${id}: o preset não percorreu o espaço.`);
    }
    report.checks.push("seis movimentos distintos: giro, panorâmico, fileiras, travessia, distância e câmera parada");
    const stillA = await pixels(); await sample(1.1); const stillB = await pixels();
    check(stillA.hash !== stillB.hash && stillB.time > stillA.time + .9, "A respiração parou quando a câmera ficou parada.");

    const shaderToggle = control.getByRole("checkbox", { name: "Respiração do shader", exact: true });
    await shaderToggle.uncheck();
    await poll(async () => { const uniforms = await shaderUniforms(); return uniforms.uPulseIntensity === 0 && uniforms.uPulseSize === 0 && uniforms.uLocalAmplitude === 0; }, "shader desativado");
    await shaderToggle.check();
    await poll(async () => { const uniforms = await shaderUniforms(); return uniforms.uPulseIntensity > .26 && uniforms.uLocalAmplitude > 0; }, "shader reativado");
    await selectPreset("tour"); await sample(.8);
    const motionToggle = control.getByRole("checkbox", { name: "Movimento automático da nuvem", exact: true });
    await motionToggle.uncheck(); await sample(.5);
    const frozen = summarize(await sample(.8));
    check(frozen.cameraTravel < .015 && frozen.targetTravel < .015 && frozen.yawTravel < .005, "Desativar o movimento automático não preservou o enquadramento.");
    await motionToggle.check();

    const rectangle = await canvas().boundingBox(), x = rectangle.x + rectangle.width / 2, y = rectangle.y + rectangle.height / 2;
    const manualBefore = await shaderUniforms();
    await projection.mouse.move(x, y); await projection.mouse.down();
    await projection.mouse.move(x + 35, y + 12, { steps: 10 }); await sample(.4); await projection.mouse.up();
    await projection.mouse.wheel(0, -100); await projection.keyboard.down("Shift"); await projection.mouse.down();
    await projection.mouse.move(x + 48, y + 12, { steps: 8 }); await projection.mouse.up(); await projection.keyboard.up("Shift");
    const manualAfter = await shaderUniforms();
    check(manualAfter.uTime > manualBefore.uTime + .3, "O relógio do shader parou durante giro/zoom/deslocamento manuais.");
    report.checks.push("shader continua em câmera parada/manual; chaves independentes de movimento e respiração");

    // Reload the control only: the public canvas, presentation and current cloud must survive.
    const saved = (await details()).config.pointCloud;
    await control.reload({ waitUntil: "domcontentloaded" });
    await poll(async () => await preset().inputValue() === saved.preset && await control.getByRole("slider", { name: "Intensidade da luz da nuvem", exact: true }).inputValue() === `${saved.pulseIntensity}`, "ajustes após reload");
    assert.deepEqual((await details()).config.pointCloud, saved);
    check((await publicState()).postDemo.totalRounds === before.postDemo.totalRounds, "Recarregar o painel avançou as cartas pausadas.");
    await control.screenshot({ path: path.join(output, "point-cloud-private-controls.png") });

    // Replay only the camera with a short authored dark/close/reveal sequence.
    await setField("Tempo no escuro", .6); await setField("Tempo de revelação", 2);
    await poll(async () => { const settings = (await details()).config.pointCloud; return settings.startDarkSeconds === .6 && settings.revealSeconds === 2; }, "tempos curtos salvos");
    await selectPreset("reveal-tour");
    await poll(async () => await canvas().getAttribute("data-phase") === "dark", "entrada no escuro", 4000);
    const dark = await pixels(); check(dark.lit < 10, "O passeio não começou no escuro.");
    await projection.screenshot({ path: path.join(output, "point-cloud-tour-dark.png") });
    await poll(async () => await canvas().getAttribute("data-phase") === "reveal", "revelação gradual", 5000);
    await poll(async () => await canvas().getAttribute("data-phase") === "automatic", "passeio após revelação", 7000);
    const replayBefore = await publicState(), replayPrivate = await details();
    await control.getByRole("button", { name: "Reiniciar passeio", exact: true }).click();
    await poll(async () => (await publicState()).postDemo.cloudPresentation.playback.token !== replayBefore.postDemo.cloudPresentation.playback.token, "replay independente publicado");
    const replayAfter = await publicState();
    assert.deepEqual(replayAfter.postDemo.pointCloud, replayBefore.postDemo.pointCloud);
    assert.deepEqual(replayAfter.postDemo.rounds, replayBefore.postDemo.rounds);
    assert.equal(replayAfter.postDemo.totalRounds, replayBefore.postDemo.totalRounds);
    assert.equal(replayAfter.audienceWarmup.manualMode, replayBefore.audienceWarmup.manualMode);
    assert.deepEqual((await details()).config, replayPrivate.config);
    assert.equal(replayAfter.reliability.sessionId, sessionId);
    check(await canvas().evaluate(element => element === window.__pointCloudControlsCanvas), "Os controles/replay recriaram o canvas público.");
    report.checks.push("reload preserva escolhas; replay só da câmera mantém foto, cartas, parâmetros e modo manual");

    await poll(async () => await canvas().getAttribute("data-phase") === "automatic", "fim da entrada repetida", 7000);
    await command("config", { config: { pointCloud: original } });
    await poll(async () => JSON.stringify((await details()).config.pointCloud) === JSON.stringify(original), "restauração dos ajustes iniciais");
    await poll(async () => {
      const rendered = await canvas().evaluate(element => ({ preset: element.dataset.preset, phase: element.dataset.phase,
        uniforms: { ...element.__pointCloudAnimationProbe?.uniforms } }));
      return rendered.preset === original.preset && rendered.phase === "automatic" && rendered.uniforms.uRevealOpacity > .999 &&
        Math.abs(rendered.uniforms.uPulseIntensity - (original.shaderEnabled ? original.pulseIntensity : 0)) < .001 &&
        Math.abs(rendered.uniforms.uPulseSize - (original.shaderEnabled ? original.pulseSize : 0)) < .001;
    }, "entrada padrão opaca e parâmetros restaurados na projeção", (original.startDarkSeconds + original.revealSeconds + 10) * 1000);
    assert.deepEqual((await publicState()).postDemo.pointCloud, originalRef);
    report.ok = report.failures.length === 0;
    console.log(`CLOUD CONTROLS: ${POINT_CLOUD_PRESETS.length} presets, shader, replay e persistência verificados.`);
  } catch (error) {
    report.failures.push(error.message);
    await projection.screenshot({ path: path.join(output, "point-cloud-controls-failure-public.png") }).catch(() => {});
    await control.screenshot({ path: path.join(output, "point-cloud-controls-failure-private.png") }).catch(() => {});
    throw error;
  } finally {
    await fs.writeFile(path.join(output, "point-cloud-controls-report.json"), JSON.stringify(report, null, 2));
  }
  assert.deepEqual(report.failures, [], "Falhas nos controles da nuvem; consulte point-cloud-controls-report.json.");
  return report;
}
