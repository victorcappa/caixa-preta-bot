import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

export const INSTAGRAM_STATUS = {
  DISCONNECTED: "DISCONNECTED",
  STARTING: "STARTING",
  LOGIN_REQUIRED: "LOGIN_REQUIRED",
  READY: "READY",
  NAVIGATING: "NAVIGATING",
  ACTING: "ACTING",
  MANUAL_INTERVENTION: "MANUAL_INTERVENTION",
  ERROR: "ERROR"
};

const ACCOUNT_USERNAME = "caixapretabot";
const INSTAGRAM_HOME = "https://www.instagram.com/";
const DEFAULT_VIEWPORT = { width: 430, height: 760 };
const CONTROLLER_VERSION = 3;
const MOBILE_USER_AGENT = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)",
  "AppleWebKit/605.1.15 (KHTML, like Gecko)",
  "Version/17.5 Mobile/15E148 Safari/604.1"
].join(" ");
const USERNAME_PATTERN = /^[a-zA-Z0-9._]{1,30}$/;
const FOLLOW_STATES = new Set(["follow"]);
const FOLLOWING_STATES = new Set(["following"]);
const REQUESTED_STATES = new Set(["requested"]);
const MANUAL_INTERVENTION_PATTERNS = [
  /challenge/i,
  /checkpoint/i,
  /captcha/i,
  /two-factor/i,
  /two factor/i,
  /suspicious/i,
  /help us confirm/i,
  /confirm it'?s you/i,
  /confirme que/i,
  /verificar/i,
  /verificacao/i,
  /seguranca/i
];

const SAFE_MODAL_BUTTON_PATTERNS = [
  /^Not Now$/i,
  /^Agora n.o\.?$/i,
  /^Depois$/i,
  /^Salvar depois$/i,
  /^Cancel$/i,
  /^Cancelar$/i
];

const BUTTON_STATE_LABELS = {
  follow: ["Follow", "Seguir"],
  following: ["Following", "Seguindo"],
  requested: ["Requested", "Solicitado"],
  message: ["Message", "Mensagem"],
  editProfile: ["Edit profile", "Editar perfil"]
};

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "sim", "on"].includes(`${value}`.trim().toLowerCase());
}

function parseDelay(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 700;
  }

  return Math.min(1500, Math.max(400, parsed));
}

function parseViewportDimension(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function parseInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function getInstagramConfig(env = process.env) {
  const allowedProfiles = `${env.INSTAGRAM_ALLOWED_PROFILES || "cappavictor"}`
    .split(",")
    .map((profile) => normalizeUsername(profile))
    .filter(Boolean);

  return {
    enabled: parseBoolean(env.INSTAGRAM_ENABLED, true),
    embedded: parseBoolean(env.INSTAGRAM_EMBEDDED, true),
    debug: parseBoolean(env.INSTAGRAM_DEBUG, false),
    theatricalDelayMs: parseDelay(env.INSTAGRAM_THEATRICAL_DELAY),
    viewport: {
      width: parseViewportDimension(env.INSTAGRAM_VIEWPORT_WIDTH, DEFAULT_VIEWPORT.width, 320, 768),
      height: parseViewportDimension(env.INSTAGRAM_VIEWPORT_HEIGHT, DEFAULT_VIEWPORT.height, 568, 1200)
    },
    streamFps: parseInteger(env.INSTAGRAM_STREAM_FPS, 18, 4, 30),
    streamQuality: parseInteger(env.INSTAGRAM_STREAM_QUALITY, 62, 35, 90),
    allowedProfiles,
    profileDir: path.join(process.cwd(), ".runtime", "instagram-profile"),
    debugDir: path.join(process.cwd(), ".runtime", "instagram-debug")
  };
}

export function normalizeUsername(username = "") {
  const normalized = `${username}`.trim().replace(/^@+/, "").toLowerCase();
  return USERNAME_PATTERN.test(normalized) ? normalized : "";
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForVisible(locator, timeout) {
  return locator.waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

async function robustLocatorClick(locator) {
  await locator.scrollIntoViewIfNeeded?.({ timeout: 2500 }).catch(() => {});

  try {
    await locator.click({ timeout: 5000 });
    return true;
  } catch {
    try {
      await locator.click({ timeout: 5000, force: true });
      return true;
    } catch {
      await locator.evaluate((element) => element.click());
      return true;
    }
  }
}

function publicError(error) {
  if (!error) {
    return "unknown";
  }

  if (error.name === "TimeoutError") {
    return "timeout";
  }

  return `${error.message || error}`.split("\n")[0].slice(0, 180);
}

export class InstagramController {
  constructor({ config = getInstagramConfig(), reporter = null } = {}) {
    this.config = config;
    this.reporter = reporter;
    this.context = null;
    this.page = null;
    this.status = INSTAGRAM_STATUS.DISCONNECTED;
    this.lastError = null;
    this.lastButtonState = null;
    this.currentUrl = null;
    this.lastAction = null;
    this.targetProfile = null;
    this.controllerVersion = CONTROLLER_VERSION;
  }

  setReporter(reporter) {
    this.reporter = reporter;
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      embedded: this.config.embedded,
      account: ACCOUNT_USERNAME,
      status: this.status,
      lastError: this.lastError,
      lastButtonState: this.lastButtonState,
      currentUrl: this.currentUrl,
      lastAction: this.lastAction,
      targetProfile: this.targetProfile,
      profileDir: this.config.profileDir,
      debugDir: this.config.debug ? this.config.debugDir : null,
      viewport: this.config.viewport,
      streamFps: this.config.streamFps,
      streamQuality: this.config.streamQuality,
      updatedAt: nowIso()
    };
  }

  async init() {
    if (!this.config.enabled) {
      this.updateStatus(INSTAGRAM_STATUS.DISCONNECTED, "integracao desativada");
      return this.getStatus();
    }

    if (this.context) {
      this.updateStatus(this.status === INSTAGRAM_STATUS.DISCONNECTED ? INSTAGRAM_STATUS.READY : this.status, "contexto existente reutilizado");
      return this.getStatus();
    }

    this.updateStatus(INSTAGRAM_STATUS.STARTING, "iniciando navegador...");
    await fs.mkdir(this.config.profileDir, { recursive: true });

    this.context = await chromium.launchPersistentContext(this.config.profileDir, {
      headless: this.config.embedded,
      viewport: this.config.viewport,
      screen: this.config.viewport,
      hasTouch: this.config.embedded,
      isMobile: this.config.embedded,
      deviceScaleFactor: this.config.embedded ? 2 : 1,
      userAgent: this.config.embedded ? MOBILE_USER_AGENT : undefined,
      slowMo: Math.round(this.config.theatricalDelayMs / 3)
    });

    this.context.on("close", () => {
      this.context = null;
      this.page = null;
      this.updateStatus(INSTAGRAM_STATUS.DISCONNECTED, "navegador fechado");
    });

    this.page = this.context.pages()[0] || await this.context.newPage();
    await this.configurePage();
    this.page.setDefaultTimeout(15000);
    this.updateStatus(INSTAGRAM_STATUS.STARTING, `perfil persistente: ${this.config.profileDir}`);
    return this.getStatus();
  }

  async open() {
    await this.init();
    this.ensurePage();
    await this.configurePage();
    this.lastAction = "open";
    this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, "abrindo instagram.com");
    await this.page.goto(INSTAGRAM_HOME, { waitUntil: "domcontentloaded" });
    this.currentUrl = this.page.url();
    await this.dismissKnownModals();

    const session = await this.getSessionState();
    if (session === "manual_intervention") {
      return { status: "manual_intervention", message: "INSTAGRAM: intervencao manual necessaria" };
    }

    if (session !== "authenticated") {
      this.updateStatus(INSTAGRAM_STATUS.LOGIN_REQUIRED, "login necessario; faca login manual como @caixapretabot");
      return { status: "login_required", message: "INSTAGRAM: login necessario" };
    }

    this.updateStatus(INSTAGRAM_STATUS.READY, "sessao encontrada");
    return { status: "ready", message: "INSTAGRAM: sessao encontrada" };
  }

  async openProfile(username) {
    const safeUsername = this.assertAllowedUsername(username);
    await this.open();

    if (this.status === INSTAGRAM_STATUS.LOGIN_REQUIRED) {
      return { status: "login_required", message: "INSTAGRAM: login necessario" };
    }

    if (this.status === INSTAGRAM_STATUS.MANUAL_INTERVENTION) {
      return { status: "manual_intervention", message: "INSTAGRAM: intervencao manual necessaria" };
    }

    this.targetProfile = safeUsername;
    this.lastAction = "openProfile";
    this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, `abrindo @${safeUsername}`);
    await this.theatricalDelay();
    await this.page.goto(`https://www.instagram.com/${safeUsername}/`, { waitUntil: "domcontentloaded" });
    this.currentUrl = this.page.url();
    await this.waitForProfile(safeUsername);
    await this.dismissKnownModals();
    this.updateStatus(INSTAGRAM_STATUS.READY, "perfil carregado");
    return { status: "ready", message: `INSTAGRAM: perfil @${safeUsername} carregado` };
  }

  async follow(username) {
    const safeUsername = this.assertAllowedUsername(username);
    this.lastAction = `follow @${safeUsername}`;
    this.targetProfile = safeUsername;
    this.updateStatus(INSTAGRAM_STATUS.STARTING, `acao solicitada: seguir @${safeUsername}`);

    try {
      const opened = await this.openProfile(safeUsername);
      if (opened.status !== "ready") {
        return opened;
      }

      const before = await this.getFollowButtonState();
      this.lastButtonState = before.state;
      this.updateStatus(INSTAGRAM_STATUS.READY, `estado do botao: ${before.state || "desconhecido"}`);

      if (!before.state || !before.locator) {
        const openedMedia = await this.openLatestProfileMedia(safeUsername);
        if (openedMedia) {
          const mediaState = await this.getFollowButtonState();
          this.lastButtonState = mediaState.state;
          this.updateStatus(INSTAGRAM_STATUS.READY, `estado do botao na midia: ${mediaState.state || "desconhecido"}`);
          Object.assign(before, mediaState);
        }
      }

      if (FOLLOWING_STATES.has(before.state)) {
        return {
          status: "already_following",
          message: `INSTAGRAM: @${ACCOUNT_USERNAME} ja seguia @${safeUsername}`
        };
      }

      if (REQUESTED_STATES.has(before.state)) {
        return {
          status: "requested",
          message: `INSTAGRAM: solicitacao enviada para @${safeUsername}`
        };
      }

      if (!FOLLOW_STATES.has(before.state) || !before.locator) {
        await this.saveDebugArtifact("follow-state-unconfirmed");
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "botao de seguir nao reconhecido");
        return {
          status: "unconfirmed",
          message: "INSTAGRAM: nao foi possivel confirmar a acao"
        };
      }

      this.updateStatus(INSTAGRAM_STATUS.ACTING, "seguindo...");
      await this.theatricalDelay();
      await robustLocatorClick(before.locator);
      await this.theatricalDelay();

      const after = await this.waitForFollowStateChange();
      this.lastButtonState = after.state;
      this.updateStatus(INSTAGRAM_STATUS.READY, `estado final do botao: ${after.state || "desconhecido"}`);

      if (FOLLOWING_STATES.has(after.state)) {
        return {
          status: "following",
          message: `INSTAGRAM: seguindo @${safeUsername}`
        };
      }

      if (REQUESTED_STATES.has(after.state)) {
        return {
          status: "requested",
          message: `INSTAGRAM: solicitacao enviada para @${safeUsername}`
        };
      }

      await this.saveDebugArtifact("follow-result-unconfirmed");
      return {
        status: "unconfirmed",
        message: "INSTAGRAM: nao foi possivel confirmar a acao"
      };
    } catch (error) {
      const message = publicError(error);
      this.lastError = message;
      await this.saveDebugArtifact("follow-error");
      this.updateStatus(INSTAGRAM_STATUS.ERROR, `erro Playwright: ${message}`);

      if (message === "timeout") {
        return { status: "timeout", message: "INSTAGRAM: nao foi possivel confirmar a acao" };
      }

      return { status: "error", message: "INSTAGRAM: intervencao manual necessaria" };
    }
  }

  async isFollowing(username) {
    await this.openProfile(username);
    const result = await this.getFollowButtonState();
    return FOLLOWING_STATES.has(result.state) || REQUESTED_STATES.has(result.state);
  }

  async close() {
    if (!this.context) {
      this.updateStatus(INSTAGRAM_STATUS.DISCONNECTED, "navegador ja fechado");
      return;
    }

    await this.context.close();
  }

  async captureFrame() {
    const frame = await this.captureJpegFrame({ quality: this.config.streamQuality });

    return {
      image: `data:image/jpeg;base64,${frame.image.toString("base64")}`,
      viewport: frame.viewport,
      status: this.getStatus()
    };
  }

  async captureJpegFrame({ quality = this.config.streamQuality } = {}) {
    this.ensurePage();
    await this.configurePage();
    const viewport = this.page.viewportSize() || this.config.viewport || DEFAULT_VIEWPORT;
    const image = await this.page.screenshot({
      fullPage: false,
      type: "jpeg",
      quality
    });

    this.currentUrl = this.page.url();
    return {
      image,
      viewport
    };
  }

  async sendEmbeddedInput(input = {}) {
    this.ensurePage();
    await this.configurePage();

    if (input.type === "click") {
      const viewport = this.page.viewportSize() || this.config.viewport || DEFAULT_VIEWPORT;
      const x = Math.max(0, Math.min(1, Number(input.x) || 0)) * viewport.width;
      const y = Math.max(0, Math.min(1, Number(input.y) || 0)) * viewport.height;
      await this.page.mouse.click(x, y);
      return { ok: true };
    }

    if (input.type === "key") {
      const key = `${input.key || ""}`;
      const allowedPressKeys = new Set([
        "Backspace",
        "Delete",
        "Enter",
        "Escape",
        "Tab",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown"
      ]);

      if (allowedPressKeys.has(key)) {
        await this.page.keyboard.press(key);
        return { ok: true };
      }

      if (key.length === 1) {
        await this.page.keyboard.type(key);
        return { ok: true };
      }
    }

    if (input.type === "swipe") {
      const direction = input.direction === "down" ? "down" : "up";
      await this.performEmbeddedSwipe(direction);
      return { ok: true };
    }

    return { ok: false };
  }

  async performEmbeddedSwipe(direction = "up") {
    const viewport = this.page.viewportSize() || this.config.viewport || DEFAULT_VIEWPORT;
    const beforeUrl = this.page.url();
    const x = Math.round(viewport.width / 2);
    const distance = Math.round(viewport.height * 0.62);
    const centerY = Math.round(viewport.height / 2);
    const startY = direction === "up"
      ? Math.min(viewport.height - 32, centerY + Math.round(distance / 2))
      : Math.max(32, centerY - Math.round(distance / 2));
    const endY = direction === "up"
      ? Math.max(32, startY - distance)
      : Math.min(viewport.height - 32, startY + distance);

    await this.dispatchTouchSwipe({ x, startY, endY });
    await sleep(180);
    this.currentUrl = this.page.url();

    if (this.currentUrl !== beforeUrl) {
      return;
    }

    const fallbackKey = direction === "up" ? "ArrowDown" : "ArrowUp";
    await this.page.keyboard.press(fallbackKey).catch(() => {});
    await sleep(100);
    this.currentUrl = this.page.url();
  }

  async dispatchTouchSwipe({ x, startY, endY }) {
    if (!this.context?.newCDPSession) {
      await this.page.mouse.move(x, startY);
      await this.page.mouse.down();
      await this.page.mouse.move(x, endY, { steps: 12 });
      await this.page.mouse.up();
      return;
    }

    const session = await this.context.newCDPSession(this.page);
    const touchPoint = (y) => [{ x, y, radiusX: 4, radiusY: 4, force: 0.7 }];

    try {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: touchPoint(startY)
      });

      for (let step = 1; step <= 12; step += 1) {
        const y = Math.round(startY + ((endY - startY) * step / 12));
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: touchPoint(y)
        });
        await sleep(10);
      }

      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: []
      });
    } finally {
      await session.detach().catch(() => {});
    }
  }

  async configurePage() {
    if (!this.page || !this.config.embedded) {
      return;
    }

    const currentViewport = this.page.viewportSize();
    if (
      !currentViewport ||
      currentViewport.width !== this.config.viewport.width ||
      currentViewport.height !== this.config.viewport.height
    ) {
      await this.page.setViewportSize(this.config.viewport);
      this.updateStatus(this.status, `viewport mobile aplicado: ${this.config.viewport.width}x${this.config.viewport.height}`);
    }

    await this.page.setExtraHTTPHeaders({
      "User-Agent": MOBILE_USER_AGENT,
      "Sec-CH-UA-Mobile": "?1"
    }).catch(() => null);
  }

  async getSessionState() {
    this.ensurePage();
    await this.dismissKnownModals();
    this.currentUrl = this.page.url();

    if (await this.hasManualInterventionSignal()) {
      this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "tela de seguranca detectada");
      return "manual_intervention";
    }

    if (/\/accounts\/login/i.test(this.currentUrl)) {
      return "login_required";
    }

    const loginFields = await this.page.locator("input[name='username'], input[name='password']").count();
    if (loginFields > 0) {
      return "login_required";
    }

    const authenticatedSignals = [
      this.page.getByRole("link", { name: /^Home$|^Pagina inicial$/i }),
      this.page.getByRole("link", { name: /perfil|profile/i }),
      this.page.getByRole("link", { name: /direct|messages|mensagens/i })
    ];

    for (const locator of authenticatedSignals) {
      if (await locator.first().isVisible().catch(() => false)) {
        return "authenticated";
      }
    }

    if (/instagram\.com\/(?!accounts\/login)/i.test(this.currentUrl)) {
      const body = await this.safeBodyText();
      if (!/log in|entrar|sign up|cadastre-se/i.test(body)) {
        return "authenticated";
      }
    }

    return "login_required";
  }

  assertAllowedUsername(username) {
    const safeUsername = normalizeUsername(username);
    if (!safeUsername) {
      throw new Error("INSTAGRAM_USERNAME_INVALID");
    }

    if (!this.config.allowedProfiles.includes(safeUsername)) {
      throw new Error(`INSTAGRAM_PROFILE_NOT_ALLOWED:${safeUsername}`);
    }

    return safeUsername;
  }

  async waitForProfile(username) {
    await this.page.waitForURL(new RegExp(`instagram\\.com/${username}/?`, "i"), { timeout: 20000 });
    await Promise.race([
      this.page.getByRole("main").waitFor({ state: "visible", timeout: 20000 }),
      this.page.locator("header").first().waitFor({ state: "visible", timeout: 20000 })
    ]);

    if (await this.hasManualInterventionSignal()) {
      this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "tela desconhecida ou de seguranca no perfil");
      throw new Error("INSTAGRAM_MANUAL_INTERVENTION");
    }
  }

  async openLatestProfileMedia(username) {
    this.ensurePage();
    const profileUrlPattern = new RegExp(`instagram\\.com/${escapeRegExp(username)}/?`, "i");
    if (!profileUrlPattern.test(this.page.url())) {
      await this.page.goto(`https://www.instagram.com/${username}/`, { waitUntil: "domcontentloaded" });
      await this.waitForProfile(username);
    }

    this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, "botao ausente no perfil; abrindo ultima midia");
    await this.dismissKnownModals();

    const mediaLink = this.page
      .locator("main a[href*='/p/'], main a[href*='/reel/'], main a[href*='/tv/']")
      .first();

    if (!await waitForVisible(mediaLink, 3500)) {
      await this.page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.75))).catch(() => {});
      await this.page.waitForTimeout(400);
    }

    if (!await waitForVisible(mediaLink, 3500)) {
      this.updateStatus(INSTAGRAM_STATUS.READY, "nenhuma midia recente visivel no perfil");
      return false;
    }

    await this.theatricalDelay();
    await robustLocatorClick(mediaLink);
    const openedSurface = await Promise.race([
      this.page.waitForURL(/instagram\.com\/(p|reel|tv)\//i, { timeout: 8000 }).then(() => "url").catch(() => null),
      waitForVisible(this.page.getByRole("dialog").first(), 8000).then((visible) => visible ? "dialog" : null)
    ]);
    const mediaArticleOpened = openedSurface === "url" && await waitForVisible(this.page.locator("article").first(), 5000);
    this.currentUrl = this.page.url();
    await this.dismissKnownModals();
    return Boolean(openedSurface || mediaArticleOpened || /instagram\.com\/(p|reel|tv)\//i.test(this.currentUrl));
  }

  async getFollowButtonState() {
    const candidates = [
      ...BUTTON_STATE_LABELS.follow.map((label) => ({ label, state: "follow" })),
      ...BUTTON_STATE_LABELS.following.map((label) => ({ label, state: "following" })),
      ...BUTTON_STATE_LABELS.requested.map((label) => ({ label, state: "requested" })),
      ...BUTTON_STATE_LABELS.message.map((label) => ({ label, state: "following" })),
      ...BUTTON_STATE_LABELS.editProfile.map((label) => ({ label, state: "following" }))
    ];
    const targetProfileContexts = this.targetProfile ? [
      this.page.getByRole("dialog").first().filter({
        has: this.page.locator(`a[href*='/${this.targetProfile}/']`)
      }),
      this.page.locator("article").first().filter({
        has: this.page.locator(`a[href*='/${this.targetProfile}/']`)
      }),
      this.page.locator("main").first().filter({
        has: this.page.locator(`a[href*='/${this.targetProfile}/']`)
      })
    ] : [];
    const scopedContexts = [
      ...targetProfileContexts,
      this.page.locator("main header").first(),
      this.page.locator("article header").first(),
      this.page.getByRole("dialog").first().locator("header").first(),
      this.page.getByRole("dialog").first(),
      this.page.locator("article").first()
    ];

    for (const candidate of candidates) {
      const name = new RegExp(`^${escapeRegExp(candidate.label)}$`, "i");
      const locators = [
        ...scopedContexts.flatMap((context) => [
          context.getByRole("button", { name }).first(),
          context.getByText(name).first()
        ]),
        this.page.getByRole("button", { name }).first(),
        this.page.getByText(name).first()
      ];

      for (const locator of locators) {
        if (await locator.isVisible().catch(() => false)) {
          return { state: candidate.state, label: candidate.label, locator };
        }
      }
    }

    const buttons = [];
    for (const context of scopedContexts) {
      buttons.push(...await context.getByRole("button").allTextContents().catch(() => []));
    }
    const fallbackText = [...new Set(buttons.map((text) => text.trim()).filter(Boolean))].join(" | ");
    this.updateStatus(INSTAGRAM_STATUS.READY, `botoes encontrados: ${fallbackText || "nenhum"}`);
    return { state: null, label: fallbackText, locator: null };
  }

  async waitForFollowStateChange() {
    const deadline = Date.now() + 15000;

    while (Date.now() < deadline) {
      await this.dismissKnownModals();
      const state = await this.getFollowButtonState();

      if (FOLLOWING_STATES.has(state.state) || REQUESTED_STATES.has(state.state)) {
        return state;
      }

      await this.page.waitForTimeout(400);
    }

    return this.getFollowButtonState();
  }

  async dismissKnownModals() {
    this.ensurePage();

    for (const pattern of SAFE_MODAL_BUTTON_PATTERNS) {
      const button = this.page.getByRole("button", {
        name: pattern
      }).first();

      if (await button.isVisible().catch(() => false)) {
        this.updateStatus(this.status, `modal conhecido fechado: ${pattern.source}`);
        await this.theatricalDelay();
        await button.click().catch(() => {});
        await this.page.waitForTimeout(250);
      }
    }
  }

  async hasManualInterventionSignal() {
    const url = this.page.url();
    if (MANUAL_INTERVENTION_PATTERNS.some((pattern) => pattern.test(url))) {
      return true;
    }

    const body = stripAccents(await this.safeBodyText());
    return MANUAL_INTERVENTION_PATTERNS.some((pattern) => pattern.test(body));
  }

  async safeBodyText() {
    return this.page.locator("body").innerText({ timeout: 2500 }).catch(() => "");
  }

  async theatricalDelay() {
    await this.page?.waitForTimeout(this.config.theatricalDelayMs);
  }

  async saveDebugArtifact(prefix) {
    if (!this.config.debug || !this.page) {
      return null;
    }

    await fs.mkdir(this.config.debugDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = path.join(this.config.debugDir, `${stamp}-${prefix}`);
    await this.page.screenshot({ path: `${base}.png`, fullPage: true }).catch(() => null);

    const info = {
      timestamp: nowIso(),
      url: this.page.url(),
      title: await this.page.title().catch(() => ""),
      visibleButtons: await this.page.getByRole("button").allTextContents().catch(() => []),
      status: this.status,
      lastButtonState: this.lastButtonState,
      lastAction: this.lastAction
    };

    await fs.writeFile(`${base}.json`, JSON.stringify(info, null, 2), "utf8").catch(() => null);
    return base;
  }

  ensurePage() {
    if (!this.page) {
      throw new Error("INSTAGRAM_BROWSER_NOT_READY");
    }
  }

  updateStatus(status, message) {
    this.status = status;
    this.currentUrl = this.page?.url?.() || this.currentUrl;
    const payload = {
      ...this.getStatus(),
      status,
      message,
      updatedAt: nowIso()
    };

    console.log(`INSTAGRAM > ${message}`);
    this.reporter?.(payload);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAccents(value) {
  return `${value}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const globalKey = "__caixaPretaInstagramController";
const shutdownKey = "__caixaPretaInstagramControllerShutdown";

function discardStaleController() {
  if (!globalThis[globalKey] || globalThis[globalKey]?.controllerVersion === CONTROLLER_VERSION) {
    return;
  }

  globalThis[globalKey]?.close?.().catch(() => null);
  globalThis[globalKey] = null;
}

export function getInstagramController({ reporter = null } = {}) {
  discardStaleController();

  if (!globalThis[globalKey]) {
    globalThis[globalKey] = new InstagramController({ reporter });
  } else if (reporter) {
    globalThis[globalKey].setReporter(reporter);
  }

  registerShutdown();

  return globalThis[globalKey];
}

export function getExistingInstagramController() {
  discardStaleController();
  return globalThis[globalKey] || null;
}

function registerShutdown() {
  if (globalThis[shutdownKey]) {
    return;
  }

  globalThis[shutdownKey] = true;
  const close = async () => {
    await globalThis[globalKey]?.close?.().catch(() => null);
  };

  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  process.once("beforeExit", close);
}
