import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
  AUDIENCE_WARMUP_FIRST_QUESTION_INTENSITY,
  AUDIENCE_WARMUP_REQUIRED_ACKNOWLEDGEMENT
} from "../data/audience-warmup-prompts.js";
import {
  AUDIENCE_WARMUP_MINIGAME_RESULT_COMMENTS,
  AUDIENCE_WARMUP_QUESTIONS_RESULT_COMMENT
} from "../data/audience-warmup-reactions.js";
import { PLAY_UNLOCK_CONFIG } from "../data/scene-zero-unlock.js";

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
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    const state = await snapshot(request);
    lastState = state;
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`timeout waiting for ${label}: ${JSON.stringify({
    unlock: lastState?.sceneZero?.unlock,
    warmup: lastState?.audienceWarmup
  })}`);
}

async function bootToWarmup(request, { waitForMinigame = false } = {}) {
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
  const ending = await post(request, "unlock-end-bios");
  assert.equal(ending.unlock.bootProgress, 100);
  await waitFor(request, (state) => state.sceneZero.unlock.status === "SOUND_CHECK" && state.sceneZero.unlock.soundCheck?.phase === "listening", "sound check", 7000);
  await post(request, "unlock-sound-check-skip");
  const ready = await waitFor(
    request,
    (state) => state.audienceWarmup.phase === "questions" && ["WAITING_FOR_AUDIENCE", "WARMING_AUDIENCE"].includes(state.sceneZero.unlock.status),
    "rodada de perguntas depois da verificação humana"
  );
  assert.equal(ready.sceneZero.unlock.bootProgress, 100);
  assert.equal(
    ready.sceneZero.unlock.progress,
    PLAY_UNLOCK_CONFIG.soundCheck.progressValue + PLAY_UNLOCK_CONFIG.questionProgressValue,
    "prova sonora e primeira pergunta devem somar 10%"
  );
  assert.equal(ready.audienceWarmup.phase, "questions");
  assert.equal(ready.audienceWarmup.previewPromptId, "play-dead-30");
  if (!waitForMinigame) return ready;
  await post(request, "questions-complete");
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
  for (const label of ["ENCERRAR PERGUNTAS → MINI GAME", "SORTEAR JOGO", "TAPÃO", "PISCADA", "SERINHO", "INICIAR", "PAUSAR", "CONTINUAR", "REINICIAR", "ENCERRAR", "+5 SEGUNDOS", "−5 SEGUNDOS", "PULAR MINIGAME"]) {
    assert((await operator.getByRole("button", { name: label, exact: true }).count()) >= 1, `controle ausente: ${label}`);
  }
  for (const label of ["SORTEAR", "PULAR", "REPETIR", "PRÓXIMO", "+5s", "ENCERRAR AÇÃO"]) {
    assert((await operator.getByRole("button", { name: label, exact: true }).count()) >= 1, `controle de ação ausente: ${label}`);
  }
  await operator.close();

  const sceneOperator = await context.newPage();
  sceneOperator.on("pageerror", (error) => pageErrors.push(error.message));
  await sceneOperator.setViewportSize({ width: 1440, height: 1000 });
  await sceneOperator.goto(`${BASE_URL}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  const manualToggle = sceneOperator.getByRole("region", { name: "Controles iniciais do aquecimento" }).getByRole("checkbox");
  await manualToggle.waitFor();
  assert.equal(await manualToggle.isChecked(), false);
  const responseControls = sceneOperator.getByRole("region", { name: "Resposta da pergunta atual" });
  await responseControls.waitFor();

  // Fluxo completo: prova sonora -> perguntas/ações -> mini game.
  let state = await bootToWarmup(context.request);
  assert.equal(state.audienceWarmup.phase, "questions");
  assert.equal(state.audienceWarmup.previewPromptId, "play-dead-30", "toda sessão deve abrir as perguntas com a ação obrigatória");
  assert.equal(state.publicMessage.content, "TODOS FINJAM ESTAR MORTOS NAS CADEIRAS E NO CHÃO.");
  await display.getByText(state.publicMessage.content, { exact: true }).waitFor();

  state = await waitFor(
    context.request,
    (candidate) => candidate.publicMessage?.content === AUDIENCE_WARMUP_REQUIRED_ACKNOWLEDGEMENT,
    "reconhecimento depois dos 20 segundos de mortos",
    25000
  );
  await display.getByText(AUDIENCE_WARMUP_REQUIRED_ACKNOWLEDGEMENT, { exact: true }).waitFor();
  state = await waitFor(
    context.request,
    (candidate) => candidate.audienceWarmup.previewPromptId?.startsWith("provocative-")
      && candidate.publicMessage?.content === candidate.audienceWarmup.preview,
    "primeira provocação automática"
  );
  assert.equal(state.audienceWarmup.intensity, AUDIENCE_WARMUP_FIRST_QUESTION_INTENSITY);
  assert.match(state.audienceWarmup.previewPromptId, /^provocative-/);

  const promptBeforeReaction = state.audienceWarmup.previewPromptId;
  const progressBeforeReaction = state.sceneZero.unlock.progress;
  const manyResponseButton = responseControls.getByRole("button").first();
  const fewResponseButton = responseControls.getByRole("button").last();
  assert.match(await fewResponseButton.textContent(), /^POUCOS /);
  assert.match(await manyResponseButton.textContent(), /^MUITOS /);
  assert((await fewResponseButton.boundingBox()).y > (await manyResponseButton.boundingBox()).y, "POUCOS deve ficar abaixo de MUITOS");
  if (!(await fewResponseButton.isEnabled())) {
    throw new Error(`controles de reação desabilitados: ${JSON.stringify({
      phase: await responseControls.getAttribute("data-phase"),
      pending: await responseControls.getAttribute("data-pending")
    })}`);
  }
  await sceneOperator.keyboard.press("ArrowDown");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.currentResponse?.kind === "few", "registro de poucos");
  await sceneOperator.waitForFunction(() => document.querySelector('section[aria-label="Resposta da pergunta atual"] button[aria-pressed="true"]')?.textContent?.startsWith("POUCOS"));
  assert.equal(state.audienceWarmup.previewPromptId, promptBeforeReaction, "registrar resposta não pode trocar a pergunta");
  assert.equal(state.publicMessage.content, state.audienceWarmup.preview, "registrar resposta não pode falar antes de SORTEAR");
  assert.equal(state.sceneZero.unlock.progress, progressBeforeReaction, "registrar resposta não pode pontuar");
  await sceneOperator.keyboard.press("ArrowUp");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.currentResponse?.kind === "many", "registro de muitos");
  await sceneOperator.waitForFunction(() => document.querySelector('section[aria-label="Resposta da pergunta atual"] button[aria-pressed="true"]')?.textContent?.startsWith("MUITOS"));
  assert.equal(state.audienceWarmup.responseHistory.at(-1).promptId, promptBeforeReaction);

  const literalCases = [
    ["public-07", "QUEM VOTOU NO LULA FICA DE PÉ."],
    ["exposed-08", "QUEM VOTOU NO BOLSONARO CRUZA OS BRAÇOS."],
    ["provocative-01", "QUEM É MACONHEIRO FAZ UMA ONDA COM AS MÃOS."],
    ["provocative-07", "QUEM TRANSOU ESTA SEMANA BATE DEZ PALMAS."],
    ["provocative-04", "QUEM JÁ CHEIROU COCAÍNA TOCA NO NARIZ."]
  ];
  let expectedQuestionProgress = progressBeforeReaction;
  for (const [promptId, expectedText] of literalCases) {
    await post(context.request, "trigger-prompt", { promptId });
    await display.getByText(expectedText, { exact: true }).waitFor();
    state = await snapshot(context.request);
    assert.equal(state.publicMessage.content, expectedText, `${promptId} deve chegar literalmente à tela pública`);
    assert.equal(state.audienceWarmup.display.text, expectedText, `${promptId} não pode ser reconstruído por template ou modelo`);
    assert.doesNotMatch(state.publicMessage.content, /político X|candidato A|um determinado político|uma substância/iu);
    expectedQuestionProgress += PLAY_UNLOCK_CONFIG.questionProgressValue;
    assert.equal(state.sceneZero.unlock.progress, expectedQuestionProgress, `${promptId} deve avançar exatamente 5%`);
  }
  await post(context.request, "trigger-prompt", { promptId: literalCases.at(-1)[0] });
  state = await snapshot(context.request);
  assert.equal(state.sceneZero.unlock.progress, expectedQuestionProgress, "redisparar a mesma pergunta não pode pontuar outra vez");

  await post(context.request, "set-intensity", { intensity: "social_pressure" });
  const promptBeforeSurprise = (await snapshot(context.request)).audienceWarmup.previewPromptId;
  await post(context.request, "record-response", { kind: "many", label: "MUITOS TOCARAM O CORPO" });
  await post(context.request, "surprise");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.reaction?.kind === "many", "reação contextual antes do sorteio");
  assert.equal(state.audienceWarmup.previewPromptId, promptBeforeSurprise, "a reação deve acontecer antes de escolher a próxima pergunta");
  assert.equal(state.publicMessage.content, state.audienceWarmup.reaction.text, "a reação automática deve ser projetada");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.previewPromptId?.startsWith("social-") && candidate.publicMessage?.content === candidate.audienceWarmup.preview, "sorteio depois da reação");
  assert.equal(state.audienceWarmup.intensity, "social_pressure", "sortear deve preservar a intensidade selecionada");
  assert(state.audienceWarmup.previewPromptId, "sorteio deve preparar um id da biblioteca");
  assert.match(state.audienceWarmup.previewPromptId, /^social-/, "sortear deve escolher uma ação da intensidade selecionada");
  assert.equal(state.publicMessage.content, state.audienceWarmup.preview, "SORTEAR deve publicar o texto exato sorteado");

  const promptBeforeArrow = state.audienceWarmup.previewPromptId;
  await post(context.request, "record-response", { kind: "few" });
  await sceneOperator.keyboard.press("ArrowRight");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.reaction?.kind === "few", "reação iniciada pela seta direita");
  assert.equal(state.audienceWarmup.previewPromptId, promptBeforeArrow, "seta deve publicar a reação antes de trocar a pergunta");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.previewPromptId?.startsWith("provocative-") && candidate.publicMessage?.content === candidate.audienceWarmup.preview, "sorteio de intensidade 4 pela seta direita");
  assert.equal(state.audienceWarmup.intensity, AUDIENCE_WARMUP_FIRST_QUESTION_INTENSITY, "seta deve usar intensidade 4 por padrão");

  await post(context.request, "minigame-draw", {}, false);
  await sceneOperator.keyboard.press("Space");
  state = await waitFor(context.request, (candidate) => candidate.publicMessage?.content === AUDIENCE_WARMUP_QUESTIONS_RESULT_COMMENT, "comentário final das perguntas");
  await display.getByText(AUDIENCE_WARMUP_QUESTIONS_RESULT_COMMENT, { exact: true }).waitFor();
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "ready_for_draw", "briefing depois das perguntas", 40000);
  const briefing = state.audienceWarmup.history.map((entry) => entry.text);
  assert.deepEqual(briefing.slice(-5), [AUDIENCE_WARMUP_QUESTIONS_RESULT_COMMENT, "PERGUNTAS CONCLUÍDAS. AGORA, UM TESTE.", "ESCOLHA A PESSOA AO SEU LADO E FORME UMA DUPLA.", "UM JOGO SERÁ SORTEADO.", "SIGAM AS INSTRUÇÕES."]);
  assert.equal(briefing.some((line) => /NÃO COMPLIQUEM/.test(line)), false);
  await post(context.request, "set-manual-mode", { manualMode: true });
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.manualMode === true, "modo manual antes do sorteio");
  await sceneOperator.keyboard.press("Space");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "drawing" && candidate.audienceWarmup.pendingAdvance?.kind === "minigame-reveal", "sorteio de jogo pela barra de espaço");
  await display.getByText("SORTEANDO TESTE", { exact: true }).waitFor();
  await display.screenshot({ path: "/private/tmp/caixa-preta-warmup-draw.png" });
  await sceneOperator.waitForFunction(() => document.querySelector('[aria-label="Minigame em dupla"]')?.textContent?.includes("DRAWING"));
  await sceneOperator.keyboard.press("ArrowRight");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "selected", "revelação manual do jogo pela seta direita");
  await post(context.request, "set-manual-mode", { manualMode: false });
  await post(context.request, "minigame-draw", {}, false);
  await post(context.request, "minigame-set-duration", { gameId: "tapao", seconds: 60 }, false);
  await post(context.request, "minigame-select", { gameId: "tapao" });
  await display.getByText("JOGO SELECIONADO", { exact: true }).waitFor();
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "ready", "regras do TAPÃO", 35000);
  assert.equal(state.publicMessage.content, "PRIMEIRO TURNO: 10 SEGUNDOS.");
  await sceneOperator.waitForFunction(() => document.querySelector('[aria-label="Minigame em dupla"] p')?.textContent?.startsWith("ESTADO: READY ·"));
  await sceneOperator.keyboard.press("ArrowRight");
  await display.getByLabel("Minigame do aquecimento").waitFor();
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "running", "primeiro turno do TAPÃO");
  await post(context.request, "minigame-tapao-swap");
  await display.getByText("INVERTAM OS PAPÉIS", { exact: true }).waitFor();
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "ready_round_two", "troca do TAPÃO");
  await sceneOperator.waitForFunction(() => document.querySelector('[aria-label="Minigame em dupla"] p')?.textContent?.startsWith("ESTADO: READY ROUND TWO ·"));
  await sceneOperator.keyboard.press("ArrowRight");
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "running" && candidate.audienceWarmup.minigame.round === 2, "segundo turno do TAPÃO");
  await sceneOperator.keyboard.press("Space");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.phase === "complete", "fim do aquecimento depois do TAPÃO", 20000);
  assert.equal(state.audienceWarmup.minigame.status, "completed");
  assert(state.audienceWarmup.history.some((entry) => entry.text === AUDIENCE_WARMUP_MINIGAME_RESULT_COMMENTS.tapao));
  assert(state.sceneZero.unlock.progress >= 5, "minigame concluído deve aumentar a barra de desbloqueio em 5%");

  await post(context.request, "unlock-complete");
  state = await waitFor(context.request, (candidate) => candidate.sceneZero.unlock.progress === 99 && !candidate.sceneZero.unlock.animation, "barra preparada em 99%", 15000);
  assert.equal(state.sceneZero.unlock.status, "WARMING_AUDIENCE");
  assert.equal(state.sceneZero.unlock.onPlayUnlocked, null, "aquecimento não pode concluir o espetáculo antes da última mala");
  await display.getByRole("progressbar", { name: "DESBLOQUEIO DO ESPETÁCULO: 99%" }).waitFor();
  await display.screenshot({ path: "/private/tmp/caixa-preta-warmup-99.png" });

  // PISCADA: duração configurável, pausa, +5 e encerramento antecipado.
  await bootToWarmup(context.request, { waitForMinigame: true });
  await post(context.request, "minigame-set-duration", { gameId: "piscada", seconds: 12 });
  await selectAndPrepare(context.request, "piscada");
  await post(context.request, "minigame-start");
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "running", "PISCADA em curso");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  state = await snapshot(context.request);
  assert.equal(state.audienceWarmup.minigame.status, "running", "reação não pode antecipar o fim do cronômetro");
  await post(context.request, "minigame-pause");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "paused" && !candidate.audienceWarmup.pendingAdvance, "PISCADA pausada sem encerramento pendente");
  const paused = (await snapshot(context.request)).audienceWarmup.minigame.timer.remainingSeconds;
  await post(context.request, "minigame-adjust-time", { deltaSeconds: 5 });
  state = await snapshot(context.request);
  assert.equal(state.audienceWarmup.minigame.timer.remainingSeconds, paused + 5);
  await sceneOperator.waitForFunction(() => document.querySelector('[aria-label="Minigame em dupla"] p')?.textContent?.startsWith("ESTADO: PAUSED ·"));
  await sceneOperator.keyboard.press("ArrowRight");
  await waitFor(context.request, (candidate) => candidate.audienceWarmup.minigame.status === "running", "PISCADA retomada pela seta direita");
  await post(context.request, "minigame-end");
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.phase === "complete", "fim do aquecimento depois da PISCADA", 20000);
  assert(state.audienceWarmup.history.some((entry) => entry.text === AUDIENCE_WARMUP_MINIGAME_RESULT_COMMENTS.piscada));

  // SERINHO: timer, reinício, -5 e encerramento.
  await bootToWarmup(context.request, { waitForMinigame: true });
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
  state = await waitFor(context.request, (candidate) => candidate.audienceWarmup.phase === "complete", "fim do aquecimento depois do SERINHO", 20000);
  assert.equal(state.audienceWarmup.minigame.selectedId, "serinho");
  assert(state.audienceWarmup.history.some((entry) => entry.text === AUDIENCE_WARMUP_MINIGAME_RESULT_COMMENTS.serinho));

  const allWarmupText = state.audienceWarmup.history.map((entry) => entry.text).join(" ");
  assert.doesNotMatch(allWarmupText, /\bpor favor\b/iu);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(pageErrors, []);
  const operatorSummary = await context.newPage();
  await operatorSummary.setViewportSize({ width: 1440, height: 1000 });
  await operatorSummary.goto(`${BASE_URL}/operator`, { waitUntil: "domcontentloaded" });
  await operatorSummary.screenshot({ path: "/private/tmp/caixa-preta-warmup-controller.png", fullPage: true });
  await sceneOperator.screenshot({ path: "/private/tmp/caixa-preta-scene-zero-manual-reactions.png", fullPage: true });
  console.log("audience warmup browser tests passed");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
}
