import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { InstagramController, getInstagramConfig } from "../lib/instagram/InstagramController.js";

// Opt-in real read check. Never log cookies, storage, credentials, HTML or frames.
if (!process.argv.includes("--live")) {
  throw new Error("Use --live for the authorized read-only Instagram check.");
}
const config = getInstagramConfig();
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "caixa-instagram-readonly-"));
const result = { account: "caixapretabot", writesBlocked: true, authenticated: false };
const profileNetwork = [];
const blockedQueries = new Set();
const controller = new InstagramController({
  config: { ...config, embedded: true, debug: false, theatricalDelayMs: 0, profileDir: temporary },
  credentialsLoader: async () => null
});
try {
  // Use a disposable copy so the real profile/session is never rewritten.
  await fs.cp(config.profileDir, temporary, {
    recursive: true,
    filter: (source) => !/Singleton|DevToolsActivePort/.test(path.basename(source))
  }).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  await controller.init();
  controller.page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname === "/caixapretabot/" || pathname === "/graphql/query") {
      profileNetwork.push({ kind: pathname === "/caixapretabot/" ? "profile" : "query", status: response.status() });
    }
  });
  await controller.context.route("**/*", (route) => {
    const request = route.request();
    const operation = new URLSearchParams(request.postData() || "").get("fb_api_req_friendly_name")
      || request.headers()["x-fb-friendly-name"] || "";
    // Instagram also transports reads via POST. Only named Queries are allowed;
    // login, mutations, DMs, likes and comment submissions remain blocked.
    const readQuery = request.method() === "POST"
      && /\/(?:api\/graphql|graphql\/query)\/?$/.test(new URL(request.url()).pathname)
      && /^\w*Query$/.test(operation);
    if (request.method() === "POST" && /Query$/.test(operation) && !readQuery) blockedQueries.add(operation);
    return ["GET", "HEAD", "OPTIONS"].includes(request.method()) || readQuery
      ? route.continue() : route.abort("blockedbyclient");
  });
  controller.page.setDefaultNavigationTimeout(20000);
  const started = Date.now();
  const response = await controller.page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" });
  result.httpStatus = response?.status();
  await controller.page.waitForTimeout(1500);
  result.session = await controller.getSessionState();
  result.authenticated = result.session === "authenticated";
  result.loginFields = await controller.page.locator("input[name='username'],input[name='password']").count();
  result.visibleImages = await controller.page.locator("img").count();
  result.homeMediaLinks = await controller.page.locator("a[href*='/p/'],a[href*='/reel/']").count();
  result.homeFrameBytes = (await controller.captureFrame()).image.length;
  result.ms = Date.now() - started;
  if (result.authenticated) {
    try {
      const profile = await controller.openProfile("caixapretabot");
      result.profileStatus = profile.status;
    } catch (error) {
      result.profileStatus = error.name;
    }
    result.profileMediaLinks = await controller.page.locator("a[href*='/p/'],a[href*='/reel/']").count();
    result.profileMainCount = await controller.page.getByRole("main").count();
    result.profileRouteMatches = /instagram\.com\/caixapretabot\/?/.test(controller.page.url());
    const body = await controller.safeBodyText();
    result.profileErrorPage = /something went wrong|algo deu errado|page isn.t available|p.gina n.o est. dispon.vel/i.test(body);
    result.profileBlank = body.trim().length === 0;
    result.profileNetwork = profileNetwork;
    result.blockedReadQueries = [...blockedQueries];
    result.frameBytes = (await controller.captureFrame()).image.length;
  }
} catch (error) {
  result.error = error.name;
  result.reason = /ERR_NAME_NOT_RESOLVED/.test(error.message) ? "DNS"
    : /ERR_CERT/.test(error.message) ? "TLS"
      : /ERR_CONNECTION/.test(error.message) ? "CONNECTION"
        : /Timeout/.test(error.name) ? "TIMEOUT" : "BROWSER_FAILURE";
} finally {
  await controller.close().catch(() => {});
  await fs.rm(temporary, { recursive: true, force: true });
}
const output = process.env.CAIXA_PRETA_AUDIT_OUTPUT || "artifacts/bot-audit-2026-10-14";
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, "instagram-live.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
