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
const INSTAGRAM_LOGIN = "https://www.instagram.com/accounts/login/";
const DEFAULT_VIEWPORT = { width: 430, height: 760 };
const GOOGLE_VIEWPORT = { width: 1100, height: 760 };
const CONTROLLER_VERSION = 16;
const DEFAULT_CREDENTIALS_PATH = path.join(process.cwd(), "config", "instagram-credentials.local.json");
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
  const allowedProfiles = `${env.INSTAGRAM_ALLOWED_PROFILES || ""}`
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
    streamFps: parseInteger(env.INSTAGRAM_STREAM_FPS, 24, 4, 30),
    streamQuality: parseInteger(env.INSTAGRAM_STREAM_QUALITY, 56, 35, 90),
    allowedProfiles,
    credentialsPath: env.INSTAGRAM_CREDENTIALS_FILE
      ? path.resolve(process.cwd(), env.INSTAGRAM_CREDENTIALS_FILE)
      : DEFAULT_CREDENTIALS_PATH,
    profileDir: path.join(process.cwd(), ".runtime", "instagram-profile"),
    debugDir: path.join(process.cwd(), ".runtime", "instagram-debug")
  };
}

export async function loadInstagramCredentials(credentialsPath = DEFAULT_CREDENTIALS_PATH) {
  let raw;

  try {
    raw = await fs.readFile(credentialsPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    throw new Error("INSTAGRAM_CREDENTIALS_READ_FAILED");
  }

  return parseInstagramCredentials(raw);
}

export function parseInstagramCredentials(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("INSTAGRAM_CREDENTIALS_INVALID_JSON");
  }

  const username = normalizeUsername(parsed?.username);
  const password = typeof parsed?.password === "string" ? parsed.password : "";
  if (!username || !password || password === "COLOQUE_A_SENHA_AQUI") {
    return null;
  }

  return { username, password };
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

function normalizeCommentText(comment) {
  return `${comment || ""}`.trim().replace(/\s+/g, " ").slice(0, 220);
}

function normalizeDirectMessageText(message) {
  return `${message || ""}`.trim().replace(/\s+/g, " ").slice(0, 1000);
}

export function normalizeResearchPersonName(name = "") {
  return `${name || ""}`
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

export function normalizeGoogleGuidance(guidance = "") {
  return `${guidance || ""}`
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 600);
}

export function parseGoogleGuidance(guidance = "") {
  const normalized = normalizeGoogleGuidance(guidance);
  const durationMatch = normalized.match(/\b(?:por|durante)\s+(\d{1,3})\s*(?:s|seg(?:undo)?s?)\b/iu);
  const durationSeconds = durationMatch
    ? Math.min(120, Math.max(1, Number(durationMatch[1])))
    : 0;
  const searchMatch = normalized.match(/\b(?:buscar|pesquisar|procurar)(?:\s+(?:no\s+google|na\s+internet|por|sobre))?\s+(.+?)(?=\s+e\s+(?:escolher|abrir|acessar|entrar|ler|visitar|clicar)\b|$)/iu);
  const query = `${searchMatch?.[1] || normalized}`
    .replace(/[.,;:]\s*$/u, "")
    .trim()
    .slice(0, 300);
  const openResult = /\b(?:escolher|abrir|acessar|entrar|ler|visitar|clicar)\b/iu.test(normalized);
  const preferNews = /\b(?:not[ií]cia|notici[aá]rio|jornal|reportagem|mat[eé]ria)\b/iu.test(normalized);
  const wantsComment = /\b(?:comentar|coment[aá]rio|sarcasmo|sarc[aá]stic[oa])\b/iu.test(normalized);
  const requestedResultCount = /\b(?:mais\s+uma|outra|duas|dois|2)\s+(?:not[ií]cia|mat[eé]ria|reportagem|resultado)/iu.test(normalized)
    ? 2
    : /\b(?:apenas|s[oó])\s+uma\s+(?:not[ií]cia|mat[eé]ria|reportagem|resultado)/iu.test(normalized) ? 1 : null;
  const resultCount = openResult ? (requestedResultCount || (preferNews ? 2 : 1)) : 0;
  const subject = query
    .replace(/^(?:not[ií]cias?|reportagens?|mat[eé]rias?)\s+(?:sobre|de)\s+/iu, "")
    .replace(/^(?:sobre|de)\s+/iu, "")
    .trim();
  const subjectWords = subject.split(/\s+/).filter(Boolean);
  const genericSubject = /\b(?:elei[cç][aã]o|elei[cç][oõ]es|candidato|governo|pol[ií]tica|partido|not[ií]cia)\b/iu.test(subject);
  const wantsInstagram = /\binstagram\b/iu.test(normalized) || (
    preferNews && subjectWords.length >= 2 && subjectWords.length <= 4 && !genericSubject
  );

  return {
    guidance: normalized,
    query,
    durationSeconds,
    openResult,
    preferNews,
    wantsComment,
    resultCount,
    subject,
    wantsInstagram
  };
}

export function normalizePublicResearchUrl(rawUrl = "") {
  try {
    const candidate = new URL(`${rawUrl || ""}`, "https://www.google.com/");
    const isGoogleRedirect = /(^|\.)google\./i.test(candidate.hostname) && candidate.pathname === "/url";
    const redirected = isGoogleRedirect
      ? candidate.searchParams.get("q") || candidate.searchParams.get("url")
      : candidate.href;
    const url = new URL(redirected);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const blockedHost = /(^|\.)(localhost|0\.0\.0\.0|169\.254\.169\.254)$/.test(hostname) ||
      /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname) ||
      /(^|\.)(jusbrasil\.com\.br|escavador\.com|tudosobretodos\.com|consultasocio\.com|econodata\.com\.br)$/.test(hostname);
    const blockedPath = /\/(login|signin|signup|accounts\/login)(?:\/|$)/i.test(url.pathname);
    if (url.protocol !== "https:" || blockedHost || blockedPath) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function selectPersonResearchLinks(rawLinks = []) {
  const links = [...new Set(rawLinks.map(normalizePublicResearchUrl).filter(Boolean))];
  const instagram = links.find((link) => {
    const url = new URL(link);
    if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return false;
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length === 1 && !["accounts", "explore", "reels", "direct", "about"].includes(parts[0].toLowerCase());
  }) || null;
  const interesting = links.find((link) => {
    const hostname = new URL(link).hostname.replace(/^www\./, "");
    return !/(^|\.)(google\.|bing\.com|microsoft\.com|instagram\.com|facebook\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com)/i.test(hostname);
  }) || null;
  return { interesting, instagram };
}

export function selectGuidedGoogleResult(rawResults = [], { preferNews = false } = {}) {
  return selectGuidedGoogleResults(rawResults, { preferNews, limit: 1 })[0] || null;
}

export function selectGuidedGoogleResults(rawResults = [], { preferNews = false, limit = 2 } = {}) {
  const candidates = rawResults
    .map((result) => ({
      url: normalizePublicResearchUrl(result?.url || result?.href || result),
      text: `${result?.text || ""}`.trim().replace(/\s+/g, " ").slice(0, 300)
    }))
    .filter(({ url }) => {
      if (!url) return false;
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, "");
      const archivePath = /\/(?:tudo-sobre|tags?|topics?|autores?|busca|search)(?:\/|$)/i.test(parsed.pathname);
      return !archivePath && !/(^|\.)(google\.|bing\.com|microsoft\.com|msn\.com|instagram\.com|facebook\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com)/i.test(hostname);
    });

  const unique = [...new Map(candidates.map((candidate) => [candidate.url, candidate])).values()];
  if (!preferNews) return unique.slice(0, limit);
  return unique
    .map((candidate, index) => ({
      ...candidate,
      score: (/\b(not[ií]cia|jornal|reportagem|pol[ií]tica|elei[cç][aã]o|candidato)\b/iu.test(`${candidate.text} ${candidate.url}`) ? 10 : 0) - index
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...candidate }) => candidate);
}

export class InstagramController {
  constructor({ config = getInstagramConfig(), reporter = null, credentialsLoader = loadInstagramCredentials } = {}) {
    this.config = config;
    this.reporter = reporter;
    this.credentialsLoader = credentialsLoader;
    this.context = null;
    this.page = null;
    this.status = INSTAGRAM_STATUS.DISCONNECTED;
    this.lastError = null;
    this.lastButtonState = null;
    this.currentUrl = null;
    this.lastAction = null;
    this.targetProfile = null;
    this.controllerVersion = CONTROLLER_VERSION;
    this.actionInProgress = false;
    this.commandInProgress = false;
    this.reelsAutoplayTimer = null;
    this.reelsAutoplayGeneration = 0;
    this.reelsAutoplayActive = false;
    this.audioMuted = true;
    this.browserMode = "instagram";
    this.research = null;
    this.googleGuidanceGeneration = 0;
    this.secondaryPage = null;
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
      viewport: this.page?.viewportSize?.() || this.config.viewport,
      streamFps: this.config.streamFps,
      streamQuality: this.config.streamQuality,
      reelsAutoplayActive: this.reelsAutoplayActive,
      audioMuted: this.audioMuted,
      browserMode: this.browserMode,
      research: this.research ? { ...this.research } : null,
      secondaryBrowser: this.secondaryPage ? {
        active: true,
        label: "INSTAGRAM",
        currentUrl: this.secondaryPage.url?.() || null
      } : null,
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
      this.stopReelsAutoplay({ silent: true });
      this.context = null;
      this.page = null;
      this.secondaryPage = null;
      this.updateStatus(INSTAGRAM_STATUS.DISCONNECTED, "navegador fechado");
    });

    this.page = this.context.pages()[0] || await this.context.newPage();
    await this.configurePage();
    this.page.setDefaultTimeout(15000);
    this.updateStatus(INSTAGRAM_STATUS.STARTING, `perfil persistente: ${this.config.profileDir}`);
    return this.getStatus();
  }

  async open() {
    if (this.browserMode === "google_guidance") {
      this.googleGuidanceGeneration += 1;
      this.commandInProgress = false;
    }
    await this.closeSecondaryPage();
    await this.init();
    this.ensurePage();
    await this.configurePage();
    this.lastAction = "open";
    this.browserMode = "instagram";
    this.research = null;
    this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, "abrindo instagram.com");
    await this.page.goto(INSTAGRAM_HOME, { waitUntil: "domcontentloaded" });
    this.currentUrl = this.page.url();
    await this.dismissKnownModals();

    const session = await this.getSessionState();
    if (session === "manual_intervention") {
      return { status: "manual_intervention", message: "INSTAGRAM: intervencao manual necessaria" };
    }

    if (session !== "authenticated") {
      const login = await this.attemptAutomaticLogin();
      if (login.status !== "ready") {
        return login;
      }
    }

    this.updateStatus(INSTAGRAM_STATUS.READY, "sessao encontrada");
    return { status: "ready", message: "INSTAGRAM: sessao encontrada" };
  }

  async collectCurrentPageLinks() {
    this.ensurePage();
    const links = await this.page.locator("a[href]").evaluateAll((anchors) => (
      anchors.map((anchor) => anchor.href || anchor.getAttribute("href") || "").filter(Boolean).slice(0, 300)
    )).catch(() => []);
    return selectPersonResearchLinks(links);
  }

  async collectCurrentSearchResults() {
    this.ensurePage();
    return this.page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => ({
      url: anchor.href || anchor.getAttribute("href") || "",
      text: `${anchor.innerText || anchor.textContent || ""}`.trim()
    })).filter((result) => result.url).slice(0, 300)).catch(() => []);
  }

  async searchPublicWeb(query, { preferGoogle = true, news = false } = {}) {
    if (preferGoogle) {
      const googleNews = news ? "&tbm=nws" : "";
      await this.page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt-BR${googleNews}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000
      });
      await this.page.waitForTimeout(1200);
      const googleBlocked = /\/sorry\//i.test(this.page.url()) || /captcha|tr[aá]fego incomum|unusual traffic/i.test(await this.safeBodyText());
      if (!googleBlocked) return "google";
      this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, "GOOGLE PEDIU VERIFICAÇÃO; CONTINUANDO A PESQUISA");
      await this.page.waitForTimeout(700);
    }

    const bingPath = news ? "/news/search" : "/search";
    await this.page.goto(`https://www.bing.com${bingPath}?q=${encodeURIComponent(query)}&setlang=pt-br`, {
      waitUntil: "domcontentloaded",
      timeout: 20000
    });
    await this.page.waitForTimeout(1200);
    return "bing";
  }

  async researchPerson(name = "", { knownInstagramHandle = "" } = {}) {
    const person = normalizeResearchPersonName(name);
    const knownHandle = normalizeUsername(knownInstagramHandle);
    if (!person) {
      return { status: "invalid", message: "PESQUISA: nome da pessoa ausente" };
    }
    if (this.commandInProgress) {
      return { status: "busy", message: "PESQUISA: navegador ocupado" };
    }

    this.commandInProgress = true;
    this.stopReelsAutoplay({ silent: true });
    this.browserMode = "person_research";
    this.targetProfile = null;
    this.research = {
      person,
      step: "starting",
      query: `\"${person}\" São Paulo Instagram`,
      searchProvider: "google",
      interestingUrl: null,
      instagramUrl: knownHandle ? `https://www.instagram.com/${knownHandle}/` : null,
      startedAt: nowIso()
    };

    try {
      await this.init();
      this.ensurePage();
      await this.configurePage();
      this.lastAction = "research_person_google";
      this.research.step = "google";
      this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, `PESQUISANDO NO GOOGLE: ${person}`);
      this.research.searchProvider = await this.searchPublicWeb(this.research.query, { preferGoogle: true });
      await this.page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.55))).catch(() => {});
      await this.page.waitForTimeout(900);

      let links = await this.collectCurrentPageLinks();
      if (knownHandle) links.instagram = `https://www.instagram.com/${knownHandle}/`;
      this.research = {
        ...this.research,
        interestingUrl: links.interesting,
        instagramUrl: links.instagram
      };

      if (links.interesting) {
        this.lastAction = "research_person_interesting_page";
        this.research.step = "interesting_page";
        this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, `ABRINDO RESULTADO PÚBLICO: ${person}`);
        await this.page.goto(links.interesting, { waitUntil: "domcontentloaded", timeout: 18000 }).catch(() => null);
        await this.page.waitForTimeout(1800);
        await this.page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.65))).catch(() => {});
        await this.page.waitForTimeout(1600);
      }

      if (!links.instagram) {
        this.lastAction = "research_person_instagram_search";
        this.research.step = "instagram_search";
        this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, `PROCURANDO INSTAGRAM: ${person}`);
        const instagramSearch = `site:instagram.com \"${person}\"`;
        this.research.searchProvider = await this.searchPublicWeb(instagramSearch, {
          preferGoogle: this.research.searchProvider === "google"
        });
        await this.page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.45))).catch(() => {});
        const instagramLinks = await this.collectCurrentPageLinks();
        links = {
          interesting: links.interesting || instagramLinks.interesting,
          instagram: instagramLinks.instagram
        };
        this.research.instagramUrl = links.instagram;
      }

      if (links.instagram) {
        this.lastAction = "research_person_instagram";
        this.research.step = "instagram";
        this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, `OLHANDO INSTAGRAM ENCONTRADO: ${person}`);
        await this.page.goto(links.instagram, { waitUntil: "domcontentloaded", timeout: 20000 });
        await this.page.waitForTimeout(1800);
        await this.dismissKnownModals().catch(() => {});
        await this.page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.55))).catch(() => {});
        await this.page.waitForTimeout(1200);
      }

      this.currentUrl = this.page.url();
      this.research.step = links.instagram ? "instagram_ready" : "manual_exploration";
      this.updateStatus(
        INSTAGRAM_STATUS.READY,
        links.instagram ? `INSTAGRAM PÚBLICO ENCONTRADO: ${person}` : `PESQUISA ABERTA PARA EXPLORAÇÃO: ${person}`
      );
      return {
        status: "ready",
        message: links.instagram ? "PESQUISA: Instagram público encontrado" : "PESQUISA: resultados abertos",
        person,
        links
      };
    } catch (error) {
      const message = publicError(error);
      this.lastError = message;
      if (this.research) this.research.step = "error";
      this.updateStatus(INSTAGRAM_STATUS.ERROR, `PESQUISA NÃO CONCLUÍDA: ${message}`);
      return { status: "error", message: "PESQUISA: navegação não concluída", person };
    } finally {
      this.commandInProgress = false;
    }
  }

  startGoogleGuidance(guidance = "", { onComplete = null } = {}) {
    const plan = parseGoogleGuidance(guidance);
    if (!plan.guidance || !plan.query) {
      return { status: "invalid", message: "GOOGLE: escreva uma orientação" };
    }
    if (this.commandInProgress) {
      return { status: "busy", message: "GOOGLE: navegador ocupado" };
    }

    const generation = ++this.googleGuidanceGeneration;
    void this.followGoogleGuidance(plan, generation).then(async (result) => {
      if (result.status === "ready" && typeof onComplete === "function") {
        await onComplete(result);
      }
    }).catch((error) => {
      this.lastError = publicError(error);
      this.updateStatus(INSTAGRAM_STATUS.ERROR, "GOOGLE: comentário não concluído");
    });
    return { status: "started", message: "GOOGLE: orientação iniciada", plan };
  }

  async followGoogleGuidance(planInput, generation = ++this.googleGuidanceGeneration) {
    const plan = typeof planInput === "string" ? parseGoogleGuidance(planInput) : planInput;
    if (!plan?.guidance || !plan.query) {
      return { status: "invalid", message: "GOOGLE: escreva uma orientação" };
    }

    this.commandInProgress = true;
    this.stopReelsAutoplay({ silent: true });
    this.browserMode = "google_guidance";
    this.targetProfile = null;
    this.research = {
      guidance: plan.guidance,
      query: plan.query,
      durationSeconds: plan.durationSeconds,
      resultCount: plan.resultCount,
      step: "starting",
      searchProvider: "google",
      selectedUrl: null,
      articles: [],
      instagramUrl: null,
      startedAt: nowIso()
    };

    try {
      await this.init();
      await this.closeSecondaryPage();
      if (generation !== this.googleGuidanceGeneration) return { status: "stopped", message: "GOOGLE: orientação interrompida" };
      this.ensurePage();
      await this.configurePage();
      this.lastAction = "google_guidance_search";
      this.research.step = "searching";
      this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, `GOOGLE: BUSCANDO ${plan.query}`);
      this.research.searchProvider = await this.searchPublicWeb(plan.query, { preferGoogle: true, news: plan.preferNews });

      const articles = [];
      let searchUrl = this.page.url();
      let selectedResults = [];
      if (plan.openResult) {
        selectedResults = selectGuidedGoogleResults(await this.collectCurrentSearchResults(), {
          ...plan,
          limit: Math.max(4, (plan.resultCount || 1) * 3)
        });
        if (selectedResults.length < (plan.resultCount || 1) && plan.subject && plan.subject !== plan.query) {
          this.research.step = "refining_search";
          this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, `GOOGLE: REFINANDO BUSCA PARA ${plan.subject}`);
          this.research.searchProvider = await this.searchPublicWeb(plan.subject, { preferGoogle: false, news: plan.preferNews });
          searchUrl = this.page.url();
          selectedResults = selectGuidedGoogleResults(await this.collectCurrentSearchResults(), {
            ...plan,
            limit: Math.max(4, (plan.resultCount || 1) * 3)
          });
        }
      }
      const instagramPromise = plan.wantsInstagram
        ? this.openPublicInstagramAlongside(plan.subject).catch(() => null)
        : Promise.resolve(null);
      if (plan.openResult && generation === this.googleGuidanceGeneration) {
        for (let index = 0; index < selectedResults.length && articles.length < (plan.resultCount || 1); index += 1) {
          const selected = selectedResults[index];
          if (index > 0) {
            this.research.step = "returning_to_results";
            this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, "GOOGLE: VOLTANDO AOS RESULTADOS PARA PROCURAR MAIS UMA");
            await this.page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
            await this.page.waitForTimeout(700);
          }
          this.lastAction = "google_guidance_open_result";
          this.research = { ...this.research, step: "opening_result", selectedUrl: selected.url, articles: [...articles] };
          this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, `GOOGLE: ABRINDO NOTÍCIA ${articles.length + 1} DE ${plan.resultCount || 1}`);
          const opened = await this.page.goto(selected.url, { waitUntil: "domcontentloaded", timeout: 20000 })
            .then(() => true)
            .catch(() => false);
          if (!opened) {
            this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, "GOOGLE: FONTE NÃO ABRIU; PROCURANDO OUTRA");
            continue;
          }
          await this.page.waitForTimeout(900);
          if (generation !== this.googleGuidanceGeneration) break;
          const readDurationSeconds = plan.durationSeconds || 6;
          this.lastAction = "google_guidance_read";
          this.research.step = "reading";
          this.updateStatus(INSTAGRAM_STATUS.ACTING, `GOOGLE: LENDO NOTÍCIA ${articles.length + 1} POR ${readDurationSeconds} SEGUNDOS`);
          for (let elapsed = 0; elapsed < readDurationSeconds && generation === this.googleGuidanceGeneration; elapsed += 3) {
            await this.page.waitForTimeout(Math.min(3000, (readDurationSeconds - elapsed) * 1000));
            await this.page.evaluate(() => window.scrollBy({ top: Math.round(window.innerHeight * 0.62), behavior: "smooth" })).catch(() => {});
          }
          const article = await this.extractCurrentPageDigest();
          if (`${article.text || ""}`.trim().length < 120) {
            this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, "GOOGLE: FONTE SEM TEXTO LEGÍVEL; PROCURANDO OUTRA");
            continue;
          }
          articles.push({ ...article, resultText: selected.text });
          this.research = { ...this.research, articles: [...articles] };
        }
      }

      const instagramUrl = await instagramPromise;
      this.research = { ...this.research, instagramUrl };

      if (generation !== this.googleGuidanceGeneration) return { status: "stopped", message: "GOOGLE: orientação interrompida" };
      this.currentUrl = this.page.url();
      this.research.step = articles.length ? "research_ready" : "results_ready";
      this.updateStatus(INSTAGRAM_STATUS.READY, articles.length ? `GOOGLE: ${articles.length} NOTÍCIA(S) LIDA(S)` : "GOOGLE: RESULTADOS ABERTOS");
      return {
        status: "ready",
        message: "GOOGLE: orientação concluída",
        plan,
        url: this.currentUrl,
        articles,
        instagramUrl: this.research.instagramUrl
      };
    } catch (error) {
      const message = publicError(error);
      this.lastError = message;
      if (this.research) this.research.step = "error";
      this.updateStatus(INSTAGRAM_STATUS.ERROR, `GOOGLE: NAVEGAÇÃO NÃO CONCLUÍDA — ${message}`);
      return { status: "error", message: "GOOGLE: navegação não concluída" };
    } finally {
      if (generation === this.googleGuidanceGeneration) this.commandInProgress = false;
    }
  }

  async stopGoogleGuidance() {
    if (this.browserMode !== "google_guidance") return { status: "idle", message: "GOOGLE: nenhuma orientação ativa" };
    this.googleGuidanceGeneration += 1;
    await this.stopAllRoutines();
    await this.closeSecondaryPage();
    this.browserMode = "instagram";
    this.research = null;
    this.targetProfile = null;
    this.updateStatus(INSTAGRAM_STATUS.DISCONNECTED, "GOOGLE ENCERRADO");
    return { status: "stopped", message: "GOOGLE: encerrado" };
  }

  async extractCurrentPageDigest() {
    this.ensurePage();
    return this.page.evaluate(() => {
      const root = document.querySelector("article, main") || document.body;
      const title = document.querySelector("h1")?.innerText?.trim() || document.title || "";
      const text = [...root.querySelectorAll("h1, h2, p")]
        .map((element) => `${element.innerText || element.textContent || ""}`.trim())
        .filter((value) => value.length >= 30)
        .join("\n")
        .replace(/\s+/g, " ")
        .slice(0, 7000);
      return { title: title.slice(0, 300), text, url: window.location.href };
    }).catch(() => ({
      title: "",
      text: "",
      url: this.page.url()
    }));
  }

  async openPublicInstagramAlongside(subject = "") {
    const person = normalizeResearchPersonName(subject);
    if (!person || !this.context?.newPage) return null;
    await this.closeSecondaryPage();
    const page = await this.context.newPage();
    this.secondaryPage = page;
    await page.setViewportSize(this.config.viewport).catch(() => {});
    await page.setExtraHTTPHeaders({ "User-Agent": MOBILE_USER_AGENT, "Sec-CH-UA-Mobile": "?1" }).catch(() => {});
    this.research.step = "instagram_search";
    this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, `GOOGLE: ABRINDO INSTAGRAM DE ${person} EM OUTRA ABA`);
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com "${person}"`)}&hl=pt-BR`, {
      waitUntil: "domcontentloaded",
      timeout: 20000
    });
    await page.waitForTimeout(900);
    let rawLinks = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.href || "")).catch(() => []);
    let instagramUrl = selectPersonResearchLinks(rawLinks).instagram;
    if (!instagramUrl) {
      await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(`site:instagram.com "${person}"`)}&setlang=pt-br`, {
        waitUntil: "domcontentloaded",
        timeout: 20000
      });
      await page.waitForTimeout(900);
      rawLinks = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.href || "")).catch(() => []);
      instagramUrl = selectPersonResearchLinks(rawLinks).instagram;
    }
    if (instagramUrl) {
      await page.goto(instagramUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(900);
      await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.45))).catch(() => {});
    }
    return instagramUrl;
  }

  async closeSecondaryPage() {
    const page = this.secondaryPage;
    this.secondaryPage = null;
    if (page && !page.isClosed?.()) await page.close().catch(() => {});
  }

  async stopPersonResearch() {
    if (this.browserMode !== "person_research") return { status: "idle" };
    await this.stopAllRoutines();
    this.browserMode = "instagram";
    this.research = null;
    this.targetProfile = null;
    this.updateStatus(INSTAGRAM_STATUS.DISCONNECTED, "PESQUISA PÚBLICA ENCERRADA");
    return { status: "stopped", message: "PESQUISA: encerrada" };
  }

  async attemptAutomaticLogin() {
    let credentials;

    try {
      credentials = await this.credentialsLoader(this.config.credentialsPath);
    } catch (error) {
      const message = publicError(error);
      this.lastError = message;
      this.updateStatus(INSTAGRAM_STATUS.LOGIN_REQUIRED, "arquivo de credenciais invalido ou ilegivel");
      return { status: "login_required", message: "INSTAGRAM: credenciais locais invalidas" };
    }

    if (!credentials) {
      this.updateStatus(INSTAGRAM_STATUS.LOGIN_REQUIRED, "preencha config/instagram-credentials.local.json");
      return { status: "login_required", message: "INSTAGRAM: credenciais locais ausentes" };
    }

    this.lastAction = "automaticLogin";
    this.updateStatus(INSTAGRAM_STATUS.ACTING, "fazendo login automatico...");

    try {
      if (!/\/accounts\/login/i.test(this.page.url())) {
        await this.page.goto(INSTAGRAM_LOGIN, { waitUntil: "domcontentloaded" });
        this.currentUrl = this.page.url();
      }

      if (await this.hasManualInterventionSignal()) {
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "instagram pediu verificacao manual");
        return { status: "manual_intervention", message: "INSTAGRAM: intervencao manual necessaria" };
      }

      const usernameInput = this.page.locator("input[name='username']").first();
      const passwordInput = this.page.locator("input[name='password']").first();
      const fieldsReady = await Promise.all([
        waitForVisible(usernameInput, 10000),
        waitForVisible(passwordInput, 10000)
      ]);

      if (fieldsReady.some((ready) => !ready)) {
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "campos de login nao reconhecidos");
        return { status: "manual_intervention", message: "INSTAGRAM: intervencao manual necessaria" };
      }

      await usernameInput.fill(credentials.username);
      await passwordInput.fill(credentials.password);

      const namedSubmit = this.page.getByRole("button", { name: /^Log in$|^Entrar$/i }).first();
      const submit = await namedSubmit.isVisible().catch(() => false)
        ? namedSubmit
        : this.page.locator("button[type='submit']").first();
      await robustLocatorClick(submit);

      const result = await this.waitForLoginResult();
      if (result === "authenticated") {
        await this.dismissKnownModals();
        this.updateStatus(INSTAGRAM_STATUS.READY, "login automatico concluido; sessao persistida");
        return { status: "ready", message: "INSTAGRAM: login automatico concluido" };
      }

      if (result === "manual_intervention") {
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "instagram pediu verificacao manual");
        return { status: "manual_intervention", message: "INSTAGRAM: intervencao manual necessaria" };
      }

      this.updateStatus(INSTAGRAM_STATUS.LOGIN_REQUIRED, "login automatico nao confirmado; confira as credenciais");
      return { status: "login_required", message: "INSTAGRAM: login automatico nao confirmado" };
    } catch (error) {
      this.lastError = error?.name === "TimeoutError" ? "automatic_login_timeout" : "automatic_login_failed";
      this.updateStatus(INSTAGRAM_STATUS.LOGIN_REQUIRED, "login automatico falhou sem expor credenciais");
      return { status: "login_required", message: "INSTAGRAM: login automatico falhou" };
    } finally {
      credentials = null;
    }
  }

  async waitForLoginResult({ timeoutMs = 25000 } = {}) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const session = await this.getSessionState();
      if (session !== "login_required") {
        return session;
      }

      await this.page.waitForTimeout(500);
    }

    return "login_required";
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

  async openReels() {
    if (this.commandInProgress || this.actionInProgress) {
      return { status: "busy", message: "INSTAGRAM: acao em andamento" };
    }

    this.commandInProgress = true;
    this.lastAction = "watchReels";
    this.targetProfile = null;
    this.updateStatus(INSTAGRAM_STATUS.STARTING, "reels solicitados");

    try {
      const opened = await this.open();
      if (opened.status !== "ready") {
        return opened;
      }

      this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, "abrindo reels");
      await this.theatricalDelay();
      await this.page.goto("https://www.instagram.com/reels/", { waitUntil: "domcontentloaded" });
      this.currentUrl = this.page.url();
      await this.dismissKnownModals();
      await Promise.race([
        this.page.waitForURL(/instagram\.com\/reels?\/?/i, { timeout: 10000 }).catch(() => null),
        this.page.locator("main").first().waitFor({ state: "visible", timeout: 10000 }).catch(() => null)
      ]);
      await this.waitForEmbeddedFrameReady("reels carregado");
      const firstDelayMs = await this.getCurrentReelWatchDelayMs();
      this.startReelsAutoplay(firstDelayMs);
      this.updateStatus(INSTAGRAM_STATUS.READY, "reels aberto no iframe; autoplay ligado");
      return { status: "ready", message: "INSTAGRAM: reels aberto no iframe; autoplay ligado" };
    } finally {
      this.commandInProgress = false;
    }
  }

  startReelsAutoplay(firstDelayMs = 2000) {
    this.stopReelsAutoplay({ silent: true });
    this.reelsAutoplayActive = true;
    this.reelsAutoplayGeneration += 1;
    this.scheduleNextReelAutoplayStep(Math.min(10000, Math.max(2000, Math.round(firstDelayMs))), this.reelsAutoplayGeneration);
  }

  stopReelsAutoplay({ silent = false } = {}) {
    if (this.reelsAutoplayTimer) {
      clearTimeout(this.reelsAutoplayTimer);
      this.reelsAutoplayTimer = null;
    }

    if (this.reelsAutoplayActive && !silent) {
      this.updateStatus(this.status, "reels autoplay parado");
    }

    this.reelsAutoplayActive = false;
    this.reelsAutoplayGeneration += 1;
  }

  scheduleNextReelAutoplayStep(delayMs, generation) {
    if (!this.reelsAutoplayActive || generation !== this.reelsAutoplayGeneration) {
      return;
    }

    this.reelsAutoplayTimer = setTimeout(() => {
      this.advanceReelsAutoplay(generation).catch((error) => {
        this.lastError = publicError(error);
        this.stopReelsAutoplay();
      });
    }, delayMs);
    this.reelsAutoplayTimer.unref?.();
  }

  async advanceReelsAutoplay(generation) {
    if (!this.reelsAutoplayActive || generation !== this.reelsAutoplayGeneration) {
      return;
    }

    if (!this.page || !/instagram\.com\/(?:reels?|reel)\//i.test(this.page.url())) {
      this.stopReelsAutoplay();
      return;
    }

    if (this.commandInProgress || this.actionInProgress) {
      this.scheduleNextReelAutoplayStep(1200, generation);
      return;
    }

    await this.performEmbeddedSwipe("up");
    await this.applyAudioMuted().catch(() => {});
    const nextDelayMs = await this.getCurrentReelWatchDelayMs();
    this.updateStatus(INSTAGRAM_STATUS.READY, `assistindo reels; proximo em ${Math.round(nextDelayMs / 1000)}s`);
    this.scheduleNextReelAutoplayStep(nextDelayMs, generation);
  }

  async getCurrentReelWatchDelayMs() {
    const fallback = 2000 + Math.round(Math.random() * 8000);
    const videoState = await this.page?.evaluate(() => {
      const videos = [...document.querySelectorAll("video")];
      const visibleVideos = videos
        .map((video) => {
          const rect = video.getBoundingClientRect();
          const visible = rect.width > 20 && rect.height > 20 && rect.bottom > 0 && rect.top < window.innerHeight;
          return {
            visible,
            area: visible ? rect.width * rect.height : 0,
            duration: Number.isFinite(video.duration) ? video.duration : 0,
            currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0
          };
        })
        .filter((video) => video.visible)
        .sort((a, b) => b.area - a.area);

      return visibleVideos[0] || null;
    }).catch(() => null);

    if (!videoState?.duration) {
      return fallback;
    }

    const remainingMs = Math.max(0, (videoState.duration - videoState.currentTime) * 1000);
    return Math.min(10000, Math.max(2000, Math.round(remainingMs + 350)));
  }

  async sendDirectMessage({ message, thread = "" } = {}) {
    const safeMessage = normalizeDirectMessageText(message);
    const safeThread = `${thread || ""}`.trim().replace(/\s+/g, " ").slice(0, 160);
    if (!safeMessage) {
      throw new Error("INSTAGRAM_DIRECT_MESSAGE_EMPTY");
    }

    if (this.commandInProgress || this.actionInProgress) {
      return { status: "busy", message: "INSTAGRAM: acao em andamento" };
    }

    this.commandInProgress = true;
    this.lastAction = safeThread ? `direct ${safeThread}` : "direct latest";
    this.targetProfile = null;
    this.updateStatus(INSTAGRAM_STATUS.STARTING, safeThread ? `direct solicitado: ${safeThread}` : "direct solicitado: ultima mensagem");

    try {
      const opened = await this.openDirectInbox();
      if (opened.status !== "ready") {
        return opened;
      }

      const threadOpened = safeThread
        ? await this.openDirectThreadByText(safeThread)
        : await this.openLatestDirectThread();

      if (!threadOpened) {
        await this.saveDebugArtifact("direct-thread-unavailable");
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "conversa direct nao reconhecida");
        return { status: "unconfirmed", message: "INSTAGRAM: conversa direct nao reconhecida" };
      }

      const input = await this.findDirectMessageInput();
      if (!input) {
        await this.saveDebugArtifact("direct-input-unavailable");
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "campo de direct nao reconhecido");
        return { status: "unconfirmed", message: "INSTAGRAM: campo de direct nao reconhecido" };
      }

      this.updateStatus(INSTAGRAM_STATUS.ACTING, "escrevendo direct...");
      await this.typeCommentText(input, safeMessage);
      await this.submitDirectMessage();
      await this.theatricalDelay();
      this.updateStatus(INSTAGRAM_STATUS.READY, "direct enviado");
      return { status: "sent", message: "INSTAGRAM: direct enviado" };
    } catch (error) {
      const messageText = publicError(error);
      this.lastError = messageText;
      await this.saveDebugArtifact("direct-error");
      this.updateStatus(INSTAGRAM_STATUS.ERROR, `erro Playwright: ${messageText}`);
      return { status: "error", message: "INSTAGRAM: nao foi possivel enviar direct" };
    } finally {
      this.commandInProgress = false;
    }
  }

  async openDirects() {
    if (this.commandInProgress || this.actionInProgress) {
      return { status: "busy", message: "INSTAGRAM: acao em andamento" };
    }

    this.commandInProgress = true;
    this.lastAction = "openDirects";
    this.targetProfile = null;
    this.updateStatus(INSTAGRAM_STATUS.STARTING, "directs solicitados");

    try {
      const opened = await this.openDirectInbox();
      if (opened.status !== "ready") {
        return opened;
      }

      await this.waitForEmbeddedFrameReady("directs carregado");
      this.updateStatus(INSTAGRAM_STATUS.READY, "directs aberto no iframe");
      return { status: "ready", message: "INSTAGRAM: directs aberto no iframe" };
    } finally {
      this.commandInProgress = false;
    }
  }

  async likeProfileMedia(username, index = 1) {
    const safeUsername = this.assertAllowedUsername(username);
    const safeIndex = Math.min(12, Math.max(1, Math.round(Number(index) || 1)));

    if (this.commandInProgress || this.actionInProgress) {
      return { status: "busy", message: "INSTAGRAM: acao em andamento" };
    }

    this.commandInProgress = true;
    this.lastAction = `like media ${safeIndex} @${safeUsername}`;
    this.targetProfile = safeUsername;
    this.updateStatus(INSTAGRAM_STATUS.STARTING, `curtir post ${safeIndex} de @${safeUsername}`);

    try {
      const opened = await this.openProfile(safeUsername);
      if (opened.status !== "ready") {
        return opened;
      }

      await this.waitForEmbeddedFrameReady("perfil carregado");

      if (!await this.openProfileMediaAt(safeUsername, safeIndex, { reason: `abrindo post ${safeIndex}` })) {
        await this.saveDebugArtifact("like-media-unavailable");
        await this.recoverProfileView(safeUsername);
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "midia nao encontrada para curtir");
        return { status: "unconfirmed", message: "INSTAGRAM: midia nao encontrada para curtir" };
      }

      const before = await this.getLikeButtonState();
      if (before.state === "liked") {
        return { status: "already_liked", message: "INSTAGRAM: post ja estava curtido" };
      }

      if (before.state !== "like" || !before.locator) {
        await this.saveDebugArtifact("like-button-unavailable");
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "botao de curtir nao reconhecido");
        return { status: "unconfirmed", message: "INSTAGRAM: botao de curtir nao reconhecido" };
      }

      this.updateStatus(INSTAGRAM_STATUS.ACTING, "curtindo post...");
      await this.theatricalDelay();
      await this.withStreamPaused(() => robustLocatorClick(before.locator));
      await this.theatricalDelay();

      const after = await this.getLikeButtonState();
      if (after.state === "liked") {
        return { status: "liked", message: "INSTAGRAM: post curtido" };
      }

      return { status: "unconfirmed", message: "INSTAGRAM: curtida nao confirmada" };
    } catch (error) {
      const messageText = publicError(error);
      this.lastError = messageText;
      await this.saveDebugArtifact("like-error");
      this.updateStatus(INSTAGRAM_STATUS.ERROR, `erro Playwright: ${messageText}`);
      return { status: "error", message: "INSTAGRAM: nao foi possivel curtir" };
    } finally {
      this.commandInProgress = false;
    }
  }

  async openProfileMedia(username, index = 1) {
    const safeUsername = this.assertAllowedUsername(username);
    const safeIndex = Math.min(12, Math.max(1, Math.round(Number(index) || 1)));

    if (this.commandInProgress || this.actionInProgress) {
      return { status: "busy", message: "INSTAGRAM: acao em andamento" };
    }

    this.commandInProgress = true;
    this.lastAction = `open media ${safeIndex} @${safeUsername}`;
    this.targetProfile = safeUsername;
    this.updateStatus(INSTAGRAM_STATUS.STARTING, `abrir post ${safeIndex} de @${safeUsername}`);

    try {
      const opened = await this.openProfile(safeUsername);
      if (opened.status !== "ready") {
        return opened;
      }

      await this.waitForEmbeddedFrameReady("perfil carregado");

      if (!await this.openProfileMediaAt(safeUsername, safeIndex, { reason: safeIndex > 1 ? `abrindo post ${safeIndex}` : "abrindo ultima midia" })) {
        await this.saveDebugArtifact("open-media-unavailable");
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "midia nao encontrada");
        return { status: "unconfirmed", message: "INSTAGRAM: midia nao encontrada" };
      }

      await this.waitForEmbeddedFrameReady("midia aberta");
      this.updateStatus(INSTAGRAM_STATUS.READY, `post ${safeIndex} aberto no iframe`);
      return { status: "ready", message: `INSTAGRAM: post ${safeIndex} aberto no iframe` };
    } finally {
      this.commandInProgress = false;
    }
  }

  async follow(username) {
    const safeUsername = this.assertAllowedUsername(username);
    if (this.commandInProgress || this.actionInProgress) {
      return { status: "busy", message: "INSTAGRAM: acao em andamento" };
    }

    this.commandInProgress = true;
    this.lastAction = `follow @${safeUsername}`;
    this.targetProfile = safeUsername;
    this.updateStatus(INSTAGRAM_STATUS.STARTING, `acao solicitada: seguir @${safeUsername}`);

    try {
      const opened = await this.openProfile(safeUsername);
      if (opened.status !== "ready") {
        return opened;
      }

      await this.waitForEmbeddedFrameReady("perfil carregado");

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
        await this.recoverProfileView(safeUsername);
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "botao de seguir nao reconhecido");
        return {
          status: "unconfirmed",
          message: "INSTAGRAM: nao foi possivel confirmar a acao"
        };
      }

      this.updateStatus(INSTAGRAM_STATUS.ACTING, "seguindo...");
      await this.theatricalDelay();
      await this.withStreamPaused(() => robustLocatorClick(before.locator));
      await this.theatricalDelay();

      const after = await this.waitForFollowStateChange();
      this.lastButtonState = after.state;
      this.updateStatus(INSTAGRAM_STATUS.READY, `estado final do botao: ${after.state || "desconhecido"}`);

      if (FOLLOWING_STATES.has(after.state)) {
        await this.recoverProfileView(safeUsername);
        return {
          status: "following",
          message: `INSTAGRAM: seguindo @${safeUsername}`
        };
      }

      if (REQUESTED_STATES.has(after.state)) {
        await this.recoverProfileView(safeUsername);
        return {
          status: "requested",
          message: `INSTAGRAM: solicitacao enviada para @${safeUsername}`
        };
      }

      await this.saveDebugArtifact("follow-result-unconfirmed");
      await this.recoverProfileView(safeUsername);
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
    } finally {
      this.commandInProgress = false;
    }
  }

  async commentLatestMedia(username, comment) {
    return this.commentProfileMedia(username, comment, 1);
  }

  async commentProfileMedia(username, comment, index = 1) {
    const safeUsername = this.assertAllowedUsername(username);
    const safeComment = normalizeCommentText(comment);
    const safeIndex = Math.min(12, Math.max(1, Math.round(Number(index) || 1)));
    if (!safeComment) {
      throw new Error("INSTAGRAM_COMMENT_EMPTY");
    }

    if (this.commandInProgress || this.actionInProgress) {
      return { status: "busy", message: "INSTAGRAM: acao em andamento" };
    }

    this.commandInProgress = true;
    this.lastAction = `comment media ${safeIndex} @${safeUsername}`;
    this.targetProfile = safeUsername;
    this.updateStatus(INSTAGRAM_STATUS.STARTING, `comentario solicitado em @${safeUsername}`);

    try {
      const opened = await this.openProfile(safeUsername);
      if (opened.status !== "ready") {
        return opened;
      }

      await this.waitForEmbeddedFrameReady("perfil carregado");

      if (!await this.openProfileMediaAt(safeUsername, safeIndex, { reason: safeIndex > 1 ? `abrindo post ${safeIndex}` : "botao ausente no perfil; abrindo ultima midia" })) {
        await this.saveDebugArtifact("comment-media-unavailable");
        await this.recoverProfileView(safeUsername);
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "midia recente nao encontrada para comentario");
        return { status: "unconfirmed", message: "INSTAGRAM: nao foi possivel comentar na midia" };
      }

      await this.openCommentsSurface();

      const commentInput = await this.findCommentInput();
      if (!commentInput) {
        await this.saveDebugArtifact("comment-input-unavailable");
        await this.recoverProfileView(safeUsername);
        this.updateStatus(INSTAGRAM_STATUS.MANUAL_INTERVENTION, "campo de comentario nao reconhecido");
        return { status: "unconfirmed", message: "INSTAGRAM: campo de comentario nao reconhecido" };
      }

      this.updateStatus(INSTAGRAM_STATUS.ACTING, "comentando na ultima midia...");
      await this.theatricalDelay();
      await this.typeCommentText(commentInput, safeComment);
      await this.submitComment();
      await this.theatricalDelay();
      this.updateStatus(INSTAGRAM_STATUS.READY, "comentario enviado");
      return {
        status: "commented",
        message: `INSTAGRAM: comentario enviado para @${safeUsername}`
      };
    } catch (error) {
      const message = publicError(error);
      this.lastError = message;
      await this.saveDebugArtifact("comment-error");
      this.updateStatus(INSTAGRAM_STATUS.ERROR, `erro Playwright: ${message}`);
      return { status: "error", message: "INSTAGRAM: nao foi possivel comentar" };
    } finally {
      this.commandInProgress = false;
    }
  }

  async isFollowing(username) {
    await this.openProfile(username);
    const result = await this.getFollowButtonState();
    return FOLLOWING_STATES.has(result.state) || REQUESTED_STATES.has(result.state);
  }

  async close() {
    this.stopReelsAutoplay({ silent: true });

    if (!this.context) {
      this.updateStatus(INSTAGRAM_STATUS.DISCONNECTED, "navegador ja fechado");
      return;
    }

    await this.context.close();
  }

  async setAudioMuted(muted = true) {
    this.audioMuted = Boolean(muted);

    if (this.page) {
      await this.applyAudioMuted().catch(() => {});
    }

    this.updateStatus(this.status, this.audioMuted ? "audio Instagram desligado" : "audio Instagram ligado");
    return {
      status: "ready",
      muted: this.audioMuted,
      message: this.audioMuted ? "INSTAGRAM: audio desligado" : "INSTAGRAM: audio ligado"
    };
  }

  async applyAudioMuted() {
    if (!this.page) {
      return;
    }

    const muted = this.audioMuted;
    await this.page.evaluate((nextMuted) => {
      window.__caixaPretaInstagramAudioMuted = nextMuted;
      if (!window.__caixaPretaInstagramAudioObserver) {
        window.__caixaPretaInstagramAudioObserver = new MutationObserver(() => {
          const muted = Boolean(window.__caixaPretaInstagramAudioMuted);
          for (const media of document.querySelectorAll("video, audio")) {
            media.muted = muted;
            if (!muted) {
              media.volume = 1;
            }
          }
        });
        window.__caixaPretaInstagramAudioObserver.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      }

      for (const media of document.querySelectorAll("video, audio")) {
        media.muted = nextMuted;
        if (!nextMuted) {
          media.volume = 1;
        }
      }
    }, muted);
  }

  async stopAllRoutines() {
    this.stopReelsAutoplay({ silent: true });
    this.actionInProgress = false;
    this.commandInProgress = false;

    if (this.page) {
      await this.page.evaluate(() => {
        for (const media of document.querySelectorAll("video, audio")) {
          media.pause?.();
        }
      }).catch(() => {});
    }
    if (this.secondaryPage) {
      await this.secondaryPage.evaluate(() => {
        for (const media of document.querySelectorAll("video, audio")) media.pause?.();
      }).catch(() => {});
    }

    this.updateStatus(this.status, "rotinas Instagram paradas");
    return { status: "stopped", message: "INSTAGRAM: rotinas paradas" };
  }

  async captureFrame({ fast = false, pane = "primary" } = {}) {
    if (pane === "secondary" && this.secondaryPage) {
      const viewport = this.secondaryPage.viewportSize() || this.config.viewport;
      const image = await this.secondaryPage.screenshot({
        fullPage: false,
        type: "jpeg",
        quality: this.config.streamQuality
      });
      return {
        image: `data:image/jpeg;base64,${image.toString("base64")}`,
        viewport,
        status: this.getStatus()
      };
    }
    const frame = await this.captureJpegFrame({
      quality: this.config.streamQuality,
      skipPageSetup: fast
    });

    return {
      image: `data:image/jpeg;base64,${frame.image.toString("base64")}`,
      viewport: frame.viewport,
      status: this.getStatus()
    };
  }

  async captureJpegFrame({ quality = this.config.streamQuality, skipPageSetup = false } = {}) {
    if (this.actionInProgress) {
      throw new Error("INSTAGRAM_ACTION_IN_PROGRESS");
    }

    this.ensurePage();
    if (!skipPageSetup) {
      await this.configurePage();
      await this.applyAudioMuted().catch(() => {});
    }
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

  async withStreamPaused(callback) {
    this.actionInProgress = true;
    try {
      return await callback();
    } finally {
      this.actionInProgress = false;
    }
  }

  async typeCommentText(commentInput, text) {
    await robustLocatorClick(commentInput);

    const typingDelayMs = parseInteger(process.env.INSTAGRAM_COMMENT_TYPE_DELAY_MS, 34, 0, 250);

    if (this.page?.keyboard?.type) {
      await this.page.keyboard.press("Meta+A").catch(() => {});
      await this.page.keyboard.press("Backspace").catch(() => {});
      await this.page.keyboard.type(text, { delay: typingDelayMs });
      return;
    }

    if (commentInput.pressSequentially) {
      await commentInput.pressSequentially(text, { delay: typingDelayMs });
      return;
    }

    await commentInput.fill(text);
  }

  async waitForEmbeddedFrameReady(reason = "aguardando iframe") {
    if (!this.config.embedded) {
      return true;
    }

    this.updateStatus(this.status, `${reason}; aguardando imagem embedded`);
    const deadline = Date.now() + 6000;
    let lastError = null;

    while (Date.now() < deadline) {
      try {
        await this.captureJpegFrame({ quality: Math.min(this.config.streamQuality, 55) });
        await this.page.waitForTimeout(500);
        return true;
      } catch (error) {
        lastError = publicError(error);
        await this.page?.waitForTimeout(300);
      }
    }

    this.lastError = lastError;
    this.updateStatus(this.status, "imagem embedded ainda nao confirmou; prosseguindo");
    return false;
  }

  async sendEmbeddedInput(input = {}) {
    if (input.pane === "secondary" && this.secondaryPage) {
      const page = this.secondaryPage;
      await page.bringToFront?.().catch(() => {});
      if (input.type === "click") {
        const viewport = page.viewportSize() || this.config.viewport;
        const x = Math.max(0, Math.min(1, Number(input.x) || 0)) * viewport.width;
        const y = Math.max(0, Math.min(1, Number(input.y) || 0)) * viewport.height;
        if (page.touchscreen?.tap) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
        return { ok: true };
      }
      if (input.type === "key") {
        const key = `${input.key || ""}`;
        if (key.length === 1) await page.keyboard.type(key);
        else await page.keyboard.press(key);
        return { ok: true };
      }
      if (input.type === "swipe") {
        const direction = input.direction === "down" ? -1 : 1;
        await page.evaluate((delta) => window.scrollBy({ top: Math.round(window.innerHeight * 0.62) * delta, behavior: "smooth" }), direction);
        return { ok: true };
      }
      return { ok: false };
    }
    this.ensurePage();
    await this.configurePage();
    await this.page.bringToFront?.().catch(() => {});

    if (input.type === "click") {
      const viewport = this.page.viewportSize() || this.config.viewport || DEFAULT_VIEWPORT;
      const x = Math.max(0, Math.min(1, Number(input.x) || 0)) * viewport.width;
      const y = Math.max(0, Math.min(1, Number(input.y) || 0)) * viewport.height;
      await this.tapEmbeddedPoint(x, y);
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

  async tapEmbeddedPoint(x, y) {
    if (this.config.embedded && this.page.touchscreen?.tap) {
      await this.page.touchscreen.tap(x, y);
      return;
    }

    await this.page.mouse.click(x, y);
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

    const desiredViewport = this.browserMode === "google_guidance" ? GOOGLE_VIEWPORT : this.config.viewport;
    const currentViewport = this.page.viewportSize();
    if (
      !currentViewport ||
      currentViewport.width !== desiredViewport.width ||
      currentViewport.height !== desiredViewport.height
    ) {
      await this.page.setViewportSize(desiredViewport);
      this.updateStatus(this.status, `viewport ${this.browserMode === "google_guidance" ? "desktop" : "mobile"} aplicado: ${desiredViewport.width}x${desiredViewport.height}`);
    }

    await this.page.setExtraHTTPHeaders({
      ...(this.browserMode === "google_guidance" ? {} : { "User-Agent": MOBILE_USER_AGENT }),
      "Sec-CH-UA-Mobile": this.browserMode === "google_guidance" ? "?0" : "?1"
    }).catch(() => null);
    await this.applyAudioMuted().catch(() => null);
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

    if (this.config.allowedProfiles.length && !this.config.allowedProfiles.includes(safeUsername)) {
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

  async waitForProfileGridMedia({ minCount = 1, timeoutMs = 9000 } = {}) {
    this.ensurePage();
    this.updateStatus(this.status, `aguardando posts visiveis no perfil (${minCount})`);

    const deadline = Date.now() + timeoutMs;
    const mediaLinks = this.page.locator("main a[href*='/p/'], main a[href*='/reel/'], main a[href*='/tv/']");

    while (Date.now() < deadline) {
      const visibleCount = await mediaLinks.evaluateAll((links) => links.filter((link) => {
        const rect = link.getBoundingClientRect();
        return rect.width > 20 && rect.height > 20;
      }).length).catch(() => 0);

      const loadedImages = await this.page.locator("main a[href*='/p/'] img, main a[href*='/reel/'] img, main a[href*='/tv/'] img").evaluateAll((images) => images.filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.width > 20 && rect.height > 20 && image.complete && image.naturalWidth > 0;
      }).length).catch(() => 0);

      if (visibleCount >= minCount || loadedImages >= minCount) {
        await this.page.waitForTimeout(350);
        this.updateStatus(this.status, `posts visiveis no perfil: ${Math.max(visibleCount, loadedImages)}`);
        return true;
      }

      await this.page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.18))).catch(() => {});
      await this.page.waitForTimeout(450).catch(() => {});
    }

    this.updateStatus(this.status, "posts do perfil ainda nao ficaram visiveis");
    return false;
  }

  async openLatestProfileMedia(username) {
    return this.openProfileMediaAt(username, 1);
  }

  async openProfileMediaAt(username, index = 1, { reason = "botao ausente no perfil; abrindo ultima midia" } = {}) {
    this.ensurePage();
    const safeIndex = Math.min(12, Math.max(1, Math.round(Number(index) || 1)));
    const profileUrlPattern = new RegExp(`instagram\\.com/${escapeRegExp(username)}/?`, "i");
    if (!profileUrlPattern.test(this.page.url())) {
      await this.page.goto(`https://www.instagram.com/${username}/`, { waitUntil: "domcontentloaded" });
      await this.waitForProfile(username);
    }

    this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, reason);
    await this.dismissKnownModals();

    const mediaLink = this.page
      .locator("main a[href*='/p/'], main a[href*='/reel/'], main a[href*='/tv/']")
      .nth(safeIndex - 1);

    if (!await waitForVisible(mediaLink, 3500)) {
      await this.page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.75))).catch(() => {});
      await this.page.waitForTimeout(400);
    }

    if (!await waitForVisible(mediaLink, 3500)) {
      this.updateStatus(INSTAGRAM_STATUS.READY, "nenhuma midia recente visivel no perfil");
      return false;
    }

    await this.theatricalDelay();
    const clickedMedia = await robustLocatorClick(mediaLink);
    const openedSurface = await Promise.race([
      this.page.waitForURL(/instagram\.com\/(p|reel|tv)\//i, { timeout: 2500 }).then(() => "url").catch(() => null),
      waitForVisible(this.page.getByRole("dialog").first(), 2500).then((visible) => visible ? "dialog" : null)
    ]);
    const mediaArticleOpened = openedSurface === "url" && await waitForVisible(this.page.locator("article").first(), 5000);
    this.currentUrl = this.page.url();
    await this.dismissKnownModals();
    return Boolean(clickedMedia || openedSurface || mediaArticleOpened || /instagram\.com\/(p|reel|tv)\//i.test(this.currentUrl));
  }

  async openDirectInbox() {
    const opened = await this.open();
    if (opened.status !== "ready") {
      return opened;
    }

    this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, "abrindo direct");
    await this.theatricalDelay();
    await this.page.goto("https://www.instagram.com/direct/inbox/", { waitUntil: "domcontentloaded" });
    this.currentUrl = this.page.url();
    await this.dismissKnownModals();
    await Promise.race([
      this.page.waitForURL(/instagram\.com\/direct/i, { timeout: 12000 }).catch(() => null),
      this.page.locator("main").first().waitFor({ state: "visible", timeout: 12000 }).catch(() => null)
    ]);

    if (this.status === INSTAGRAM_STATUS.LOGIN_REQUIRED || await this.hasManualInterventionSignal()) {
      return { status: "manual_intervention", message: "INSTAGRAM: intervencao manual necessaria" };
    }

    this.updateStatus(INSTAGRAM_STATUS.READY, "direct carregado");
    return { status: "ready", message: "INSTAGRAM: direct carregado" };
  }

  async openLatestDirectThread() {
    this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, "abrindo ultima conversa direct");
    const candidates = [
      this.page.locator("main a[href*='/direct/t/']").first(),
      this.page.locator("main [role='link'][href*='/direct/t/']").first(),
      this.page.locator("main [role='button']").filter({ hasText: /.+/ }).first()
    ];

    for (const candidate of candidates) {
      if (await waitForVisible(candidate, 5000)) {
        await robustLocatorClick(candidate);
        await this.waitForDirectThreadReady();
        return true;
      }
    }

    return false;
  }

  async openDirectThreadByText(thread) {
    this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, `procurando conversa direct: ${thread}`);
    const words = `${thread}`.split(/(?:,|\se\s|\sand\s|\s+)/i).map((word) => word.trim()).filter((word) => word.length > 1);
    const pattern = words.length
      ? new RegExp(words.map(escapeRegExp).join("|"), "i")
      : /.+/;
    const candidates = [
      this.page.locator("main a[href*='/direct/t/']").filter({ hasText: pattern }).first(),
      this.page.locator("main [role='button']").filter({ hasText: pattern }).first(),
      this.page.getByText(pattern).first()
    ];

    for (const candidate of candidates) {
      if (await waitForVisible(candidate, 4500)) {
        await robustLocatorClick(candidate);
        await this.waitForDirectThreadReady();
        return true;
      }
    }

    return false;
  }

  async waitForDirectThreadReady() {
    await Promise.race([
      this.page.waitForURL(/instagram\.com\/direct\/t\//i, { timeout: 8000 }).catch(() => null),
      this.page.getByRole("textbox").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => null),
      this.page.locator("textarea, [contenteditable='true']").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => null)
    ]);
    this.currentUrl = this.page.url();
    await this.dismissKnownModals();
  }

  async openCommentsSurface() {
    this.ensurePage();
    this.updateStatus(INSTAGRAM_STATUS.NAVIGATING, "abrindo comentarios da midia");

    const contexts = [
      this.page.getByRole("dialog").first(),
      this.page.locator("article").first(),
      this.page.locator("main").first(),
      this.page
    ];
    const commentControls = [
      (context) => context.getByRole("button", { name: /comment|coment.rio|comentar/i }).first(),
      (context) => context.getByLabel(/comment|coment.rio|comentar/i).first(),
      (context) => context.locator("svg[aria-label*='Comment' i], svg[aria-label*='Coment' i]").first(),
      (context) => context.getByText(/view all .* comments|ver todos .* coment.rios|coment.rios/i).first()
    ];

    for (const context of contexts) {
      for (const controlForContext of commentControls) {
        const control = controlForContext(context);
        if (await control.isVisible().catch(() => false)) {
          await robustLocatorClick(control);
          await this.page.waitForTimeout(500);
          return true;
        }
      }
    }

    await this.page.keyboard.press("c").catch(() => {});
    await this.page.waitForTimeout(500);
    return false;
  }

  async findCommentInput() {
    const patterns = [
      /add a comment/i,
      /adicione um coment.rio/i,
      /comentar/i,
      /comment/i
    ];

    const contexts = [
      this.page.getByRole("dialog").first(),
      this.page.locator("article").first(),
      this.page.locator("main").first(),
      this.page
    ];

    for (const context of contexts) {
      for (const pattern of patterns) {
        const textbox = context.getByRole("textbox", { name: pattern }).first();
        if (await textbox.isVisible().catch(() => false)) {
          return textbox;
        }

        const placeholder = context.locator("textarea").filter({ hasText: pattern }).first();
        if (await placeholder.isVisible().catch(() => false)) {
          return placeholder;
        }
      }

      const textarea = context.locator("textarea").first();
      if (await textarea.isVisible().catch(() => false)) {
        return textarea;
      }

      const editable = context.locator("[contenteditable='true']").first();
      if (await editable.isVisible().catch(() => false)) {
        return editable;
      }
    }

    return null;
  }

  async findDirectMessageInput() {
    const patterns = [
      /message/i,
      /mensagem/i,
      /escreva/i,
      /write/i
    ];
    const contexts = [
      this.page.locator("main").first(),
      this.page
    ];

    for (const context of contexts) {
      for (const pattern of patterns) {
        const textbox = context.getByRole("textbox", { name: pattern }).first();
        if (await textbox.isVisible().catch(() => false)) {
          return textbox;
        }
      }

      const textarea = context.locator("textarea").first();
      if (await textarea.isVisible().catch(() => false)) {
        return textarea;
      }

      const editable = context.locator("[contenteditable='true']").last();
      if (await editable.isVisible().catch(() => false)) {
        return editable;
      }
    }

    return null;
  }

  async submitDirectMessage() {
    const buttons = [
      this.page.getByRole("button", { name: /^Send$|^Enviar$/i }).first(),
      this.page.getByText(/^Send$|^Enviar$/i).first()
    ];

    for (const button of buttons) {
      if (await button.isVisible().catch(() => false)) {
        await robustLocatorClick(button);
        return true;
      }
    }

    await this.page.keyboard.press("Enter");
    return true;
  }

  async getLikeButtonState() {
    const contexts = [
      this.page.getByRole("dialog").first(),
      this.page.locator("article").first(),
      this.page.locator("main").first(),
      this.page
    ];
    const states = [
      {
        state: "liked",
        controls: [
          (context) => context.getByRole("button", { name: /unlike|descurtir/i }).first(),
          (context) => context.locator("svg[aria-label*='Unlike' i], svg[aria-label*='Descurtir' i]").first()
        ]
      },
      {
        state: "like",
        controls: [
          (context) => context.getByRole("button", { name: /^like$|curtir/i }).first(),
          (context) => context.locator("svg[aria-label*='Like' i], svg[aria-label*='Curtir' i]").first()
        ]
      }
    ];

    for (const context of contexts) {
      for (const candidateState of states) {
        for (const controlForContext of candidateState.controls) {
          const locator = controlForContext(context);
          if (await locator.isVisible().catch(() => false)) {
            return { state: candidateState.state, locator };
          }
        }
      }
    }

    return { state: null, locator: null };
  }

  async submitComment() {
    const buttons = [
      this.page.getByRole("button", { name: /^Post$|^Publicar$|^Enviar$/i }).first(),
      this.page.getByText(/^Post$|^Publicar$|^Enviar$/i).first()
    ];

    for (const button of buttons) {
      if (await button.isVisible().catch(() => false)) {
        await robustLocatorClick(button);
        return true;
      }
    }

    await this.page.keyboard.press("Enter");
    return true;
  }

  async recoverProfileView(username) {
    await this.page.goto(`https://www.instagram.com/${username}/`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await this.waitForProfile(username).catch(() => {});
    await this.dismissKnownModals().catch(() => {});
    this.currentUrl = this.page.url();
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
