import { chromium } from "playwright";

const BASE_URL = process.env.CAIXA_PRETA_URL || "http://localhost:3000";
const TEST_NOTE = `LEMBRETE TESTE ${Date.now()}`;

async function clearNote(sceneId) {
  const response = await fetch(`${BASE_URL}/api/scene-notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sceneId, content: "" })
  });

  if (!response.ok) throw new Error(`Nao foi possivel limpar ${sceneId}`);
}

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(10000);
  await page.goto(`${BASE_URL}/cena-0-controller`, { waitUntil: "domcontentloaded" });

  const sceneZeroNotes = page.getByLabel("Bloquinho de anotações de CENA 0");
  await sceneZeroNotes.waitFor({ state: "visible" });
  await sceneZeroNotes.fill(TEST_NOTE);
  await page.waitForFunction(
    (expected) => window.localStorage.getItem("caixa-preta.sceneNote.bot-malas") === expected,
    TEST_NOTE
  );
  await page.getByLabel("Anotações de CENA 0").getByText("SALVO", { exact: true }).waitFor({ state: "visible" });

  await page.goto(`${BASE_URL}/baralho-morbido-controller`, { waitUntil: "domcontentloaded" });
  const baralhoNotes = page.getByLabel("Bloquinho de anotações de CENA 2C");
  await baralhoNotes.waitFor({ state: "visible" });
  if (await baralhoNotes.inputValue()) throw new Error("Notas vazaram entre cenas");

  await page.goto(`${BASE_URL}/cena-0-controller`, { waitUntil: "domcontentloaded" });
  await sceneZeroNotes.waitFor({ state: "visible" });
  await page.waitForFunction(
    (expected) => document.querySelector('textarea[aria-label="Bloquinho de anotações de CENA 0"]')?.value === expected,
    TEST_NOTE
  );

  console.log("SCENE NOTES BROWSER TEST PASSED");
} catch (error) {
  console.error("SCENE NOTES BROWSER TEST FAILED", error);
  process.exitCode = 1;
} finally {
  await Promise.all([clearNote("bot-malas"), clearNote("baralho-morbido")]);
  await browser.close();
}
