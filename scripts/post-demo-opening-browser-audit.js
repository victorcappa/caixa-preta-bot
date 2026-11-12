import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// The audit copy initially links the real assets tree. Replace only that link so
// automatic entry cannot inspect real audience photographs in textual fixtures.
export async function isolateEmptyPostDemoPhotos(root) {
  assert.notEqual(path.resolve(root), process.cwd(), "As fotos de teste exigem checkout isolado.");
  const assets = path.join(root, "assets");
  assert((await fs.lstat(assets)).isSymbolicLink(), "A fixture precisa de seu próprio diretório de assets.");
  const source = await fs.realpath(assets);
  await fs.unlink(assets); await fs.mkdir(assets);
  for (const name of await fs.readdir(source)) if (name !== "publico") await fs.symlink(path.join(source, name), path.join(assets, name));
  await fs.mkdir(path.join(assets, "publico"));
}

// Install before entering the tab. Hold the real browser's completed-typing ACK
// while assertions inspect the opening gate; release it without synthesizing UI.
export async function holdPostDemoOpening(pages) {
  const records = [], handlers = new Map(), active = new Set(); let released = false, disposal;
  async function addPage(page) {
    const handle = async route => {
      const request = route.request(), body = request.method() === "POST" ? request.postDataJSON() : null;
      if (released || body?.action !== "opening-ack") return route.continue();
      const element = page.getByLabel("Fala da ilha futura", { exact: true });
      const record = { openingId: body.openingId, content: await element.innerText(),
        typing: await element.locator("p").getAttribute("data-typing"), url: page.url() };
      const wait = new Promise(resolve => { record.release = resolve; }); records.push(record);
      if (!released) await wait;
      return route.continue().catch(error => { if (!page.isClosed()) throw error; });
    };
    const handler = route => {
      const work = handle(route); active.add(work);
      work.then(() => active.delete(work), () => active.delete(work)); return work;
    };
    handlers.set(page, handler); await page.route("**/api/post-demo", handler);
  }
  for (const page of pages) await addPage(page);
  const release = () => { released = true; for (const record of records) record.release(); };
  return { records, addPage, release, dispose: () => disposal ||= (async () => {
    release();
    // unroute automatically continues a pending server route. Drain our own
    // continuations first so it cannot race a second route.continue() on that ACK.
    while (active.size) await Promise.all([...active]);
    for (const [page, handler] of handlers) if (!page.isClosed()) await page.unroute("**/api/post-demo", handler);
    handlers.clear();
  })() };
}

export async function auditPostDemoOpening({ projection, control, gate, base, sessionId, providerCallsFile, output,
  checkReload = false, beforeAck, afterTypingBeforeReload, expectNoPriorCalls = true, reportName = "opening-report.json" }) {
  const url = new URL(base);
  assert(["localhost", "127.0.0.1"].includes(url.hostname) && url.port && url.port !== "3000", "A abertura exige servidor de teste isolado.");
  const report = { ok: false, checks: [] };
  async function get(route) { const response = await fetch(base + route); assert(response.ok, route); return response.json(); }
  const details = async () => (await get("/api/post-demo")).postDemo;
  async function command(action, data = {}) {
    const response = await fetch(base + "/api/post-demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, sessionId, ...data }) });
    assert(response.ok, await response.text());
  }
  async function poll(run, label, timeout = 60000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const result = await run(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 65)); }
    throw Error(`Timeout: ${label}`);
  }
  const providerMarker = async () => {
    try { const stat = await fs.stat(providerCallsFile); return { text: await fs.readFile(providerCallsFile, "utf8"), mtime: stat.mtimeMs }; }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
  };
  try {
    const baselineCalls = await providerMarker();
    if (expectNoPriorCalls) assert.equal(baselineCalls, null, "A fixture já chamou o modelo antes de auditar a abertura.");
    const opening = await poll(async () => { const current = await details(); return current.opening && !current.totalRounds && current.opening; }, "fala de abertura antes das cartas");
    assert(opening.content.trim().length >= 100, "A fala de abertura está vazia/incompleta.");
    assert.equal(opening.presentedAt, null); assert.equal((await details()).status, "opening");
    assert.equal((await details()).active, true);
    await poll(async () => await projection.locator('[data-post-demo-module="card"]').count() === 0, "nenhuma carta visível durante a abertura");
    assert.deepEqual(await providerMarker(), baselineCalls, "O modelo foi chamado antes da confirmação da abertura.");
    const publicOpening = (await get("/api/state")).postDemo.opening;
    assert.deepEqual(Object.keys(publicOpening).sort(), ["content", "createdAt", "id", "presentedAt"]);
    assert.equal(publicOpening.id, opening.id);
    await poll(() => gate.records.some(record => record.openingId === opening.id), "digitação completa da abertura emite ACK");
    const acknowledgements = gate.records.filter(record => record.openingId === opening.id);
    for (const record of acknowledgements) {
      assert.equal(record.content.trim(), opening.content.trim(), "ACK da abertura chegou antes de toda a fala visível.");
      assert.equal(record.typing, "false");
    }
    assert.equal((await details()).totalRounds, 0); assert.equal((await details()).opening.presentedAt, null);
    assert.deepEqual(await providerMarker(), baselineCalls, "O modelo foi chamado enquanto o ACK de abertura estava retido.");
    if (afterTypingBeforeReload) await afterTypingBeforeReload({ opening, report });
    if (checkReload) {
      await control.reload(); await control.locator("#post-demo-parameters").waitFor();
      assert.equal((await details()).opening.id, opening.id); assert.equal((await details()).totalRounds, 0);
      assert.deepEqual(await providerMarker(), baselineCalls);
      report.checks.push("reload privado mantém a mesma abertura sem iniciar cartas ou chamar o modelo");
    }
    if (beforeAck) await beforeAck({ opening, report });
    gate.release();
    const first = await poll(async () => { const current = await details(); return current.totalRounds === 1 && current; }, "primeira carta somente após ACK da abertura");
    assert(first.opening.presentedAt);
    const marker = await providerMarker(); assert(marker, "A primeira carta não chamou o provedor da fixture.");
    assert.notDeepEqual(marker, baselineCalls, "O ACK não iniciou a geração da primeira carta.");
    await command("opening-ack", { openingId: opening.id });
    const duplicate = await details();
    assert.equal(duplicate.opening.presentedAt, first.opening.presentedAt);
    assert.equal(duplicate.totalRounds, 1, "Um segundo ACK da abertura gerou outra carta.");
    assert.deepEqual(await providerMarker(), marker, "O segundo ACK repetiu a chamada ao modelo.");
    report.opening = { ...opening, presentedAt: first.opening.presentedAt };
    report.acknowledgements = gate.records.map(({ openingId, content, typing, url }) => ({ openingId, content, typing, url }));
    report.checks.push("abertura digitada antes da primeira carta; sem chamada ao modelo antes do ACK; ACK repetido idempotente");
    report.ok = true;
  } catch (error) { report.error = error.stack || String(error); throw error; }
  finally {
    await gate.dispose();
    if (output) await fs.writeFile(path.join(output, reportName), JSON.stringify(report, null, 2));
  }
  return report;
}
