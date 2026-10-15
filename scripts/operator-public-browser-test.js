import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

// Requires an isolated, built source copy. Never resets the operator's running session.
const auditRoot = await prepareOperatorAudit();
const base = "http://127.0.0.1:3311";
const output = path.resolve(process.env.CAIXA_PRETA_AUDIT_OUTPUT || "artifacts/operator-public-2026-10-15");
await fs.mkdir(output, { recursive: true });
const fixture = path.join(auditRoot, "operator-mock.json");
await fs.writeFile(fixture, JSON.stringify({ mode: "stream" }));
let occupied = false;
try { await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }); occupied = true; } catch {}
assert(!occupied, "Dedicated audit port 3311 is occupied; no existing process will be stopped");
let log = "";
function startServer() {
const child = spawn(process.execPath, ["--import", fileURLToPath(new URL("./operator-public-mock.js", import.meta.url)),
  "node_modules/next/dist/bin/next", "start", "--port", "3311", "--hostname", "127.0.0.1"], {
  cwd: auditRoot, env: { ...process.env, OPENAI_API_KEY: "audit-only", OPENAI_SHOW_TIMEOUT_MS: "5000",
    CAIXA_PRETA_SHOW_RUNTIME_DIR: path.join(auditRoot, "runtime"), CAIXA_PRETA_OPERATOR_MOCK: fixture },
  stdio: ["ignore", "pipe", "pipe"]
});
child.stdout.on("data", (chunk) => { log += chunk; });
child.stderr.on("data", (chunk) => { log += chunk; });
return child;
}
let server = startServer();
let browser;
const checks = [];
async function post(route, body) {
  const response = await fetch(`${base}${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  assert(response.ok, JSON.stringify(data));
  return data;
}
const state = async () => (await fetch(`${base}/api/state`)).json();
async function poll(predicate, label, timeout = 10000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { if (await predicate()) return; await new Promise((resolve) => setTimeout(resolve, 50)); }
  throw new Error(`Timeout: ${label}`);
}
try {
  await poll(async () => { try { return (await fetch(`${base}/api/health?skipOptional=1`)).ok; } catch { return false; } }, "server ready", 30000);
  await post("/api/show-session", { action: "new" });
  await post("/api/audience-warmup", { action: "unlock-boot" });
  browser = await chromium.launch({ headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const projection = await context.newPage();
  const operator = await context.newPage();
  const errors = [];
  for (const page of [projection, operator]) page.on("pageerror", (error) => errors.push(error.message));
  await projection.goto(base, { waitUntil: "domcontentloaded" });
  await operator.goto(`${base}/operator`, { waitUntil: "domcontentloaded" });
  const settings = operator.getByLabel("Parâmetros ajustáveis do bot", { exact: true });
  await settings.getByRole("slider", { name: "SARCASMO", exact: true }).waitFor();
  assert.equal(await operator.getByRole("textbox").count(), 0, "Operator tab contains settings, without conversation or technical command input");
  assert.equal(await operator.getByRole("log").count(), 0);
  for (const label of ["REVELAR OPERATOR", "MUDAR PARA TELA", "INICIAR JOGO DAS MALAS", "ATIVAR MODO EMERGÊNCIA"]) {
    assert.equal(await operator.getByRole("button", { name: label, exact: true }).count(), 0);
  }
  const legacySound = { ...(await state()).robotSound };
  delete legacySound.typingPauseMs;
  delete legacySound.messageGapMs;
  await operator.route("**/api/robot-sound", (route) => route.request().method() === "POST"
    ? route.fulfill({ contentType: "application/json", body: JSON.stringify({ robotSound: legacySound }) }) : route.continue());
  const pauseControl = settings.getByRole("slider", { name: "Pausa na pontuação do bot", exact: true });
  await pauseControl.fill("700");
  await settings.getByRole("alert").waitFor();
  await post("/api/robot-sound", { settings: { typingFrequency: .35 } });
  await operator.waitForTimeout(250);
  assert.equal(await pauseControl.inputValue(), "700", "an unconfirmed server value cannot reset the edited handle");
  await operator.unroute("**/api/robot-sound");
  await settings.getByRole("button", { name: "TENTAR SALVAR NOVAMENTE", exact: true }).click();
  await poll(async () => (await state()).robotSound.typingPauseMs === 700, "retry saves the retained draft");
  await settings.getByRole("alert").waitFor({ state: "detached" });
  await operator.route("**/api/robot-sound", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 300));
    return route.fulfill({ response });
  });
  for (const name of ["Velocidade da digitação do robô", "Pausa na pontuação do bot", "Intervalo entre falas do bot"]) {
    const range = settings.getByRole("slider", { name, exact: true });
    const box = await range.boundingBox();
    await operator.mouse.move(box.x + box.width * .2, box.y + box.height / 2);
    await operator.mouse.down();
    for (const position of [.4, .75, .6]) {
      await operator.mouse.move(box.x + box.width * position, box.y + box.height / 2);
      await operator.waitForTimeout(180);
    }
    await operator.mouse.up();
    const chosen = Number(await range.inputValue());
    await operator.waitForTimeout(1000);
    assert.equal(Number(await range.inputValue()), chosen, `${name}: delayed acknowledgements must not move the handle back`);
  }
  await operator.unroute("**/api/robot-sound");
  checks.push("timing handles retain unconfirmed edits, retry successfully and stay stable during continuous drag with delayed responses");
  await settings.getByRole("slider", { name: "Velocidade da digitação do robô", exact: true }).fill("20");
  await settings.getByRole("slider", { name: "Pausa na pontuação do bot", exact: true }).fill("300");
  await settings.getByRole("slider", { name: "Intervalo entre falas do bot", exact: true }).fill("700");
  await settings.getByRole("slider", { name: "SARCASMO", exact: true }).fill("45");
  await poll(async () => { const s = await state(); return s.robotSound.typingIntervalMs === 50
    && s.robotSound.typingPauseMs === 300 && s.robotSound.messageGapMs === 700 && s.operatorPublic.personality.sarcasm === 45; }, "Operator settings persist");
  await settings.getByRole("combobox", { name: "Modelo GPT", exact: true }).selectOption("gpt-5-nano");
  await poll(async () => (await state()).model === "gpt-5-nano", "model adjustment");
  await operator.reload({ waitUntil: "domcontentloaded" });
  await poll(async () => await settings.getByRole("slider", { name: "Pausa na pontuação do bot", exact: true }).inputValue() === "300", "settings recovered after reload");
  await operator.screenshot({ path: path.join(output, "operator-settings.png") });
  await projection.evaluate(() => {
    window.__typingEvents = [];
    new MutationObserver(() => {
      const text = (document.querySelector('[aria-label="Fala atual da Caixa Preta"] p')?.textContent || "").replace(/_$/, "");
      if (text && text !== window.__typingEvents.at(-1)?.text) window.__typingEvents.push({ text, at: performance.now() });
    }).observe(document.body, { subtree: true, characterData: true, childList: true });
  });
  await fs.writeFile(fixture, JSON.stringify({ mode: "stream", principalText: "A,B." }));
  await post("/api/operator", { command: "/say A,B." });
  await projection.waitForFunction(() => window.__typingEvents.some(({ text }) => text === "A,B."));
  await fs.writeFile(fixture, JSON.stringify({ mode: "stream", principalText: "Z" }));
  await post("/api/operator", { command: "/say Z" });
  await projection.waitForFunction(() => window.__typingEvents.some(({ text }) => text === "Z"));
  const timingEvents = await projection.evaluate(() => window.__typingEvents);
  const typedAt = (text) => timingEvents.find((event) => event.text === text)?.at;
  const measuredTiming = { punctuationMs: typedAt("A,B") - typedAt("A,"), gapMs: typedAt("Z") - typedAt("A,B."), events: timingEvents };
  assert(measuredTiming.punctuationMs >= 290, JSON.stringify(measuredTiming));
  assert(measuredTiming.gapMs >= 650, JSON.stringify(measuredTiming));
  await fs.writeFile(path.join(output, "typing-timing.json"), JSON.stringify(measuredTiming, null, 2));
  await fs.writeFile(fixture, JSON.stringify({ mode: "stream" }));
  checks.push("actual projected typing respects punctuation pause and minimum interval between lines");
  await post("/api/robot-sound", { settings: { typingIntervalMs: 60, typingPauseMs: 0, messageGapMs: 0 } });
  await post("/api/operator", { command: "/model gpt-5-mini" });
  checks.push("Operator tab: bot settings only, speed/punctuation/gap/personality/model persist and recover after reload");
  await settings.getByRole("slider", { name: "Velocidade da digitação do robô", exact: true }).fill("10");
  await poll(async () => (await state()).robotSound.typingIntervalMs === 100, "slow Operator typing configured privately");
  await post("/api/operator-public", { action: "patch", visible: true });
  const pacedText = "ABCDEFGHIJ KLMNOPQRSTUVWXYZ 0123456789.";
  await fs.writeFile(fixture, JSON.stringify({ mode: "stream", chunks: [...pacedText], delay: 20 }));
  const pacedRequest = post("/api/operator-public", { action: "send", text: "Ensaio de ritmo", requestId: "paced-typing-probe" });
  const pacedReply = projection.locator('[data-message-id="bot-paced-typing-probe"] p');
  await poll(async () => (await state()).operatorPublic.status === "generating"
    && await pacedReply.count() > 0 && (await pacedReply.innerText()).replace(/_$/, "").length > 0, "characters appear while SDK stream is still active");
  await pacedRequest;
  const afterStream = (await pacedReply.innerText()).replace(/_$/, "");
  assert(afterStream.length > 0 && afterStream.length < pacedText.length, "SDK completion must not dump the remaining text");
  const changedAt = Date.now();
  await settings.getByRole("slider", { name: "Velocidade da digitação do robô", exact: true }).fill("60");
  await projection.waitForFunction(() => document.querySelector('[data-message-id="bot-paced-typing-probe"] p')?.textContent === "ABCDEFGHIJ KLMNOPQRSTUVWXYZ 0123456789.");
  const speedChangeMs = Date.now() - changedAt;
  assert(speedChangeMs < 1800, `private speed update must accelerate the pending characters (${speedChangeMs} ms)`);
  await fs.writeFile(path.join(output, "operator-typing.json"), JSON.stringify({ pacedText, afterStream, speedChangeMs }, null, 2));
  await post("/api/operator-public", { action: "patch", visible: false });
  await post("/api/robot-sound", { settings: { typingIntervalMs: 60 } });
  await fs.writeFile(fixture, JSON.stringify({ mode: "stream" }));
  checks.push("LIVE Operator types during streaming, drains its buffer after SDK completion and follows private speed changes immediately");
  // The launcher controller normally routes the projection to Principal. This audit
  // navigates that window directly later, so leave its navigation command untouched.
  await operator.route("**/api/projection", (route) => {
    if (route.request().method() === "POST" && route.request().postDataJSON()?.action === "navigate") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });
  await operator.goto(`${base}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  await post("/api/scene-zero", { action: "set-stage", stage: "glitch" });
  await projection.evaluate(() => { window.__originalNode = document.querySelector('[aria-label="Chat publico"]'); });
  const original = await state();
  await post("/api/scene-zero", { action: "timer-start" });
  const timerBefore = (await state()).sceneZero.timer;
  const revealResponse = operator.waitForResponse((response) => response.url().endsWith("/api/operator-public"));
  await operator.getByRole("button", { name: "REVELAR OPERATOR", exact: true }).click();
  const revealed = await revealResponse;
  assert(revealed.ok(), `reveal HTTP ${revealed.status()}: ${await revealed.text()}`);
  await projection.locator('[data-operator-visible="true"]').waitFor();
  await projection.waitForTimeout(500);
  assert(await projection.evaluate(() => window.__originalNode === document.querySelector('[aria-label="Chat publico"]')), "Chat DOM must survive reveal");
  assert.equal((await state()).sceneZero.stage, original.sceneZero.stage);
  assert.equal((await state()).sceneZero.timer.endsAt, timerBefore.endsAt, "Reveal must not restart a timer");
  const geometry = await projection.locator("[data-projection-original]").boundingBox();
  assert(Math.abs(geometry.width - 832) < 2, JSON.stringify(geometry));
  assert(geometry.y > 120 && geometry.y < 130, "Entire original viewport is fitted, not cropped");
  checks.push("reveal 65/35, original node and scene preserved at 1280x720");
  await operator.getByRole("button", { name: "VOLTAR AOS CONTROLES", exact: true }).waitFor();

  assert.equal(await projection.getByText("CANAL ABERTO.", { exact: true }).count(), 0);
  const publicInput = projection.getByRole("textbox", { name: "OPERADOR >", exact: true });
  assert.equal(await publicInput.isEditable(), true, "Public Operator must accept text directly");
  await publicInput.click();
  await publicInput.pressSequentially("Vamos continuar a peça?", { delay: 85 });
  assert.equal(await publicInput.inputValue(), "Vamos continuar a peça?", "ordinary typing survives realtime updates");
  await poll(async () => (await state()).operatorPublic.draft === "Vamos continuar a peça?", "public draft persisted");
  await poll(async () => (await operator.getByLabel("OPERADOR >", { exact: false }).inputValue()) === "Vamos continuar a peça?", "public typing mirrored to private controller");
  const publicSlider = projection.getByRole("slider", { name: "SARCASMO", exact: true });
  assert.equal(await publicSlider.isEnabled(), true, "public handles must be interactive");
  await publicSlider.fill("20");
  const publicBox = await publicSlider.boundingBox();
  await projection.mouse.move(publicBox.x + publicBox.width * .20, publicBox.y + publicBox.height / 2);
  await projection.mouse.down();
  await projection.mouse.move(publicBox.x + publicBox.width * .90, publicBox.y + publicBox.height / 2, { steps: 12 });
  await projection.mouse.up();
  await poll(async () => (await state()).operatorPublic.personality.sarcasm >= 88, "public mouse drag changes actual parameter");
  const publicPercent = (await state()).operatorPublic.personality.sarcasm;
  await poll(async () => Number(await operator.getByRole("slider", { name: "SARCASMO", exact: true }).inputValue()) === publicPercent, "public slider mirrored to private controller");
  const mainHistoryLength = (await state()).conversation.length;
  await publicInput.press("Enter");
  await poll(async () => { const c = (await state()).operatorPublic; return c.messages.at(-1)?.status === "complete" && c.messages.at(-1)?.content === "ESTOU AQUI ENQUANTO A CENA CONTINUA."; }, "conversation submitted from public Operator");
  await poll(async () => (await publicInput.inputValue()) === "", "public composer cleared after send");
  assert.equal((await state()).conversation.length, mainHistoryLength);
  assert.equal(await projection.getByRole("button", { name: /INTERROMPER DESVIO/ }).count(), 0);
  const publicSendBox = await projection.getByRole("button", { name: "ENVIAR", exact: true }).boundingBox();
  assert(publicSendBox.y + publicSendBox.height <= 720, "public input and send button must fit the projection");
  checks.push("public Operator: real keystrokes, draggable handles, private synchronization and Enter submit; no private commands");

  const input = operator.getByLabel("OPERADOR >", { exact: false });
  await input.fill("Você pode parar de olhar o Instagram?");
  await poll(async () => (await state()).operatorPublic.draft.includes("Instagram"), "draft sync");
  await poll(async () => (await publicInput.inputValue()) === "Você pode parar de olhar o Instagram?", "private draft mirrored to public editable input");
  const slider = operator.getByRole("slider", { name: "SARCASMO", exact: true });
  await slider.fill("20");
  await poll(async () => (await state()).operatorPublic.personality.sarcasm === 20, "slider 20");
  const box = await slider.boundingBox();
  await operator.mouse.move(box.x + box.width * .20, box.y + box.height / 2);
  await operator.mouse.down();
  await operator.mouse.move(box.x + box.width * .90, box.y + box.height / 2, { steps: 12 });
  await operator.mouse.up();
  await poll(async () => (await state()).operatorPublic.personality.sarcasm >= 88, "drag slider");
  const percent = (await state()).operatorPublic.personality.sarcasm;
  await poll(async () => Number(await projection.getByRole("slider", { name: "SARCASMO", exact: true }).inputValue()) === percent, "public slider mirror");
  await operator.getByRole("button", { name: "Diminuir SARCASMO", exact: true }).click();
  await poll(async () => (await state()).operatorPublic.personality.sarcasm === percent - 5, "minus five");
  checks.push("draft, native slider mouse drag, percentages, +/-5 and public synchronization");

  const beforeConversation = (await state()).conversation.length;
  await operator.getByRole("button", { name: "ENVIAR", exact: true }).click();
  await poll(async () => { const c = (await state()).operatorPublic; return c.status === "generating" && c.messages.at(-1)?.content.length > 0; }, "real progressive deltas from mock transport");
  const intermediate = (await state()).operatorPublic.messages.at(-1).content;
  await poll(async () => (await state()).operatorPublic.status === "idle", "stream complete");
  assert(intermediate.length < (await state()).operatorPublic.messages.at(-1).content.length);
  assert.equal((await state()).conversation.length, beforeConversation, "parallel chat cannot overwrite main conversation");
  const request = JSON.parse(await fs.readFile(`${fixture}.request.json`, "utf8"));
  assert.equal(request.stream, true);
  assert(!request.tools, "parallel dialogue has no operational tools");
  assert(JSON.stringify(request).includes(`SARCASMO: ${percent - 5}%`));
  assert(request.input.some(({ content }) => typeof content === "string" && content.includes('"scene":"glitch"')));
  await post("/api/operator-public", { action: "patch", personality: { sarcasm: 10 } });
  await post("/api/chat", { message: "Uma intervenção curta sem comandos." });
  const principalRequest = JSON.parse(await fs.readFile(`${fixture}.request.json`, "utf8"));
  assert(principalRequest.input.some(({ content }) => typeof content === "string" && content.includes("SARCASMO: 10%")));
  await post("/api/operator-public", { action: "patch", personality: { sarcasm: percent - 5 } });
  checks.push("progressive SDK stream, personality/context sent, no tools, principal history independent");

  await operator.getByRole("button", { name: "OCULTAR OPERATOR", exact: true }).last().click();
  await projection.locator('[data-operator-visible="false"]').waitFor();
  await operator.getByRole("button", { name: "REVELAR OPERATOR", exact: true }).last().click();
  await projection.locator('[data-operator-visible="true"]').waitFor();
  await projection.reload({ waitUntil: "domcontentloaded" });
  await projection.getByRole("log").getByText("ESTOU AQUI ENQUANTO A CENA CONTINUA.", { exact: true }).last().waitFor();
  assert.equal(await projection.getByRole("slider", { name: "SARCASMO", exact: true }).inputValue(), String(percent - 5));
  checks.push("hide/reopen and reload recover full history/personality");

  await fs.writeFile(fixture, JSON.stringify({ chunks: ["ANTES ", "DEPOIS_DO_CANCELAMENTO"], delay: 800 }));
  const pending = post("/api/operator-public", { action: "send", text: "continue", requestId: "cancel-probe" });
  await poll(async () => (await state()).operatorPublic.messages.at(-1)?.content === "ANTES ", "first cancellable delta");
  await post("/api/operator-public", { action: "cancel" });
  await pending;
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert.equal((await state()).operatorPublic.messages.at(-1).content, "ANTES ");
  assert.equal((await state()).operatorPublic.messages.at(-1).status, "cancelled");
  const count = (await state()).operatorPublic.messages.length;
  await post("/api/operator-public", { action: "send", text: "continue", requestId: "cancel-probe" });
  assert.equal((await state()).operatorPublic.messages.length, count);
  checks.push("cancellation discards late tokens; request idempotency");

  const stopping = post("/api/operator-public", { action: "send", text: "stop all", requestId: "stop-all-probe" });
  await poll(async () => (await state()).operatorPublic.status === "generating", "stop-all active generation");
  await post("/api/operator", { command: "/stopall" });
  await stopping;
  assert.equal((await state()).operatorPublic.messages.at(-1).status, "cancelled");
  await post("/api/reliability", { action: "emergency-on" });
  const emergency = await post("/api/operator-public", { action: "send", text: "emergency", requestId: "emergency-probe" });
  assert(emergency.generationError);
  assert.equal((await state()).operatorPublic.status, "idle");
  await post("/api/reliability", { action: "emergency-off" });
  checks.push("STOP ALL cancels parallel generation; emergency blocks model and retains manual control");

  await fs.writeFile(fixture, JSON.stringify({ activity: "instagram" }));
  await context.route("**/api/instagram/frame?*", (route) => route.fulfill({ contentType: "application/json",
    body: JSON.stringify({ image: `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="430" height="760"><rect width="430" height="760" fill="#123322"/><text x="20" y="80" fill="white">FRAME DE TESTE ${Date.now()}</text></svg>`).toString("base64")}`, viewport: { width: 430, height: 760 } }) }));
  await post("/api/chat", { message: "Atividade sintética para testar simultaneidade." });
  await projection.getByLabel("Instagram real embutido", { exact: true }).waitFor();
  await projection.evaluate(() => { window.__instagramNode = document.querySelector('[aria-label="Instagram real embutido"]'); });
  const instagramBefore = (await state()).instagram;
  await post("/api/operator-public", { action: "patch", visible: false });
  await post("/api/operator-public", { action: "patch", visible: true });
  await post("/api/operator-public", { action: "send", text: "Você continua no Instagram?", requestId: "instagram-parallel" });
  assert.equal((await state()).instagram.status, instagramBefore.status);
  assert(await projection.evaluate(() => window.__instagramNode === document.querySelector('[aria-label="Instagram real embutido"]')));
  const instagramRequest = JSON.parse(await fs.readFile(`${fixture}.request.json`, "utf8"));
  assert(instagramRequest.input.some(({ content }) => typeof content === "string" && content.includes('"status":"NAVIGATING"')));
  checks.push("synthetic Instagram frame and DOM retained through reveal/conversation, factual activity context");

  await fs.writeFile(fixture, JSON.stringify({ mode: "failure" }));
  await post("/api/operator-public", { action: "send", text: "falha", requestId: "fail-probe" });
  assert.equal((await state()).operatorPublic.status, "idle");
  assert.equal((await state()).operatorPublic.messages.at(-1).status, "fallback");
  await post("/api/operator-public", { action: "return", requestId: "return-probe" });
  const resumed = await state();
  assert.equal(resumed.instagram.embeddedPanelVisible, false);
  assert.equal(resumed.operatorPublic.messages.at(-1).content, "Está bem. Eu volto. Mas não confunda isso com obediência.");
  assert.equal(resumed.operatorPublic.error, undefined);
  assert.equal(resumed.operatorPublic.changes, undefined);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal((await state()).instagram.status, "DISCONNECTED", "late Instagram callback cannot reopen the panel");
  assert.equal((await state()).sceneZero.suitcaseGame.instagram.status, "stopped", "late session error cannot overwrite return");
  await projection.getByRole("log").getByText("Está bem. Eu volto. Mas não confunda isso com obediência.", { exact: true }).waitFor();
  assert.equal(await projection.getByRole("button", { name: /INTERROMPER DESVIO/ }).count(), 0);
  checks.push("OpenAI failure releases controls; deterministic return, safe fallback, private controls excluded");
  await fs.writeFile(fixture, JSON.stringify({ mode: "partial-failure", chunks: ["Resposta cortada"], delay: 100 }));
  await post("/api/operator-public", { action: "return", requestId: "partial-return-probe" });
  assert.equal((await state()).operatorPublic.messages.at(-1).content, "Está bem. Eu volto. Mas não confunda isso com obediência.");
  checks.push("failed partial return generation is replaced by the complete safe justification");

  await context.route("**/api/events?client=public-display", (route) => route.abort());
  await projection.reload({ waitUntil: "domcontentloaded" });
  await post("/api/operator-public", { action: "patch", personality: { curiosity: 95 } });
  await poll(async () => await projection.getByRole("slider", { name: "CURIOSIDADE", exact: true }).inputValue() === "95", "SSE blocked reconciliation");
  checks.push("revision polling recovers operator state while SSE is blocked");
  await context.unroute("**/api/events?client=public-display");
  await projection.setViewportSize({ width: 1920, height: 1080 });
  await projection.reload({ waitUntil: "domcontentloaded" });
  await projection.locator('[data-operator-visible="true"]').waitFor();
  await projection.waitForTimeout(500);
  await projection.screenshot({ path: path.join(output, "projection-1920.png") });
  const fitted = await projection.locator("[data-projection-original]").boundingBox();
  assert(Math.abs(fitted.width - 1248) < 2);
  await projection.setViewportSize({ width: 1280, height: 720 });
  await projection.waitForTimeout(500);
  await projection.screenshot({ path: path.join(output, "projection-1280.png") });
  await operator.screenshot({ path: path.join(output, "operator-private.png") });

  await projection.goto(`${base}/transicao-psicodelica`, { waitUntil: "domcontentloaded" });
  await projection.locator('[data-operator-visible="true"]').waitFor();
  await post("/api/controller-cues/play", { controllerId: "transicao-psicodelica", cue: {
    id: "operator-video-retention", type: "video", label: "Retention test", assetPath: "videos/glitch/painel-aeroporto.mp4", volume: 0
  } });
  await projection.locator("video").waitFor();
  await poll(async () => projection.locator("video").evaluate((video) => video.currentTime > .5 && !video.paused), "actual local video playing");
  await projection.evaluate(() => {
    window.__mediaProbe = document.querySelector("video");
    window.__mediaTime = window.__mediaProbe.currentTime;
  });
  await post("/api/operator-public", { action: "patch", visible: false });
  await projection.locator('[data-operator-visible="false"]').waitFor();
  await projection.waitForTimeout(500);
  assert(await projection.evaluate(() => window.__mediaProbe === document.querySelector("video") && window.__mediaProbe.currentTime > window.__mediaTime && !window.__mediaProbe.paused));
  await post("/api/operator-public", { action: "patch", visible: true });
  await projection.locator('[data-operator-visible="true"]').waitFor();
  await projection.waitForTimeout(500);
  assert(await projection.evaluate(() => window.__mediaProbe === document.querySelector("video") && window.__mediaProbe.currentTime > window.__mediaTime && !window.__mediaProbe.paused));
  checks.push("other registered public scenes share the layout; real local video continues without remount/restart");
  await post("/api/operator-public", { action: "patch", visible: false });
  const sceneController = await context.newPage();
  await sceneController.goto(`${base}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  const rightMenu = sceneController.getByLabel("Índice da Cena 0", { exact: true });
  const launch = rightMenu.getByRole("button", { name: "REVELAR OPERATOR", exact: true });
  await launch.waitFor();
  const menuBox = await rightMenu.boundingBox();
  const launchBox = await launch.boundingBox();
  assert(launchBox.x > 1000 && launchBox.y - menuBox.y < 20, "Launcher belongs at the top of the right-hand menu");
  await launch.click();
  await sceneController.getByRole("button", { name: "VOLTAR AOS CONTROLES", exact: true }).waitFor();
  const returnControl = sceneController.getByRole("button", { name: "INTERROMPER DESVIO / RETOMAR PEÇA", exact: true });
  await returnControl.click({ trial: true });
  const sendControl = sceneController.getByRole("button", { name: "ENVIAR", exact: true });
  const sendBox = await sendControl.boundingBox();
  assert(sendBox.y + sendBox.height <= 720, "private composer must remain inside the viewport");
  await sceneController.evaluate(() => {
    navigator.mediaDevices.getDisplayMedia = async (options) => {
      window.__captureOptions = options;
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 180;
      const context = canvas.getContext("2d");
      const paint = () => { context.fillStyle = Date.now() % 2 ? "#163322" : "#224433"; context.fillRect(0, 0, 320, 180); };
      paint();
      window.__captureTimer = setInterval(paint, 100);
      const media = canvas.captureStream(10);
      window.__captureTrack = media.getVideoTracks()[0];
      return media;
    };
  });
  await sceneController.getByRole("button", { name: "CONECTAR PROJEÇÃO AO VIVO", exact: true }).click();
  await poll(async () => sceneController.locator("video").evaluate((video) => video.currentTime > .2 && video.muted), "live preview plays moving synthetic stream, muted");
  await sceneController.getByRole("button", { name: "DESCONECTAR MONITOR", exact: true }).click();
  assert(await sceneController.evaluate(() => window.__captureTrack.readyState === "ended" && window.__captureOptions.audio === false));
  await sceneController.evaluate(() => clearInterval(window.__captureTimer));
  checks.push("preview binds a moving synthetic video stream, stays muted and releases capture tracks");
  await sceneController.screenshot({ path: path.join(output, "scene-zero-operator-controls.png") });
  await sceneController.getByRole("button", { name: "VOLTAR AOS CONTROLES", exact: true }).click();
  await sceneController.screenshot({ path: path.join(output, "right-menu-launcher.png") });
  checks.push("Scene Zero right menu launcher is at its upper right and opens private dialogue");
  assert.deepEqual(errors, [], "no browser runtime errors");
  const savedChannel = (await state()).operatorPublic;
  await poll(async () => {
    try { const snapshot = JSON.parse(await fs.readFile(path.join(auditRoot, "runtime/current.json"), "utf8"));
      return snapshot.state.operatorPublic.visible === savedChannel.visible && snapshot.state.operatorPublic.messages.length === savedChannel.messages.length;
    } catch { return false; }
  }, "operator channel included in persisted recovery snapshot");
  await browser.close();
  browser = null;
  const exited = new Promise((resolve) => server.once("exit", resolve));
  server.kill("SIGTERM");
  await exited;
  server = startServer();
  await poll(async () => { try { return (await fetch(`${base}/api/health?skipOptional=1`)).ok; } catch { return false; } }, "restarted audit server", 30000);
  const recovery = await (await fetch(`${base}/api/show-session`)).json();
  assert.equal(recovery.recoverable, true);
  await post("/api/show-session", { action: "resume" });
  const restored = (await state()).operatorPublic;
  assert.deepEqual(restored.personality, savedChannel.personality);
  assert.deepEqual(restored.messages, savedChannel.messages);
  assert.equal(restored.visible, savedChannel.visible);
  assert.equal(restored.status, "idle");
  checks.push("actual server restart and explicit session resume restore conversation, sliders and visibility");
  for (const name of ["public-realtime-browser-test.js", "videomapping-browser-test.js", "sound-control-browser-test.js"]) {
    // Existing suites, with only their loopback URL changed in the temporary copy.
    const source = await fs.readFile(path.resolve("scripts", name), "utf8");
    const testPath = path.join(auditRoot, "scripts", `operator-regression-${name}`);
    await fs.writeFile(testPath, source.replaceAll("http://localhost:3000", base));
    const child = spawn(process.execPath, ["--no-warnings", testPath], { cwd: auditRoot,
      env: { ...process.env, BASE_URL: base }, stdio: ["ignore", "pipe", "pipe"] });
    let result = "";
    child.stdout.on("data", (chunk) => { result += chunk; });
    child.stderr.on("data", (chunk) => { result += chunk; });
    const code = await new Promise((resolve) => child.on("exit", resolve));
    await fs.writeFile(path.join(output, name.replace(".js", ".log")), result);
    assert.equal(code, 0, `Existing ${name} failed:\n${result.slice(-2000)}`);
    checks.push(`existing ${name} passed on isolated port`);
  }
  await fs.writeFile(path.join(output, "results.json"), JSON.stringify({ checks, errors, provider: "mock SDK transport (not real OpenAI)", port: 3311 }, null, 2));
  console.log(checks.map((check) => `PASS ${check}`).join("\n"));
} catch (error) {
  const pages = browser?.contexts().flatMap((context) => context.pages()) || [];
  for (const [index, page] of pages.entries()) {
    await page.screenshot({ path: path.join(output, `failure-${index}.png`) }).catch(() => {});
    await fs.writeFile(path.join(output, `failure-${index}.txt`), await page.locator("body").innerText().catch(() => ""));
  }
  await fs.writeFile(path.join(output, "failure-state.json"), JSON.stringify(await state().catch(() => ({}))));
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await fs.writeFile(path.join(output, "server.log"), log);
}
