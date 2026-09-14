import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.CAIXA_PRETA_URL || "http://localhost:3000";
const TEST_MESSAGE = "rápido, vocês têm dez segundos pra decidir. olhem com atenção e escolham juntos.";

async function post(request, path, data) {
  const response = await request.post(`${BASE_URL}${path}`, { data });
  const body = await response.json();
  assert.equal(response.ok(), true, `${path}: ${body.error || "request failed"}`);
  return body;
}

async function prepareUnlockedProjection(request) {
  await post(request, "/api/audience-warmup", { action: "unlock-boot" });

  for (let index = 0; index < 12; index += 1) {
    const snapshot = await (await request.get(`${BASE_URL}/api/state`)).json();
    if (snapshot.sceneZero.unlock.status !== "BOOTING") break;
    await post(request, "/api/audience-warmup", { action: "unlock-advance-boot" });
  }

  await post(request, "/api/audience-warmup", { action: "unlock-start-warmup" });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    const snapshot = await (await request.get(`${BASE_URL}/api/state`)).json();
    if (snapshot.sceneZero.unlock.status === "WARMING_AUDIENCE") return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("projection did not reach WARMING_AUDIENCE");
}

async function readLayout(page) {
  const message = page.getByLabel("Fala atual da Caixa Preta").locator("p").filter({ hasText: "rápido" });
  const game = page.getByLabel("Verdade ou Bolo");
  await game.waitFor();
  await message.waitFor();
  await page.waitForFunction(() => {
    const video = document.querySelector('[aria-label="Verdade ou Bolo"] video');
    return !video || video.readyState >= 2;
  });

  return page.evaluate(() => {
    const chatElement = document.querySelector('[aria-label="Chat publico"]');
    const stageElement = document.querySelector('[aria-label="Fala atual da Caixa Preta"]');
    const gameElement = document.querySelector('[aria-label="Verdade ou Bolo"]');
    const unlockElement = document.querySelector('[aria-label="Progresso"]');
    const messageElement = [...stageElement.querySelectorAll("p")].find((element) => element.textContent.includes("rápido"));
    const frameElement = messageElement.closest("div");
    const style = getComputedStyle(messageElement);

    return {
      viewportWidth: window.innerWidth,
      chat: chatElement.getBoundingClientRect().toJSON(),
      stage: stageElement.getBoundingClientRect().toJSON(),
      game: gameElement.getBoundingClientRect().toJSON(),
      unlock: unlockElement?.getBoundingClientRect().toJSON() || null,
      message: messageElement.getBoundingClientRect().toJSON(),
      frame: frameElement.getBoundingClientRect().toJSON(),
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
      overflowWrap: style.overflowWrap,
      wordBreak: style.wordBreak,
      textAlign: style.textAlign,
      textWrap: style.textWrap
    };
  });
}

async function firstCharacterX(page, minimumLength) {
  await page.waitForFunction((length) => {
    const stage = document.querySelector('[aria-label="Fala atual da Caixa Preta"]');
    const message = [...(stage?.querySelectorAll("p") || [])].find((element) => element.textContent.includes("rápido"));
    return (message?.firstChild?.textContent?.length || 0) >= length;
  }, minimumLength);

  return page.evaluate(() => {
    const stage = document.querySelector('[aria-label="Fala atual da Caixa Preta"]');
    const message = [...stage.querySelectorAll("p")].find((element) => element.textContent.includes("rápido"));
    const range = document.createRange();
    range.setStart(message.firstChild, 0);
    range.setEnd(message.firstChild, 1);
    return range.getBoundingClientRect().x;
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

try {
  await post(context.request, "/api/operator", { command: "/reset" });
  await prepareUnlockedProjection(context.request);
  await post(context.request, "/api/audience-warmup", { action: "send", text: TEST_MESSAGE });
  await post(context.request, "/api/operator", { command: "/game verdade-ou-bolo" });

  const wide = await context.newPage();
  await wide.setViewportSize({ width: 1920, height: 1080 });
  await wide.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const earlyCharacterX = await firstCharacterX(wide, 8);
  const laterCharacterX = await firstCharacterX(wide, 40);
  const wideLayout = await readLayout(wide);

  assert(wideLayout.stage.width >= 700, `chat panel too narrow: ${wideLayout.stage.width}px`);
  assert(wideLayout.game.x >= wideLayout.stage.right - 2, "wide layout panels must stay side by side");
  assert(wideLayout.fontSize <= 58, `chat type too large: ${wideLayout.fontSize}px`);
  assert(wideLayout.lineHeight >= wideLayout.fontSize * 1.08, "chat lines need readable separation");
  assert(wideLayout.message.bottom <= wideLayout.stage.bottom, "chat message must fit inside its panel");
  assert.equal(wideLayout.overflowWrap, "break-word");
  assert.equal(wideLayout.wordBreak, "normal");
  assert.equal(wideLayout.textAlign, "left");
  assert.notEqual(wideLayout.textWrap, "balance");
  assert(Math.abs(earlyCharacterX - laterCharacterX) <= 1, `first character moved ${Math.abs(earlyCharacterX - laterCharacterX)}px while typing`);
  await wide.screenshot({ path: "/private/tmp/caixa-preta-verdade-ou-bolo-layout-wide.png" });

  const compact = await context.newPage();
  await compact.setViewportSize({ width: 900, height: 900 });
  await compact.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const compactLayout = await readLayout(compact);

  assert(compactLayout.game.y >= compactLayout.stage.bottom - 2, "compact layout panels must stack");
  assert(!compactLayout.unlock || compactLayout.message.top >= compactLayout.unlock.bottom, "compact chat text must remain below the BIOS bar");
  assert(compactLayout.message.bottom <= compactLayout.stage.bottom, "compact chat message must fit inside its panel");
  await compact.screenshot({ path: "/private/tmp/caixa-preta-verdade-ou-bolo-layout-compact.png" });

  console.log("verdade ou bolo layout browser test passed", {
    wide: { stageWidth: wideLayout.stage.width, fontSize: wideLayout.fontSize },
    compact: { stageHeight: compactLayout.stage.height, fontSize: compactLayout.fontSize }
  });
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await browser.close();
}
