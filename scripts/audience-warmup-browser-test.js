import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.CAIXA_PRETA_URL || "http://localhost:3000";

async function warmup(request, action, payload = {}) {
  const response = await request.post(`${BASE_URL}/api/audience-warmup`, { data: { action, ...payload } });
  const data = await response.json();
  assert.equal(response.ok(), true, `${action}: ${data.error || "request failed"}`);
  return data.audienceWarmup;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const externalRequests = [];
context.on("request", (request) => {
  if (/instagram\.com/i.test(request.url())) externalRequests.push(request.url());
});

try {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } });
  const display = await context.newPage();
  await display.setViewportSize({ width: 1920, height: 1080 });
  await display.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const operator = await context.newPage();
  const pageErrors = [];
  operator.on("pageerror", (error) => pageErrors.push(error.message));
  await operator.setViewportSize({ width: 1440, height: 1000 });
  await operator.goto(`${BASE_URL}/operator`, { waitUntil: "domcontentloaded" });

  await operator.getByRole("heading", { name: "ESQUENTAR PÚBLICO" }).waitFor();
  const wordAction = operator.getByRole("button", { name: /Falar uma palavra/ });
  await operator.waitForFunction(() => document.querySelector('[aria-labelledby="audience-warmup-title"]')?.getAttribute("aria-busy") === "false");
  assert.equal(await wordAction.isEnabled(), true, `ação deve estar habilitada; page errors: ${pageErrors.join(" | ")}`);
  await Promise.all([
    operator.waitForResponse((response) => response.url().endsWith("/api/audience-warmup") && response.request().postDataJSON()?.action === "select-action"),
    wordAction.click()
  ]);
  await operator.getByRole("button", { name: "MÉDIO" }).click();
  await Promise.all([
    operator.waitForResponse((response) => response.url().endsWith("/api/audience-warmup") && response.request().postDataJSON()?.action === "generate"),
    operator.getByRole("button", { name: "GERAR PERGUNTA" }).click()
  ]);
  const preview = operator.getByLabel("Preview do esquentar público");
  await operator.waitForFunction(() => {
    const text = document.querySelector('[aria-label="Preview do esquentar público"] p')?.textContent || "";
    return text.length > 10 && !text.includes("Escolha uma ação");
  });
  const generatedText = (await preview.locator("p").textContent()).trim();
  assert(generatedText.length > 10 && !generatedText.includes("Escolha uma ação"));
  await display.getByText(generatedText, { exact: true }).waitFor();
  await display.screenshot({ path: "/private/tmp/caixa-preta-warmup-medium.png" });

  let snapshot = await (await context.request.get(`${BASE_URL}/api/state`)).json();
  assert.equal(snapshot.conversation.length, 1);
  assert.equal(snapshot.publicMessage.content, generatedText);

  const manualText = "Quem veio acompanhado levanta a mão.";
  await operator.getByLabel("FRASE MANUAL").fill(manualText);
  await Promise.all([
    operator.waitForResponse((response) => response.url().endsWith("/api/audience-warmup") && response.request().postDataJSON()?.action === "send"),
    operator.getByLabel("FRASE MANUAL").press("Enter")
  ]);
  await display.getByText(manualText, { exact: true }).waitFor();
  await display.screenshot({ path: "/private/tmp/caixa-preta-warmup-short.png" });
  assert.equal(await display.getByText(generatedText, { exact: true }).count(), 0, "a fala anterior não deve ocupar a projeção");
  snapshot = await (await context.request.get(`${BASE_URL}/api/state`)).json();
  assert.equal(snapshot.conversation.length, 2, "histórico interno deve preservar A e B");

  const beforeSurprise = snapshot.conversation.length;
  await Promise.all([
    operator.waitForResponse((response) => response.url().endsWith("/api/audience-warmup") && response.request().postDataJSON()?.action === "surprise"),
    operator.getByRole("button", { name: "SURPREENDA-ME" }).click()
  ]);
  snapshot = await (await context.request.get(`${BASE_URL}/api/state`)).json();
  assert.equal(snapshot.conversation.length, beforeSurprise + 1, "surpresa deve ser enviada imediatamente");
  assert.equal(snapshot.publicMessage.content, snapshot.audienceWarmup.preview);

  await warmup(context.request, "select-action", { selectedAction: "word" });
  await warmup(context.request, "set-interval", { intervalMs: 800 });
  await warmup(context.request, "send", { text: "Quando eu disser três, digam uma cor." });
  await display.getByText("Três.", { exact: true }).waitFor({ timeout: 8000 });
  snapshot = await (await context.request.get(`${BASE_URL}/api/state`)).json();
  assert.deepEqual(snapshot.audienceWarmup.history.slice(-4).map((entry) => entry.text), [
    "Quando eu disser três, digam uma cor.",
    "Um.",
    "Dois.",
    "Três."
  ], "uma instrução que promete três deve cumprir a contagem automaticamente");
  assert.equal(snapshot.audienceWarmup.awaitingOperator, true, "depois do três, a reação volta a aguardar o operador");
  const beforeRepeat = (await (await context.request.get(`${BASE_URL}/api/state`)).json()).conversation.length;
  await warmup(context.request, "repeat");
  snapshot = await (await context.request.get(`${BASE_URL}/api/state`)).json();
  assert.equal(snapshot.conversation.length, beforeRepeat + 1);
  assert.equal(snapshot.publicMessage.content, "Três.");
  await warmup(context.request, "cancel");
  snapshot = await (await context.request.get(`${BASE_URL}/api/state`)).json();
  assert.equal(snapshot.audienceWarmup.active, false);

  const directWordText = "Diga uma palavra que descreve seu trabalho.";
  const beforeDirectWord = snapshot.conversation.length;
  await warmup(context.request, "send", { text: directWordText });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  snapshot = await (await context.request.get(`${BASE_URL}/api/state`)).json();
  assert.equal(snapshot.conversation.length, beforeDirectWord + 1, "uma fala sem promessa de contagem não deve iniciar Um, Dois, Três");
  assert.equal(snapshot.publicMessage.content, directWordText);
  await warmup(context.request, "cancel");

  await warmup(context.request, "select-action", { selectedAction: "clap" });
  await warmup(context.request, "set-automatic", { automatic: true });
  await warmup(context.request, "send", { text: "Quem chegou cedo bate palmas." });
  const beforeAutomaticCancel = (await (await context.request.get(`${BASE_URL}/api/state`)).json()).conversation.length;
  await warmup(context.request, "cancel");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  snapshot = await (await context.request.get(`${BASE_URL}/api/state`)).json();
  assert.equal(snapshot.conversation.length, beforeAutomaticCancel, "cancelar deve interromper o avanço automático imediatamente");
  await warmup(context.request, "send", { text: "Quem ouviu a máquina bate palmas." });
  await display.getByText("Interessante.", { exact: true }).waitFor({ timeout: 4000 });
  snapshot = await (await context.request.get(`${BASE_URL}/api/state`)).json();
  assert.equal(snapshot.audienceWarmup.active, false, "sequência automática deve concluir");
  await warmup(context.request, "set-automatic", { automatic: false });

  const longText = "Esta é uma mensagem longa para validar a leitura em projeção, a largura confortável, a quebra responsiva das linhas e a permanência integral do texto dentro da área visível sem criar uma coluna crescente de mensagens anteriores.";
  await warmup(context.request, "send", { text: longText });
  await display.getByText(longText, { exact: true }).waitFor();
  const geometry = await display.getByText(longText, { exact: true }).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: innerWidth, height: innerHeight, fontSize: parseFloat(getComputedStyle(element).fontSize) };
  });
  assert(geometry.top >= 0 && geometry.left >= 0 && geometry.bottom <= geometry.height && geometry.right <= geometry.width, `texto longo deve caber na viewport: ${JSON.stringify(geometry)}`);
  assert(geometry.fontSize >= 32, "tipografia pública deve ser grande");
  await display.screenshot({ path: "/private/tmp/caixa-preta-warmup-display.png" });
  const warmupPanel = operator.getByRole("region", { name: "ESQUENTAR PÚBLICO" });
  await warmupPanel.evaluate((element) => { element.scrollTop = 0; });
  await warmupPanel.screenshot({ path: "/private/tmp/caixa-preta-warmup-controller.png" });
  await warmupPanel.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await warmupPanel.screenshot({ path: "/private/tmp/caixa-preta-warmup-controller-transport.png" });

  await warmup(context.request, "clear");
  snapshot = await (await context.request.get(`${BASE_URL}/api/state`)).json();
  assert.equal(snapshot.publicMessage, null);
  assert(snapshot.conversation.length >= 7, "limpar tela não deve apagar histórico");
  await display.waitForFunction(() => !document.querySelector('[aria-label="Fala atual da Caixa Preta"] p'));
  assert.deepEqual(externalRequests, [], "fluxo normal não deve abrir Instagram");

  console.log("audience warmup browser tests passed");
} finally {
  await context.request.post(`${BASE_URL}/api/operator`, { data: { command: "/reset" } }).catch(() => {});
  await context.close();
  await browser.close();
}
