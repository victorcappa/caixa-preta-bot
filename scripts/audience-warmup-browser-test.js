import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.CAIXA_PRETA_URL || "http://localhost:3000";

async function post(request, action, payload = {}, expectedOk = true) {
  const response = await request.post(`${BASE_URL}/api/audience-warmup`, { data: { action, ...payload } });
  const data = await response.json();
  assert.equal(response.ok(), expectedOk, `${action}: ${data.error || "request failed"}`);
  return data;
}

async function snapshot(request) {
  return (await (await request.get(`${BASE_URL}/api/state`)).json());
}

async function waitFor(request, predicate, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await snapshot(request);
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function bootToWarmup(request, { waitForBriefing = false } = {}) {
  await request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } });
  const resetState = await snapshot(request);
  assert.equal(resetState.audienceWarmup.phase, "idle", "reset deve limpar a fase do aquecimento");
  assert.equal(resetState.audienceWarmup.minigame.selectedId, null, "reset deve limpar o minigame anterior");
  assert.equal(resetState.audienceWarmup.minigame.timer.status, "idle", "reset deve limpar o cronômetro anterior");
  let unlock = (await post(request, "unlock-boot")).unlock;
  for (let index = 0; index < 12 && unlock.status === "BOOTING"; index += 1) {
    unlock = (await post(request, "unlock-advance-boot")).unlock;
  }
  assert.equal(unlock.status, "BOOT_FAILED");
  await post(request, "unlock-start-warmup");
  const ready = await waitFor(request, (state) => state.sceneZero.unlock.status === "WAITING_FOR_AUDIENCE", "human verification");
  assert.equal(ready.sceneZero.unlock.progress, 78);
  if (!waitForBriefing) return ready;
  return waitFor(request, (state) => state.audienceWarmup.minigame.status === "ready_for_draw", "briefing completo", 40000);
}

async function selectAndPrepare(request, gameId) {
  await post(request, "minigame-select", { gameId });
  return waitFor(request, (state) => state.audienceWarmup.minigame.status === "ready", `${gameId} pronto`, 35000);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const externalRequests = [];
context.on("request", (request) => {
  if (/instagram\.com/i.test(request.url())) externalRequests.push(request.url());
});

try {
  const display = await context.newPage();
  const pageErrors = [];
  display.on("pageerror", (error) => pageErrors.push(error.message));
  await display.setViewportSize({ width: 1920, height: 1080 });
  await display.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const operator = await context.newPage();
  operator.on("pageerror", (error) => pageErrors.push(error.message));
  await operator.setViewportSize({ width: 1440, height: 1000 });
  await operator.goto(`${BASE_URL}/operator`, { waitUntil: "domcontentloaded" });
  await operator.getByText("CONNECTED", { exact: true }).waitFor();

  const warmupDisclosure = operator.locator("#operator-warmup");
  const warmupToggle = warmupDisclosure.getByRole("button", { name: /ESQUENTAR PÚBLICO/ });
  assert.equal(await warmupToggle.getAttribute("aria-expanded"), "false");
  await warmupToggle.click();
  await operator.getByRole("heading", { name: "ESQUENTAR PÚBLICO" }).waitFor();
  for (const label of ["SORTEAR JOGO", "TAPÃO", "PISCADA", "SERINHO", "INICIAR", "PAUSAR", "CONTINUAR", "REINICIAR", "ENCERRAR", "+5 SEGUNDOS", "−5 SEGUNDOS", "PULAR MINIGAME"]) {
    assert((await operator.getByRole("button", { name: label, exact: true }).count()) >= 1, `controle ausente: ${label}`);
  }
  for (const label of ["SORTEAR", "DISPARAR", "PULAR", "REPETIR", "PRÓXIMO", "+5s", "ENCERRAR AÇÃO"]) {
    assert((await operator.getByRole("button", { name: label, exact: true }).count()) >= 1, `controle de ação ausente: ${label}`);
  }

  // Fluxo completo + TAPÃO: briefing, sorteio visual, dois turnos e bloqueio de um segundo jogo.
  await bootToWarmup(context.request, { waitForBriefing: true });
  const briefing = (await snapshot(context.request)).audienceWarmup.history.map((entry) => entry.text);
  assert.deepEqual(briefing.slice(-4), ["ANTES DAS PERGUNTAS, UM TESTE.", "FORMEM DUPLAS.", "UM JOGO SERÁ SORTEADO.", "SIGAM AS INSTRUÇÕES."]);
  assert.equal(briefing.some((line) => /NÃO COMPLIQUEM/.test(line)), false);
  await post(context.request, "minigame-draw");
  await display.getByText("SORTEANDO TESTE", { exact: true }).waitFor();
  await display.screenshot({ path: "/private/tmp/caixa-preta-warmup-draw.png" });
  await post(context.request, "minigame-draw", {}, false);
  await post(context.request, "minigame-set-duration", { gameId: "tapao", seconds: 60 }, false);
  await post(context.request, "minigame-select", { gameId: "tapao" });
  await display.getByText("JOGO SELECIONADO", { exact: true }).waitFor();
  let state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "ready", "regras do TAPÃO", 35000);
  assert.equal(state.publicMessage.content, "PRIMEIRO TURNO: 10 SEGUNDOS.");
  await post(context.request, "minigame-start");
  await display.getByLabel("Minigame do aquecimento").waitFor();
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "running", "primeiro turno do TAPÃO");
  await post(context.request, "minigame-tapao-swap");
  await display.getByText("INVERTAM OS PAPÉIS", { exact: true }).waitFor();
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "ready_round_two", "troca do TAPÃO");
  await post(context.request, "minigame-start");
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "running" && candidate.audienceWarmup.minigame.round === 2, "segundo turno do TAPÃO");
  await post(context.request, "minigame-end");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.phase === "questions", "perguntas depois do TAPÃO", 20000);
  assert.equal(state.audienceWarmup.minigame.status, "completed");
  assert.equal(state.audienceWarmup.intensity, "play");
  assert(state.sceneZero.unlock.progress >= 82, "minigame concluído deve aumentar um pouco a barra");

  const literalCases = [
    ["public-07", "QUEM VOTOU NO LULA FICA DE PÉ."],
    ["exposed-08", "QUEM VOTOU NO BOLSONARO CRUZA OS BRAÇOS."],
    ["provocative-01", "QUEM É MACONHEIRO FAZ UMA ONDA COM AS MÃOS."],
    ["provocative-07", "QUEM TRANSOU ESTA SEMANA BATE DEZ PALMAS."],
    ["provocative-04", "QUEM JÁ CHEIROU COCAÍNA TOCA NO NARIZ."]
  ];
  for (const [promptId, expectedText] of literalCases) {
    await post(context.request, "trigger-prompt", { promptId, withProgress: false });
    await display.getByText(expectedText, { exact: true }).waitFor();
    state = await snapshot(context.request);
    assert.equal(state.publicMessage.content, expectedText, `${promptId} deve chegar literalmente à tela pública`);
    assert.equal(state.audienceWarmup.display.text, expectedText, `${promptId} não pode ser reconstruído por template ou modelo`);
    assert.doesNotMatch(state.publicMessage.content, /político X|candidato A|um determinado político|uma substância/iu);
  }

  await post(context.request, "surprise");
  state = await snapshot(context.request);
  assert.equal(state.audienceWarmup.active, false, "sortear não deve projetar antes de DISPARAR");
  assert(state.audienceWarmup.previewPromptId, "sorteio deve preparar um id da biblioteca");
  await post(context.request, "trigger-preview");
  state = await snapshot(context.request);
  assert.equal(state.publicMessage.content, state.audienceWarmup.preview, "DISPARAR deve publicar o texto exato sorteado");

  await post(context.request, "minigame-draw", {}, false);
  await post(context.request, "unlock-complete");
  await display.getByText("PEÇA DESBLOQUEADA.", { exact: true }).waitFor({ timeout: 15000 });
  await display.screenshot({ path: "/private/tmp/caixa-preta-warmup-unlocked.png" });
  await waitFor(context.request, (candidate) => candidate.sceneZero.unlock.status === "UNLOCKED", "peça desbloqueada", 15000);

  // PISCADA: duração configurável, pausa, +5 e encerramento antecipado.
  await bootToWarmup(context.request);
  await post(context.request, "minigame-set-duration", { gameId: "piscada", seconds: 12 });
  await selectAndPrepare(context.request, "piscada");
  await post(context.request, "minigame-start");
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "running", "PISCADA em curso");
  await post(context.request, "minigame-pause");
  const paused = (await snapshot(context.request)).audienceWarmup.minigame.timer.remainingSeconds;
  await post(context.request, "minigame-adjust-time", { deltaSeconds: 5 });
  state = await snapshot(context.request);
  assert.equal(state.audienceWarmup.minigame.timer.remainingSeconds, paused + 5);
  await post(context.request, "minigame-resume");
  await post(context.request, "minigame-end");
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.phase === "questions", "perguntas depois da PISCADA", 20000);

  // SERINHO: timer, reinício, -5 e encerramento.
  await bootToWarmup(context.request);
  await post(context.request, "minigame-set-duration", { gameId: "serinho", seconds: 12 });
  await selectAndPrepare(context.request, "serinho");
  await post(context.request, "minigame-start");
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "running", "SERINHO em curso");
  await post(context.request, "minigame-restart");
  state = await snapshot(context.request);
  assert.equal(state.audienceWarmup.minigame.status, "ready");
  await post(context.request, "minigame-start");
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "running", "SERINHO reiniciado");
  await post(context.request, "minigame-adjust-time", { deltaSeconds: -5 });
  await post(context.request, "minigame-end");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.phase === "questions", "perguntas depois do SERINHO", 20000);
  assert.equal(state.audienceWarmup.minigame.selectedId, "serinho");

  const allWarmupText = state.audienceWarmup.history.map((entry) => entry.text).join(" ");
  assert.doesNotMatch(allWarmupText, /\bpor favor\b/iu);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(pageErrors, []);
  await operator.screenshot({ path: "/private/tmp/caixa-preta-warmup-controller.png", fullPage: true });
  console.log("audience warmup browser tests passed");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
}
