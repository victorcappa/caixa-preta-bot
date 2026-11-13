import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import { chromium } from "playwright";

// Real HTTP/1.1 sockets and browser workers, without touching the live show.
let revision = 1;
let streamsOpened = 0;
let workerUnavailable = false;
const streams = new Set();
const snapshot = () => ({ event: { type: "snapshot" }, state: { revision, marker: `frame-${revision}` } });
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/api/events") {
    streamsOpened += 1;
    streams.add(response);
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    response.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    request.on("close", () => streams.delete(response));
  } else if (url.pathname === "/api/state") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(url.searchParams.has("revision") ? { revision } : snapshot().state));
  } else if (url.pathname === "/lib/publicRealtime.js" || url.pathname === "/public-realtime-worker.js") {
    if (workerUnavailable && url.pathname === "/public-realtime-worker.js") {
      response.writeHead(404).end();
      return;
    }
    try {
      const file = url.pathname.startsWith("/lib/") ? `.${url.pathname}` : `./public${url.pathname}`;
      response.setHeader("Content-Type", "text/javascript");
      response.end(await fs.readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end(`<script type="module">
      import { subscribePublicRealtime } from '/lib/publicRealtime.js';
      window.framesSeen = [];
      window.unsubscribe = subscribePublicRealtime(payload => {
        window.currentFrame = payload.state;
        window.framesSeen.push(payload.state.revision);
      }, status => { window.connection = status; });
      window.unsubscribeSecond = subscribePublicRealtime(() => {});
    </script>`);
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });

async function advance(pages, { sse = true } = {}) {
  revision += 1;
  if (sse) for (const stream of streams) stream.write(`data: ${JSON.stringify(snapshot())}\n\n`);
  await Promise.all(pages.map(page => page.waitForFunction(expected => window.currentFrame?.revision === expected, revision, { timeout: 6000 })));
}

try {
  const context = await browser.newContext();
  context.setDefaultTimeout(7000);
  const pages = [];
  for (let index = 0; index < 9; index += 1) {
    const page = await context.newPage();
    await page.goto(base);
    await page.waitForFunction(() => window.currentFrame?.revision >= 1);
    pages.push(page);
  }
  assert.equal(streams.size, 1, "nine windows must share one SSE connection");
  await advance(pages);
  // Commands must still get a browser HTTP connection with every display open.
  const command = await pages.at(-1).evaluate(async () => {
    const result = await fetch("/api/state", { signal: AbortSignal.timeout(2000) });
    return result.ok;
  });
  assert(command, "open displays must not exhaust the browser connection pool");
  // Losing the first window cannot remove the source of updates.
  await pages.shift().close();
  await advance(pages);
  const frozen = pages.shift();
  const session = await context.newCDPSession(frozen);
  await session.send("Page.setWebLifecycleState", { state: "frozen" });
  await advance(pages);
  await session.send("Page.setWebLifecycleState", { state: "active" });
  await frozen.waitForFunction(expected => window.currentFrame?.revision === expected, revision);
  pages.push(frozen);
  await advance(pages, { sse: false });
  for (const stream of streams) {
    stream.write(`data: ${JSON.stringify({ event: { type: "snapshot" }, state: { revision: 1 } })}\n\n`);
    stream.write(`data: ${JSON.stringify({ event: { type: "snapshot" }, state: { revision, marker: "order-checked" } })}\n\n`);
  }
  await Promise.all(pages.map(page => page.waitForFunction(() => window.currentFrame.marker === "order-checked")));
  for (const page of pages) {
    const seen = await page.evaluate(() => window.framesSeen);
    assert(seen.every((value, index) => index === 0 || value >= seen[index - 1]), "late SSE must never roll back a polled snapshot");
  }
  await context.close();

  // No worker support or a worker load failure must use finite polling requests.
  for (const workerMode of ["unsupported", "failed", "unloadable"]) {
    workerUnavailable = workerMode === "unloadable";
    const fallback = await browser.newContext();
    await fallback.addInitScript(mode => {
      if (mode === "unloadable") return;
      Object.defineProperty(window, "SharedWorker", { value: mode === "unsupported" ? undefined : class {
        constructor() { throw new Error("worker unavailable"); }
      } });
    }, workerMode);
    const previousStreams = streamsOpened;
    const fallbackPages = await Promise.all(Array.from({ length: 8 }, async () => {
      const page = await fallback.newPage();
      await page.goto(base);
      await page.waitForFunction(() => Boolean(window.currentFrame));
      await page.waitForFunction(() => window.connection === "connected");
      return page;
    }));
    await advance(fallbackPages, { sse: false });
    assert.equal(streamsOpened, previousStreams, "polling fallback must not open per-window SSE sockets");
    await fallback.close();
  }
  console.log("multiwindow realtime passed: nine windows, one SSE, free command connection, closed/frozen windows, missed events, revision order and polling fallback");
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
