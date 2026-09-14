import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PROJECTION_WINDOW_ID = `videomapping-test-${Date.now()}`;

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } });
  await page.goto(`${BASE_URL}/videomapping?projectionWindow=${PROJECTION_WINDOW_ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-public-layout="quadrants"]');

  const geometry = await page.evaluate(() => {
    const workspace = document.querySelector('[data-public-layout="quadrants"]');
    const pane = document.querySelector('[aria-label="Chat publico"]');
    workspace.className = workspace.className
      .split(" ")
      .filter((className) => !className.includes("bootStandby"))
      .join(" ");

    const rect = (selector) => {
      const bounds = document.querySelector(selector).getBoundingClientRect();
      return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
    };

    workspace.dataset.mountMarker = "preserved";
    return {
      pane: rect('[aria-label="Chat publico"]'),
      main: rect('[aria-label="Fala atual da Caixa Preta"]'),
      sceneZero: rect('[aria-label="Quadrante de status, BIOS e Cena 0"]'),
      sceneZeroAux: rect('[aria-label="Quadrante de contagens e conteúdos da Cena 0"]'),
      performance: rect('[aria-label="Quadrante de elementos visuais e conteúdos auxiliares"]'),
      context: rect('[aria-label="Quadrante de conteúdos contextuais"]'),
      cursorGlyph: document.querySelector('[aria-label="Cursor da Caixa Preta"]')?.textContent.trim(),
      cursorIterations: getComputedStyle(document.querySelector('[aria-label="Cursor da Caixa Preta"]')).animationIterationCount,
      publicInputDisplay: getComputedStyle(document.querySelector('[class*="publicInput"]')).display,
      contextBackground: getComputedStyle(document.querySelector('[aria-label="Quadrante de conteúdos contextuais"]')).backgroundColor,
      introCursorCount: document.querySelectorAll('[class*="introCursor"]').length
    };
  });

  const halfWidth = geometry.pane.width / 2;
  const halfHeight = geometry.pane.height / 2;
  for (const region of [geometry.main, geometry.sceneZero, geometry.sceneZeroAux, geometry.performance, geometry.context]) {
    assert.ok(Math.abs(region.width - halfWidth) <= 1, `largura inesperada: ${region.width}`);
    assert.ok(Math.abs(region.height - halfHeight) <= 1, `altura inesperada: ${region.height}`);
  }
  assert.ok(geometry.main.left < geometry.sceneZero.left && geometry.main.top < geometry.performance.top);
  assert.ok(geometry.performance.left < geometry.context.left && geometry.sceneZero.top < geometry.context.top);
  assert.deepEqual(geometry.sceneZeroAux, geometry.performance, "sem contagem ativa, o quadrante auxiliar deve ficar disponível para visuais");
  assert.equal(geometry.cursorGlyph, ">", "o cursor deve usar um único glifo, sem sublinhado concorrente");
  assert.equal(geometry.cursorIterations, "infinite", "o cursor inicial deve piscar em loop");
  assert.equal(geometry.introCursorCount, 1, "o videomapping deve manter somente o cursor central do chatbot");
  assert.equal(geometry.publicInputDisplay, "none", "o prompt de entrada público não deve criar um segundo cursor no videomapping");
  assert.equal(geometry.contextBackground, "rgb(0, 0, 0)", "um quadrante contextual vazio deve permanecer preto");

  const bootResponse = await page.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "unlock-boot" } });
  assert.equal(bootResponse.ok(), true);
  let postBiosState = (await (await page.request.get(`${BASE_URL}/api/state`)).json()).sceneZero.unlock;
  for (let index = 0; index < 12 && postBiosState.status === "BOOTING"; index += 1) {
    const response = await page.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action: "unlock-advance-boot" } });
    assert.equal(response.ok(), true);
    postBiosState = (await (await page.request.get(`${BASE_URL}/api/state`)).json()).sceneZero.unlock;
  }
  assert.equal(postBiosState.status, "BOOT_FAILED");
  await page.getByLabel("Aguardando início do aquecimento").waitFor({ timeout: 8000 });
  const postBiosVisual = await page.evaluate(() => {
    const visibleAnimatedGlyphs = [...document.querySelectorAll("*")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0
          && bounds.height > 0
          && style.visibility !== "hidden"
          && style.display !== "none"
          && /(?:introBlink|BlinkingCursor.*blink)/.test(style.animationName);
      })
      .map((element) => element.textContent.trim())
      .filter(Boolean);
    const cursor = document.querySelector('[aria-label="Cursor da Caixa Preta"]').getBoundingClientRect();
    const progress = document.querySelector('[role="progressbar"][aria-label^="DESBLOQUEIO DO ESPETÁCULO"]').getBoundingClientRect();
    return {
      visibleAnimatedGlyphs,
      cursorCenterX: cursor.left + (cursor.width / 2),
      progressCenterX: progress.left + (progress.width / 2),
      viewportHalf: window.innerWidth / 2
    };
  });
  assert.deepEqual(postBiosVisual.visibleAnimatedGlyphs, [">"], "o pós-BIOS deve ter exatamente um glifo piscando");
  assert(postBiosVisual.cursorCenterX < postBiosVisual.viewportHalf, "o cursor deve permanecer no quadrante do chatbot");
  assert(postBiosVisual.progressCenterX > postBiosVisual.viewportHalf, "a barra deve permanecer em outro quadrante");
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[aria-label="Cursor da Caixa Preta"]')).opacity) > 0.9);
  await page.screenshot({ path: "/private/tmp/caixa-preta-videomapping-pos-bios.png" });

  async function postWarmup(action, payload = {}) {
    const response = await page.request.post(`${BASE_URL}/api/audience-warmup`, { data: { action, ...payload } });
    const body = await response.json();
    assert.equal(response.ok(), true, `${action}: ${body.error || "request failed"}`);
  }

  async function progressBarCenterY() {
    await page.getByRole("progressbar", { name: /^DESBLOQUEIO DO ESPETÁCULO:/ }).waitFor();
    return page.getByRole("progressbar", { name: /^DESBLOQUEIO DO ESPETÁCULO:/ }).evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.top + (bounds.height / 2);
    });
  }

  await postWarmup("set-manual-mode", { manualMode: true });
  await postWarmup("unlock-start-warmup");
  await postWarmup("manual-next");
  await postWarmup("unlock-sound-check-skip");
  await postWarmup("manual-next");
  await page.waitForFunction(async () => {
    const response = await fetch("/api/state");
    return (await response.json()).sceneZero.unlock.status === "HUMAN_VERIFICATION";
  });
  const verificationBarCenterY = await progressBarCenterY();
  await postWarmup("manual-next");
  await page.waitForFunction(async () => {
    const response = await fetch("/api/state");
    return (await response.json()).audienceWarmup.phase === "questions";
  });
  const questionBarCenterY = await progressBarCenterY();
  assert.ok(
    Math.abs(questionBarCenterY - verificationBarCenterY) <= 1,
    `a barra não pode saltar ao iniciar as perguntas: ${verificationBarCenterY} -> ${questionBarCenterY}`
  );

  const occupiedAuxiliaryGeometry = await page.evaluate(() => {
    const marker = document.querySelector('[data-scene-zero-aux-active]');
    marker.setAttribute("data-scene-zero-aux-active", "true");
    const rect = (selector) => {
      const bounds = document.querySelector(selector).getBoundingClientRect();
      return { left: bounds.left, top: bounds.top };
    };
    return {
      auxiliary: rect('[aria-label="Quadrante de contagens e conteúdos da Cena 0"]'),
      performance: rect('[aria-label="Quadrante de elementos visuais e conteúdos auxiliares"]')
    };
  });
  assert.ok(
    occupiedAuxiliaryGeometry.auxiliary.left < occupiedAuxiliaryGeometry.performance.left,
    "quando uma contagem ocupa o quadrante inferior esquerdo, os visuais devem migrar para o inferior direito"
  );

  async function switchProjection(path, expectedLayout) {
    const response = await page.evaluate(async ({ path, projectionWindowId }) => {
      await fetch("/api/projection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          projectionWindowId,
          path: `${window.location.pathname}${window.location.search}`
        })
      });
      const result = await fetch("/api/projection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "navigate", projectionWindowId, path })
      });
      return { ok: result.ok, body: await result.json() };
    }, { path, projectionWindowId: PROJECTION_WINDOW_ID });

    assert.equal(response.ok, true, response.body?.error);
    await page.waitForFunction(
      ({ layout, pathname }) => (
        document.querySelector("[data-public-layout]")?.dataset.publicLayout === layout
        && window.location.pathname === pathname
      ),
      { layout: expectedLayout, pathname: path }
    );
    assert.equal(await page.locator("[data-public-layout]").getAttribute("data-mount-marker"), "preserved");
  }

  await switchProjection("/", "principal");
  const principalGeometry = await page.evaluate(() => {
    const pane = document.querySelector('[aria-label="Chat publico"]').getBoundingClientRect();
    const main = document.querySelector('[aria-label="Fala atual da Caixa Preta"]').getBoundingClientRect();
    return {
      pane: { width: pane.width, height: pane.height },
      main: { width: main.width, height: main.height }
    };
  });
  assert.deepEqual(principalGeometry.main, principalGeometry.pane);
  await switchProjection("/videomapping", "quadrants");

  console.log("Videomapping browser test passed: 2x2 geometry and in-place layout switching.");
} finally {
  await browser.close();
}
