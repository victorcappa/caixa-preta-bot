const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleProblems = [];
  const failedResponses = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  try {
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.getByText("CONNECTED", { exact: true }).first().waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "Abrir terminal operador ao lado" }).click();
    await page.getByLabel("Robot Sound Engine").waitFor();
    await page.getByRole("button", { name: "TEST DIGITAÇÃO" }).click();
    await page.waitForFunction(() => window.__caixaPretaRobotSoundEngine?.context?.state === "running");
    await page.waitForFunction(() => window.__caixaPretaRobotSoundEngine?.activeSources?.size > 0);

    const burst = await page.evaluate(() => {
      const sound = window.__caixaPretaRobotSoundEngine;
      const text = "ABC 123, ISSO? SIM!\n".repeat(35);
      let peak = 0;
      for (const character of text) {
        sound.typing(character, { force: true });
        peak = Math.max(peak, sound.activeSources.size);
      }
      return { peak, totalCharacters: text.length };
    });
    assert(burst.totalCharacters > 600);
    assert(burst.peak <= 14);
    await page.waitForFunction(() => window.__caixaPretaRobotSoundEngine.activeSources.size === 0);

    const soundPanel = page.getByLabel("Robot Sound Engine");
    await soundPanel.getByLabel("Volume geral dos efeitos do robô").fill("0.22");
    await soundPanel.getByLabel("Volume da digitação do robô").fill("0.35");
    await soundPanel.getByRole("combobox").selectOption("instavel");
    await page.waitForFunction(async () => {
      const response = await fetch("/api/robot-sound");
      const settings = (await response.json()).robotSound;
      return settings.preset === "instavel" && settings.masterVolume === 0.22 && settings.typingVolume === 0.35;
    });

    await soundPanel.getByRole("button", { name: "TEST THINKING" }).click();
    await page.waitForFunction(() => window.__caixaPretaRobotSoundEngine.thinking === true);
    await soundPanel.getByRole("button", { name: "TEST WAKE" }).click();
    await page.waitForFunction(() => window.__caixaPretaRobotSoundEngine.thinking === false);
    for (const label of ["TEST SUCCESS / OBEY", "TEST ERROR", "TEST GLITCH", "TEST IMPACT"]) {
      await soundPanel.getByRole("button", { name: label }).click();
    }

    await soundPanel.getByRole("button", { name: "SOUND ON" }).click();
    await page.waitForFunction(() => window.__caixaPretaRobotSoundEngine?.settings?.enabled === false);
    assert.equal(await page.evaluate(() => window.__caixaPretaRobotSoundEngine.activeSources.size), 0);
    await soundPanel.getByRole("button", { name: "SOUND OFF" }).click();
    await page.waitForFunction(async () => {
      const response = await fetch("/api/robot-sound");
      return (await response.json()).robotSound.enabled === true;
    });

    const operatorInput = page.getByLabel("Comando do operator");
    await operatorInput.fill("/reset");
    await operatorInput.press("Enter");
    await page.waitForFunction(() => window.__caixaPretaRobotSoundEngine?.activeSources?.size > 0, null, { timeout: 6500 });
    await page.getByText("TEM ALGUEM AI?", { exact: false }).waitFor({ timeout: 7000 });

    await page.evaluate(async () => {
      const sound = window.__caixaPretaRobotSoundEngine;
      window.__robotGhostCount = 0;
      const originalTyping = sound.typing.bind(sound);
      sound.typing = (...args) => {
        window.__robotGhostCount += 1;
        return originalTyping(...args);
      };
      await fetch("/api/glitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger", payload: { preset: "strong", durationMs: 3500 } })
      });
    });
    await page.waitForFunction(() => {
      const sound = window.__caixaPretaRobotSoundEngine;
      return sound?.glitch?.active && sound.glitch.ghostTyping;
    });
    await page.waitForFunction(() => window.__robotGhostCount > 0, null, { timeout: 4200 });

    await page.evaluate(async () => {
      await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "/stopall" })
      });
    });
    await page.waitForFunction(() => window.__caixaPretaRobotSoundEngine?.activeSources?.size === 0);

    const relevantProblems = consoleProblems.filter((line) => (
      !line.includes("favicon") &&
      !line.includes("Failed to load resource: the server responded with a status of 400")
    ));
    const relevantResponses = failedResponses.filter((line) => !line.includes("/api/projection"));
    assert.deepEqual(relevantProblems, []);
    assert.deepEqual(relevantResponses, []);

    await page.goto("http://localhost:3000/operator", { waitUntil: "domcontentloaded" });
    await page.getByText("CONNECTED", { exact: true }).first().waitFor({ timeout: 10000 });
    await page.getByLabel("Robot Sound Engine").waitFor();
    console.log("robot sound browser tests passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
