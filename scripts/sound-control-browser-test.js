const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function setRange(locator, value) {
  await locator.evaluate((input, nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, `${nextValue}`);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleProblems = [];
  let originalSettings = null;

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  try {
    await page.goto("http://localhost:3000/sound-control", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "SOUND CONTROL" }).waitFor();
    await page.getByText("CONNECTED", { exact: true }).waitFor({ timeout: 10000 });
    assert.equal(
      await page.getByRole("link", { name: "Sound Control", exact: true }).getAttribute("aria-current"),
      "page"
    );

    originalSettings = await page.evaluate(async () => {
      const response = await fetch("/api/robot-sound", { cache: "no-store" });
      return (await response.json()).robotSound;
    });

    const panel = page.getByLabel("Robot Sound Engine");
    await panel.getByLabel("Estilo geral dos efeitos do robô").selectOption("system95");
    await setRange(panel.getByRole("slider", { name: "Sensibilidade do microfone" }), 1.75);
    await setRange(panel.getByLabel("Altura dos efeitos do robô"), 6);
    await setRange(panel.getByLabel("Frequência do som de digitação do robô"), 1);
    await page.waitForTimeout(350);
    await page.waitForFunction(async (initialSequence) => {
      const response = await fetch("/api/robot-sound", { cache: "no-store" });
      const settings = (await response.json()).robotSound;
      return settings.sequence > initialSequence
        && settings.soundStyle === "system95"
        && settings.microphoneSensitivity === 1.75
        && settings.typingFrequency === 1
        && Math.abs(settings.pitchScale - Math.SQRT2) < 0.001;
    }, originalSettings.sequence || 0);
    const savedSettings = await page.evaluate(async () => {
      const response = await fetch("/api/robot-sound", { cache: "no-store" });
      return (await response.json()).robotSound;
    });
    assert.equal(savedSettings.soundStyle, "system95");
    assert.equal(savedSettings.microphoneSensitivity, 1.75);
    assert.equal(savedSettings.typingFrequency, 1);
    assert(Math.abs(savedSettings.pitchScale - Math.SQRT2) < 0.001);

    await page.evaluate(() => {
      const sound = window.__caixaPretaRobotSoundEngine;
      window.__computerBlips = [];
      const originalComputerBlip = sound.computerBlip.bind(sound);
      sound.computerBlip = (options) => {
        window.__computerBlips.push({
          durationMs: options.durationMs,
          pitch: options.pitch,
          toPitch: options.toPitch
        });
        return originalComputerBlip(options);
      };
    });
    await panel.getByRole("button", { name: "TEST DIGITAÇÃO" }).click();
    await page.waitForFunction(() => window.__computerBlips?.length > 0);
    const blip = await page.evaluate(() => window.__computerBlips[0]);
    assert(blip.durationMs >= 30);
    assert.notEqual(blip.pitch, blip.toPitch);
    assert.deepEqual(consoleProblems, []);

    console.log("sound control browser test passed: default 90s PC blip and shared controls");
  } finally {
    if (originalSettings && !page.isClosed()) {
      await page.evaluate(async (settings) => {
        await fetch("/api/robot-sound", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings })
        });
      }, originalSettings).catch(() => {});
    }
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
