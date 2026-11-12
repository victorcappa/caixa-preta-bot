import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const CLOUD_LABEL = "Nuvem de pontos 3D da plateia";

// Test-only instrumentation: observe the real GPU clock and uploads without adding product hooks.
export async function installPointCloudAnimationProbe(context) {
  await context.addInitScript(() => {
    const locations = new WeakMap(), states = new WeakMap();
    function stateFor(gl) {
      if (!states.has(gl)) {
        const state = { uniforms: {}, uniformUpdates: 0, arrayBufferUploads: 0, arrayBufferSubUpdates: 0 };
        states.set(gl, state); gl.canvas.__pointCloudAnimationProbe = state;
      }
      return states.get(gl);
    }
    for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!type) continue;
      const prototype = type.prototype;
      const location = prototype.getUniformLocation, scalar = prototype.uniform1f;
      const upload = prototype.bufferData, update = prototype.bufferSubData;
      prototype.getUniformLocation = function (program, name) {
        const result = location.call(this, program, name);
        if (result) locations.set(result, name);
        return result;
      };
      prototype.uniform1f = function (uniform, value) {
        const name = uniform && locations.get(uniform);
        if (name?.startsWith("u")) {
          const state = stateFor(this); state.uniforms[name] = value;
          if (name === "uTime") state.uniformUpdates++;
        }
        return scalar.call(this, uniform, value);
      };
      prototype.bufferData = function (target, ...args) {
        if (target === this.ARRAY_BUFFER) stateFor(this).arrayBufferUploads++;
        return upload.call(this, target, ...args);
      };
      prototype.bufferSubData = function (target, ...args) {
        if (target === this.ARRAY_BUFFER) stateFor(this).arrayBufferSubUpdates++;
        return update.call(this, target, ...args);
      };
    }
  });
}

function harmonic(samples, band, period) {
  const mean = samples.reduce((sum, sample) => sum + sample.bands[band], 0) / samples.length;
  let cosine = 0, sine = 0;
  for (const sample of samples) {
    const phase = sample.time * Math.PI * 2 / period, value = sample.bands[band] - mean;
    cosine += value * Math.cos(phase); sine += value * Math.sin(phase);
  }
  const amplitude = 2 * Math.hypot(cosine, sine) / samples.length;
  return { mean, amplitude, relativeAmplitude: amplitude / Math.max(mean, 1e-6), phaseRadians: Math.atan2(sine, cosine) };
}

async function captureCycles(canvas) {
  return canvas.evaluate(element => new Promise((resolve, reject) => {
    const gl = element.getContext("webgl2"), probe = element.__pointCloudAnimationProbe;
    if (!gl || !probe || !Number.isFinite(probe.uniforms.uTime) || !Number.isFinite(probe.uniforms.uPulsePeriod)) {
      reject(Error("O shader não publicou uTime/uPulsePeriod no contexto observado.")); return;
    }
    const period = probe.uniforms.uPulsePeriod, duration = period * 2 + .25;
    const width = element.width, height = element.height, pixels = new Uint8Array(width * height * 4);
    const start = probe.uniforms.uTime, wallStart = performance.now(), samples = [];
    const before = { uploads: probe.arrayBufferUploads, subUpdates: probe.arrayBufferSubUpdates, uniformUpdates: probe.uniformUpdates };
    const uniforms = { ...probe.uniforms };
    let bounds = null, previousMask = null, peak = null, trough = null, lastTime = -Infinity;
    function png(bytes) {
      const flipped = new Uint8ClampedArray(bytes.length), stride = width * 4;
      for (let row = 0; row < height; row++) flipped.set(bytes.subarray(row * stride, (row + 1) * stride), (height - row - 1) * stride);
      // Match the projection's black backdrop rather than a PNG viewer's transparency color.
      for (let offset = 3; offset < flipped.length; offset += 4) flipped[offset] = 255;
      const copy = document.createElement("canvas"); copy.width = width; copy.height = height;
      copy.getContext("2d").putImageData(new ImageData(flipped, width, height), 0, 0);
      return copy.toDataURL("image/png");
    }
    function sample(time) {
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      if (!bounds) {
        let left = width, right = -1, top = height, bottom = -1;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 4;
          if (pixels[offset] + pixels[offset + 1] + pixels[offset + 2] < 24) continue;
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        if (right < left) throw Error("O quadro da nuvem está vazio.");
        bounds = { left, right, top, bottom };
      }
      const bands = [0, 0, 0, 0], bandCounts = [0, 0, 0, 0], color = [0, 0, 0];
      let lit = 0, clipped = 0, luma = 0, texture = 0, edgeCount = 0, changedMask = 0;
      const mask = new Uint8Array(width * height), pixelHeight = bounds.bottom - bounds.top + 1;
      for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
        const point = y * width + x, offset = point * 4, r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
        const value = (r * .2126 + g * .7152 + b * .0722) / 255;
        if (r + g + b >= 24) {
          mask[point] = 1; lit++; luma += value; color[0] += r; color[1] += g; color[2] += b;
          if (r >= 248 && g >= 248 && b >= 248) clipped++;
          const band = Math.max(0, Math.min(3, Math.floor((y - bounds.top) * 4 / pixelHeight)));
          bands[band] += value; bandCounts[band]++;
          if (x + 2 < width) {
            const next = offset + 8;
            texture += Math.abs(value - (pixels[next] * .2126 + pixels[next + 1] * .7152 + pixels[next + 2] * .0722) / 255); edgeCount++;
          }
        }
        if (previousMask && mask[point] !== previousMask[point]) changedMask++;
      }
      const sumColor = Math.max(1, color.reduce((sum, value) => sum + value, 0));
      const result = { time, light: luma / Math.max(1, lit), litPixels: lit, clippedFraction: clipped / Math.max(1, lit),
        bands: bands.map((sum, index) => sum / Math.max(1, bandCounts[index])), chromaticity: color.map(value => value / sumColor),
        texture: texture / Math.max(1, edgeCount), changedSilhouettePixels: changedMask, yaw: Number(element.dataset.yaw), viewPhase: element.dataset.phase };
      previousMask = mask; samples.push(result);
      if (!peak || result.light > peak.sample.light) peak = { sample: result, bytes: pixels.slice() };
      if (!trough || result.light < trough.sample.light) trough = { sample: result, bytes: pixels.slice() };
    }
    function frame() {
      try {
        if (!element.isConnected || gl.isContextLost()) throw Error("O canvas da nuvem foi substituído ou perdeu o contexto.");
        const time = probe.uniforms.uTime;
        if (time - lastTime >= .2) { sample(time); lastTime = time; }
        if (time - start >= duration) {
          resolve({ durationSeconds: time - start, period, width, height, bounds, uniforms, samples,
            uploads: { arrayBuffer: probe.arrayBufferUploads - before.uploads, arrayBufferSubData: probe.arrayBufferSubUpdates - before.subUpdates },
            uniformTimeUpdates: probe.uniformUpdates - before.uniformUpdates,
            peak: { ...peak.sample, png: png(peak.bytes) }, trough: { ...trough.sample, png: png(trough.bytes) } }); return;
        }
        if (performance.now() - wallStart > (duration + 15) * 1000) throw Error("O relógio uTime não percorreu dois ciclos completos.");
        requestAnimationFrame(frame);
      } catch (error) { reject(error); }
    }
    requestAnimationFrame(frame);
  }));
}

export async function auditPointCloudAnimation({ projection, control, output }) {
  const canvas = projection.getByLabel(CLOUD_LABEL, { exact: true });
  await canvas.waitFor();
  await projection.waitForFunction(label => {
    const element = document.querySelector(`canvas[aria-label="${label}"]`);
    const yaw = Number(element?.dataset.yaw);
    return element?.dataset.phase === "automatic" && Math.abs(Math.atan2(Math.sin(yaw), Math.cos(yaw))) < .018;
  }, CLOUD_LABEL, { timeout: 20000 });
  await canvas.evaluate(element => { window.__auditedPointCloudCanvas = element; });
  const rectangle = await canvas.boundingBox(), x = rectangle.x + rectangle.width / 2, y = rectangle.y + rectangle.height / 2;
  const probe = () => canvas.evaluate(element => ({ ...element.__pointCloudAnimationProbe, uniforms: { ...element.__pointCloudAnimationProbe.uniforms } }));
  const stages = {};
  try {
    await projection.mouse.move(x, y); await projection.mouse.down();
    stages.front = await captureCycles(canvas);
    await projection.screenshot({ path: path.join(output, "animation-front-viewport.png") });
  } finally { await projection.mouse.up(); }
  console.log(`ANIMATION FRONT ${stages.front.durationSeconds.toFixed(2)} s de uTime; dois ciclos completos.`);

  const beforeManual = await probe();
  await projection.mouse.move(x, y); await projection.mouse.down(); await projection.mouse.move(x + 30, y + 10, { steps: 12 });
  await canvas.evaluate(element => new Promise((resolve, reject) => {
    const start = element.__pointCloudAnimationProbe.uniforms.uTime, deadline = performance.now() + 5000;
    function next() {
      if (element.__pointCloudAnimationProbe.uniforms.uTime - start > .3) resolve();
      else if (performance.now() > deadline) reject(Error("uTime parou durante a interação manual."));
      else requestAnimationFrame(next);
    }
    requestAnimationFrame(next);
  }));
  await projection.mouse.up(); await projection.mouse.wheel(0, -100);
  await projection.keyboard.down("Shift"); await projection.mouse.move(x, y); await projection.mouse.down();
  await projection.mouse.move(x + 12, y, { steps: 8 }); await projection.mouse.up(); await projection.keyboard.up("Shift");
  const afterManual = await probe();
  assert(afterManual.uniforms.uTime > beforeManual.uniforms.uTime + .3, "O relógio do shader deve continuar durante giro/zoom/pan manual.");
  await projection.waitForFunction(label => document.querySelector(`canvas[aria-label="${label}"]`)?.dataset.phase === "automatic", CLOUD_LABEL, { timeout: 8000 });
  stages.turn = await captureCycles(canvas);
  await projection.screenshot({ path: path.join(output, "animation-turn-viewport.png") });
  console.log(`ANIMATION TURN ${stages.turn.durationSeconds.toFixed(2)} s de uTime; dois ciclos completos durante o giro.`);

  const failures = [], check = (valid, message) => { if (!valid) failures.push(message); };
  const evidence = { automaticAndManualClock: true, realGpuUniformTime: true, physicalProjector: false,
    manualTimeDelta: afterManual.uniforms.uTime - beforeManual.uniforms.uTime, failures, stages: {} };
  for (const [name, stage] of Object.entries(stages)) {
    check(stage.durationSeconds >= stage.period * 2, `${name}: menos de dois ciclos completos.`);
    check(stage.uniformTimeUpdates > 30, `${name}: uTime não foi atualizado continuamente.`);
    check(stage.uploads.arrayBuffer === 0, `${name}: atributos originais foram reenviados à GPU.`);
    check(stage.uploads.arrayBufferSubData === 0, `${name}: vértices foram alterados por quadro.`);
    const light = stage.samples.map(sample => sample.light), occupancy = stage.samples.map(sample => sample.litPixels);
    const yaw = stage.samples.map(sample => sample.yaw), clipping = stage.samples.map(sample => sample.clippedFraction);
    check(Math.max(...light) - Math.min(...light) > .00005, `${name}: nenhum pulso observado nos pixels.`);
    check(Math.min(...occupancy) / Math.max(...occupancy) > .5, `${name}: a nuvem desapareceu no vale.`);
    check(Math.max(...clipping) < .08, `${name}: excesso de branco recortado no pico.`);
    if (name === "front") check(Math.max(...yaw) - Math.min(...yaw) < .025, "A amostra frontal não manteve o enquadramento estável.");
    else check(Math.max(...yaw) - Math.min(...yaw) > .015, "A segunda amostra não registrou giro lateral real.");
    const waves = [0, 1, 2, 3].map(band => harmonic(stage.samples, band, stage.period));
    const active = waves.filter(wave => wave.relativeAmplitude > .003);
    const phaseDistance = active.flatMap(a => active.map(b => Math.abs(Math.atan2(Math.sin(a.phaseRadians - b.phaseRadians), Math.cos(a.phaseRadians - b.phaseRadians)))));
    const phaseSpread = phaseDistance.length ? Math.max(...phaseDistance) : 0;
    if (name === "front") {
      check(active.length >= 2, "O pulso não foi perceptível em diferentes faixas da plateia.");
      check(phaseSpread > .12, "As faixas pulsaram na mesma fase.");
    }
    const files = {};
    for (const key of ["peak", "trough"]) {
      const filename = `animation-${name}-${key}.png`; files[key] = filename;
      await fs.writeFile(path.join(output, filename), Buffer.from(stage[key].png.split(",")[1], "base64"));
      delete stage[key].png;
    }
    evidence.stages[name] = { ...stage, waves, phaseSpreadRadians: phaseSpread, images: files };
  }
  check(await canvas.evaluate(element => element === window.__auditedPointCloudCanvas), "O canvas foi substituído durante os ciclos/navegação.");
  if (control) {
    const privateTime = await control.getByLabel(CLOUD_LABEL, { exact: true }).evaluate(element => element.__pointCloudAnimationProbe?.uniforms.uTime);
    check(Number.isFinite(privateTime), "O shader não estava ativo no controle.");
  }
  await fs.writeFile(path.join(output, "animation-report.json"), JSON.stringify(evidence, null, 2));
  assert.deepEqual(failures, [], "Falhas na auditoria da respiração; consulte animation-report.json e PNGs.");
  return evidence;
}
