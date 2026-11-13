import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { holdPostDemoOpening } from "./post-demo-opening-browser-audit.js";

// Observe the real engine and Web Audio graph. No fake AudioContext, generated
// test tones, automatic unlock or autoplay-policy override is installed.
export async function installPostDemoAudioProbe(context) {
  await context.addInitScript(() => {
    const probe = { calls: [], sources: [], levels: [], samples: [], contexts: 0 };
    window.__postDemoAudioProbe = probe;
    const seen = new WeakSet(); let currentEngine, currentTyping = null, analyser = null, observedContext = null;
    const at = () => performance.timeOrigin + performance.now();
    function attach(engine) {
      if (!engine.context || !engine.compressor || engine.context === observedContext) return;
      observedContext = engine.context; analyser = engine.context.createAnalyser(); analyser.fftSize = 512;
      engine.compressor.connect(analyser); probe.contexts++;
    }
    function instrument(engine) {
      if (!engine || seen.has(engine)) return engine;
      seen.add(engine);
      const ensure = engine.ensureContext, typing = engine.typing, track = engine.trackSource, blip = engine.computerBlip;
      engine.ensureContext = function (...args) { const result = ensure.apply(this, args); attach(this); return result; };
      engine.typing = function (character, options = {}) {
        const previous = currentTyping;
        currentTyping = { at: at(), character, localOnly: options.localOnly === true, volumeScale: options.volumeScale ?? 1 };
        probe.calls.push(currentTyping);
        try { return typing.call(this, character, options); } finally { currentTyping = previous; }
      };
      engine.trackSource = function (source, ...args) {
        probe.sources.push({ at: at(), type: source.constructor.name, character: currentTyping?.character,
          localOnly: currentTyping?.localOnly, volumeScale: currentTyping?.volumeScale });
        return track.call(this, source, ...args);
      };
      engine.computerBlip = function (options) {
        probe.levels.push({ at: at(), level: options.level, character: currentTyping?.character,
          localOnly: currentTyping?.localOnly, volumeScale: currentTyping?.volumeScale });
        return blip.call(this, options);
      };
      attach(engine); return engine;
    }
    Object.defineProperty(window, "__caixaPretaRobotSoundEngine", { configurable: true,
      get: () => currentEngine, set: value => { currentEngine = instrument(value); } });
    window.setInterval(() => {
      if (!currentEngine) return;
      attach(currentEngine);
      if (!analyser || currentEngine.context?.state !== "running") return;
      const values = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(values);
      let square = 0, peak = 0;
      for (const value of values) { square += value * value; peak = Math.max(peak, Math.abs(value)); }
      probe.samples.push({ at: at(), rms: Math.sqrt(square / values.length), peak });
    }, 20);
  });
}

export function createPostDemoAudioAudit({ context, projection, control, base, output }) {
  const url = new URL(base);
  assert(["localhost", "127.0.0.1"].includes(url.hostname) && url.port && url.port !== "3000", "A auditoria de áudio exige servidor isolado.");
  const report = { ok: false, physicalAudio: false, realWebAudio: true, autoplayBypassed: false, windows: [], checks: [] };
  let pages = [projection, control], cardMarked = false;
  async function get(route) { const r = await fetch(base + route); assert(r.ok, route); return r.json(); }
  const state = () => get("/api/state");
  async function post(route, body) {
    const r = await fetch(base + route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await r.json(); assert(r.ok, JSON.stringify(result)); return result;
  }
  const command = async (action, data = {}) => post("/api/post-demo", { action, sessionId: (await state()).reliability.sessionId, ...data });
  async function poll(run, label, timeout = 12000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const result = await run(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 65)); }
    throw Error(`Timeout: ${label}`);
  }
  const renderedTime = seconds => control.evaluate(duration => new Promise(resolve => {
    const start = performance.now(); const frame = () => performance.now() - start >= duration * 1000 ? resolve() : requestAnimationFrame(frame);
    requestAnimationFrame(frame);
  }), seconds);
  async function snapshot(page) {
    return page.evaluate(() => {
      const probe = window.__postDemoAudioProbe, engine = window.__caixaPretaRobotSoundEngine;
      return { url: location.href, id: new URLSearchParams(location.search).get("projectionWindow") || sessionStorage.getItem("caixa-preta.projectionWindowId"),
        calls: probe.calls, sources: probe.sources, levels: probe.levels, samples: probe.samples,
        context: engine?.context?.state, activeSources: engine?.activeSources?.size || 0,
        masterVolume: engine?.settings.masterVolume, masterGain: engine?.masterGain?.gain.value,
        relaySinks: engine?.relaySinks?.size || 0, relaySinkId: engine?.relaySinkId,
        freshRelaySinkIds: [...(engine?.relaySinks || [])].filter(([, seenAt]) => Date.now() - seenAt <= 2600).map(([id]) => id),
        sinkUsers: engine?.relaySinkUsers || 0, contexts: probe.contexts };
    });
  }
  const snapshots = () => Promise.all(pages.map(snapshot));
  async function unlock() {
    await control.getByLabel("Fala da ilha futura", { exact: true }).click();
    await poll(async () => (await snapshot(control)).context === "running", "clique real desbloqueia a saída privada de áudio");
    if (!projection.isClosed()) await poll(async () => {
      const output = await snapshot(control), source = await snapshot(projection);
      return source.freshRelaySinkIds.length === 1 && source.freshRelaySinkIds[0] === output.relaySinkId;
    }, "projeção descobre somente o sink privado atual desbloqueado");
  }
  async function measure(label, owner, scale = 1, duration = .38) {
    await renderedTime(.12);
    const before = await snapshots(); await renderedTime(duration); const after = await snapshots();
    const metrics = after.map((value, index) => ({ url: value.url, id: value.id,
      calls: value.calls.slice(before[index].calls.length), sources: value.sources.slice(before[index].sources.length),
      levels: value.levels.slice(before[index].levels.length), samples: value.samples.slice(before[index].samples.length),
      context: value.context, masterVolume: value.masterVolume, masterGain: value.masterGain }));
    const ownerIndex = pages.indexOf(owner), outputIndex = pages.indexOf(control);
    assert(ownerIndex >= 0 && outputIndex >= 0);
    for (let index = 0; index < metrics.length; index++) {
      const emitted = metrics[index].calls.filter(value => !value.localOnly);
      assert(index === ownerIndex ? emitted.length >= 3 : emitted.length === 0, `${label}: emissor de áudio duplicado/ausente em ${metrics[index].url}`);
      assert(metrics[index].calls.every(value => value.volumeScale === scale), `${label}: escala de volume não preservada na origem/relay.`);
      if (index !== outputIndex) assert.equal(metrics[index].sources.length, 0, `${label}: uma janela pública também sintetizou a voz relayed.`);
    }
    assert(metrics[outputIndex].sources.length > 0, `${label}: o sink privado não criou fontes Web Audio.`);
    assert(metrics[outputIndex].samples.some(value => value.peak > .00001 && value.rms > .000001), `${label}: o AnalyserNode não observou sinal no grafo real.`);
    assert.equal(metrics[outputIndex].context, "running");
    const rawVolume = (await state()).robotSound.masterVolume;
    assert.equal(metrics[outputIndex].masterVolume, rawVolume, `${label}: volume geral foi multiplicado novamente no masterVolume do sink.`);
    const window = { label, scale, ownerId: metrics[ownerIndex].id, outputId: metrics[outputIndex].id, metrics };
    report.windows.push(window); return window;
  }
  async function quiet(label, { textContinues = false } = {}) {
    await renderedTime(.24);
    await poll(async () => (await snapshots()).every(value => value.activeSources === 0), `${label}: término das fontes Web Audio curtas`);
    const before = await snapshots(), textBefore = textContinues ? await control.getByLabel("Fala da ilha futura", { exact: true }).innerText() : null;
    await renderedTime(.24);
    const after = await snapshots();
    for (let index = 0; index < after.length; index++) {
      assert.equal(after[index].calls.length, before[index].calls.length, `${label}: typing continuou emitindo eventos.`);
      assert.equal(after[index].sources.length, before[index].sources.length, `${label}: novas fontes de áudio apareceram.`);
      const samples = after[index].samples.slice(before[index].samples.length);
      assert(samples.every(value => value.rms < .0001), `${label}: o grafo não ficou silencioso após a cauda das teclas.`);
    }
    if (textContinues) assert((await control.getByLabel("Fala da ilha futura", { exact: true }).innerText()).length > textBefore.length,
      `${label}: o teste de volume pausou a digitação.`);
    report.checks.push(label);
  }
  function compareQuarter(full, quarter) {
    const letterLevels = window => window.metrics.flatMap(value => value.levels).filter(value => /[\p{L}\p{N}]/u.test(value.character || "")).map(value => value.level);
    const fullLevels = letterLevels(full), quarterLevels = letterLevels(quarter);
    assert(fullLevels.length && quarterLevels.length, "Faltou amostrar níveis de letras nos dois volumes.");
    const relative = Math.max(...quarterLevels) / Math.max(...fullLevels);
    assert(Math.abs(relative - .25) < .001, "O volume .25 foi perdido ou multiplicado duas vezes no caminho de áudio.");
    report.checks.push(`${quarter.label}: nível da letra em 25% aplicado uma vez`);
  }
  async function volume(value) {
    await post("/api/global-volume", { volume: value });
    await poll(async () => (await state()).globalVolume === value, "volume geral salvo");
    await renderedTime(.12);
  }
  async function disconnect(page) {
    const { id } = await snapshot(page);
    if (id && (await state()).projection.windows[id]) await post("/api/projection", { action: "disconnect", projectionWindowId: id });
    await page.close(); pages = pages.filter(value => value !== page);
  }
  return {
    report,
    quiet,
    async startOpening(gate) {
      await unlock();
      const first = await measure("opening-public-to-private", projection);
      const openingId = (await state()).postDemo.opening.id;
      await command("pause"); await quiet("opening-pause-is-quiet");
      assert.equal((await state()).postDemo.opening.id, openingId);
      await command("resume"); await measure("opening-resume-public-to-private", projection);
      await volume(0); await quiet("global-zero-relay-is-quiet-with-typing", { textContinues: true });
      await volume(.25); const quarter = await measure("opening-quarter-relay", projection, .25); compareQuarter(first, quarter);
      await volume(1);
      const extra = await context.newPage(); await gate.addPage(extra); pages.push(extra);
      try {
        await extra.goto(base + "/pos-demo?projectionWindow=pos-demo-audio-secondary", { waitUntil: "domcontentloaded" });
        await poll(async () => (await state()).projection.activeProjectionWindowId === "pos-demo-audio-secondary", "segunda projeção eleita como fonte");
        await poll(async () => (await snapshot(extra)).freshRelaySinkIds.includes((await snapshot(control)).relaySinkId), "segunda projeção encontra a saída privada");
        await measure("two-public-windows-one-emitter", extra);
      } finally { await disconnect(extra); }
      await measure("primary-source-returns-after-second-window-closes", projection);
      report.checks.push("abertura com áudio Web Audio real; um emissor entre privada e duas projeções; um sink privado; sem bypass de autoplay");
    },
    async finishOpening() { await quiet("opening-completed-is-quiet-before-ack"); },
    async prepareCard() { await unlock(); cardMarked = true; },
    async firstCard() { assert(cardMarked); await measure("first-card-public-to-private", projection); },
    async privateOnly() {
      // The main test has already checked the fresh session remains idle. Explicitly
      // enter that fixture now, with the public windows closed and parameters hidden.
      await disconnect(projection);
      const own = (await get("/api/post-demo")).postDemo.config;
      const originalVolume = (await state()).globalVolume;
      const originalSound = (await state()).robotSound;
      let gate;
      try {
        await command("config", { config: { typingIntervalMs: 40, typingPauseMs: 0 } });
        // A new show clears the projection registry. Re-enter the controller to
        // remount its real registration/entry effects, retaining its opening ACK.
        gate = await holdPostDemoOpening([control]);
        await control.reload({ waitUntil: "domcontentloaded" });
        const toggle = control.locator('[aria-controls="post-demo-parameters"]');
        await poll(async () => await toggle.count() > 0 && await toggle.isEnabled(), "preferência do painel carregada na nova sessão");
        if (await control.getByRole("button", { name: "Recolher parâmetros", exact: true }).count()) await control.getByRole("button", { name: "Recolher parâmetros", exact: true }).click();
        assert.equal(await control.locator("#post-demo-parameters").count(), 0);
        await command("enter");
        await control.getByLabel("Fala da ilha futura", { exact: true }).waitFor(); await unlock();
        const first = await measure("collapsed-private-only-local", control);
        await volume(0); await quiet("global-zero-local-is-quiet-with-typing", { textContinues: true });
        await volume(.25); const quarter = await measure("collapsed-private-quarter-local", control, .25); compareQuarter(first, quarter);
        await volume(1);
        await post("/api/robot-sound", { settings: { enabled: false } }); await renderedTime(.12);
        await quiet("sound-disabled-is-quiet-with-typing", { textContinues: true });
        await post("/api/robot-sound", { settings: { enabled: true } }); await renderedTime(.12);
        await measure("collapsed-private-restored-before-stopall", control);
        await post("/api/operator", { command: "/stopall" });
        await quiet("stopall-during-opening-is-quiet");
        assert.equal((await state()).postDemo.active, false);
        assert.equal((await state()).postDemo.totalRounds, 0);
        report.checks.push("controle único recolhido continua audível; mute/enabled respeitados sem interromper texto; STOP ALL interrompe áudio e digitação");
        report.ok = true;
      } finally {
        await command("pause"); await gate?.dispose();
        await command("config", { config: { typingIntervalMs: own.typingIntervalMs, typingPauseMs: own.typingPauseMs } });
        await post("/api/robot-sound", { settings: originalSound }); await volume(originalVolume);
      }
    },
    async save(error) {
      if (error) { report.ok = false; report.error = error.stack || String(error); }
      await fs.writeFile(path.join(output, "post-demo-audio-report.json"), JSON.stringify(report, null, 2));
    }
  };
}
