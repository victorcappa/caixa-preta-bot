const assert = require("node:assert/strict");

async function main() {
  const controllerModule = await import("../lib/instagram/InstagramController.js");
  const commands = await import("../lib/instagram/commands.js");

  assert.equal(controllerModule.normalizeUsername("@cappavictor"), "cappavictor");
  assert.equal(controllerModule.normalizeUsername(" cappavictor "), "cappavictor");
  assert.equal(controllerModule.normalizeUsername("https://instagram.com/cappavictor"), "");
  assert.equal(controllerModule.normalizeResearchPersonName("  Janaína\n  Leite  "), "Janaína Leite");
  assert.equal(
    controllerModule.normalizeGoogleGuidance("  buscar  sobre eleições\n de 2026  "),
    "buscar sobre eleições de 2026"
  );
  assert.deepEqual(
    controllerModule.parseGoogleGuidance("buscar sobre o candidato do pl para eleições de 2026 e escolher alguma notícia para ler por 15 segundos"),
    {
      guidance: "buscar sobre o candidato do pl para eleições de 2026 e escolher alguma notícia para ler por 15 segundos",
      query: "o candidato do pl para eleições de 2026",
      durationSeconds: 15,
      openResult: true,
      preferNews: true,
      wantsComment: false,
      resultCount: 2,
      subject: "o candidato do pl para eleições de 2026",
      wantsInstagram: false
    }
  );
  assert.deepEqual(
    controllerModule.parseGoogleGuidance("buscar noticias sobre nicolas ferreira e escolher uma noticia e comentar algo sarcastico sobre"),
    {
      guidance: "buscar noticias sobre nicolas ferreira e escolher uma noticia e comentar algo sarcastico sobre",
      query: "noticias sobre nicolas ferreira",
      durationSeconds: 0,
      openResult: true,
      preferNews: true,
      wantsComment: true,
      resultCount: 2,
      subject: "nicolas ferreira",
      wantsInstagram: true
    }
  );
  assert.equal(controllerModule.normalizePublicResearchUrl("http://127.0.0.1/admin"), null);
  assert.equal(controllerModule.normalizePublicResearchUrl("https://www.jusbrasil.com.br/pessoa/teste"), null);
  assert.equal(
    controllerModule.normalizePublicResearchUrl("https://www.google.com/url?q=https%3A%2F%2Fwww.instagram.com%2Fjanainaleite%2F&sa=U"),
    "https://www.instagram.com/janainaleite/"
  );
  assert.deepEqual(controllerModule.selectPersonResearchLinks([
    "https://www.google.com/search?q=janaina",
    "https://festival.example.org/artistas/janaina-leite",
    "https://www.instagram.com/janainaleite/",
    "https://www.instagram.com/p/post-id/"
  ]), {
    interesting: "https://festival.example.org/artistas/janaina-leite",
    instagram: "https://www.instagram.com/janainaleite/"
  });
  assert.deepEqual(controllerModule.selectGuidedGoogleResult([
    { url: "https://www.google.com/search?q=eleicoes", text: "Google" },
    { url: "https://jornal.example.com/tudo-sobre/candidato", text: "Arquivo do candidato" },
    { url: "https://example.org/arquivo", text: "Arquivo" },
    { url: "https://jornal.example.com/politica/candidato", text: "Notícia sobre candidato" }
  ], { preferNews: true }), {
    url: "https://jornal.example.com/politica/candidato",
    text: "Notícia sobre candidato"
  });

  assert.deepEqual(commands.parseInstagramCommand("follow cappavictor"), {
    valid: true,
    action: "follow",
    username: "cappavictor",
    error: null
  });

  assert.equal(commands.parseInstagramCommand("like cappavictor").valid, false);
  assert.equal(commands.parseInstagramCommand("follow cappavictor extra").valid, false);
  assert.equal(commands.parseInstagramCommand("follow https://instagram.com/cappavictor").valid, false);
  assert.deepEqual(commands.parseInstagramCommand("entrar no perfil @cappavictor e comentar na ultima foto 'biscoiteiro'"), {
    valid: true,
    action: "comment_latest",
    username: "cappavictor",
    comment: "biscoiteiro",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("seguir perfil do marcusgarcia e comentar na ultima foto algo engraçado"), {
    valid: true,
    action: "follow_and_comment_latest",
    username: "marcusgarcia",
    comment: "biscoiteiro profissional em horario comercial",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("entrar no perfil @cappavictor"), {
    valid: true,
    action: "open_profile",
    username: "cappavictor",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("assistir reels"), {
    valid: true,
    action: "watch_reels",
    username: "",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("ver reels"), {
    valid: true,
    action: "watch_reels",
    username: "",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("abrir directs"), {
    valid: true,
    action: "open_directs",
    username: "",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("ver minhas mensagens"), {
    valid: true,
    action: "open_directs",
    username: "",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("entrar na ultima mensagem e escrever uma mensagem para o grupo: olá, mundo"), {
    valid: true,
    action: "send_direct_latest",
    username: "",
    message: "olá, mundo",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("escrever algo no chat group com livinha, janaina e marcus: oi grupo"), {
    valid: true,
    action: "send_direct_thread",
    username: "",
    message: "oi grupo",
    thread: "livinha, janaina e marcus",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("curtir o terceiro post do perfil cappavictor"), {
    valid: true,
    action: "like_nth_media",
    username: "cappavictor",
    postIndex: 3,
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("curtir ultimo post do perfil cappavictor"), {
    valid: true,
    action: "like_latest_media",
    username: "cappavictor",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("olhar ultimo post do perfil cappavictor"), {
    valid: true,
    action: "open_latest_media",
    username: "cappavictor",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("comentar o terceiro post do perfil cappavictor: biscoiteiro"), {
    valid: true,
    action: "comment_nth_media",
    username: "cappavictor",
    comment: "biscoiteiro",
    postIndex: 3,
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("analisar o instagram"), {
    valid: true,
    action: "analyze_current",
    username: "",
    question: "o instagram",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("analisar perfil do marcusgarcia"), {
    valid: true,
    action: "analyze_profile",
    username: "marcusgarcia",
    question: "",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("analisar ultima foto do perfil @cappavictor"), {
    valid: true,
    action: "analyze_latest_media",
    username: "cappavictor",
    question: "ultima foto do perfil",
    error: null
  });
  assert.deepEqual(commands.parseInstagramCommand("entrar no perfil de cappavictor e analisar os ultimos tres post"), {
    valid: true,
    action: "analyze_recent_posts",
    username: "cappavictor",
    question: "os ultimos tres post",
    error: null
  });

  const config = controllerModule.getInstagramConfig({
    INSTAGRAM_ENABLED: "true",
    INSTAGRAM_EMBEDDED: "true",
    INSTAGRAM_DEBUG: "true",
    INSTAGRAM_THEATRICAL_DELAY: "2000",
    INSTAGRAM_VIEWPORT_WIDTH: "430",
    INSTAGRAM_VIEWPORT_HEIGHT: "760",
    INSTAGRAM_STREAM_FPS: "24",
    INSTAGRAM_STREAM_QUALITY: "70",
    INSTAGRAM_ALLOWED_PROFILES: "cappavictor"
  });

  assert.equal(config.enabled, true);
  assert.equal(config.embedded, true);
  assert.equal(config.debug, true);
  assert.equal(config.theatricalDelayMs, 1500);
  assert.deepEqual(config.viewport, { width: 430, height: 760 });
  assert.equal(config.streamFps, 24);
  assert.equal(config.streamQuality, 70);
  assert.deepEqual(config.allowedProfiles, ["cappavictor"]);
  assert(config.profileDir.endsWith(".runtime/instagram-profile"));
  assert(config.debugDir.endsWith(".runtime/instagram-debug"));
  assert(config.credentialsPath.endsWith("config/instagram-credentials.local.json"));
  assert.deepEqual(controllerModule.parseInstagramCredentials(JSON.stringify({
    username: "@CaixaPretaBot",
    password: "senha-teste"
  })), {
    username: "caixapretabot",
    password: "senha-teste"
  });
  assert.equal(controllerModule.parseInstagramCredentials(JSON.stringify({
    username: "caixapretabot",
    password: "COLOQUE_A_SENHA_AQUI"
  })), null);
  assert.throws(() => controllerModule.parseInstagramCredentials("nao-json"), /INSTAGRAM_CREDENTIALS_INVALID_JSON/);

  const loginEvents = [];
  const loginValues = { username: "", password: "", submitted: false };
  const loginController = new controllerModule.InstagramController({
    config,
    reporter: (event) => loginEvents.push(event),
    credentialsLoader: async () => ({ username: "caixapretabot", password: "segredo-que-nao-pode-vazar" })
  });
  loginController.page = createLoginPage(loginValues);
  loginController.getSessionState = async () => loginValues.submitted ? "authenticated" : "login_required";
  loginController.dismissKnownModals = async () => {};
  assert.deepEqual(await loginController.attemptAutomaticLogin(), {
    status: "ready",
    message: "INSTAGRAM: login automatico concluido"
  });
  assert.deepEqual(loginValues, {
    username: "caixapretabot",
    password: "segredo-que-nao-pode-vazar",
    submitted: true
  });
  assert.equal(JSON.stringify(loginEvents).includes("segredo-que-nao-pode-vazar"), false);

  const missingCredentialsController = new controllerModule.InstagramController({
    config,
    credentialsLoader: async () => null
  });
  assert.deepEqual(await missingCredentialsController.attemptAutomaticLogin(), {
    status: "login_required",
    message: "INSTAGRAM: credenciais locais ausentes"
  });

  const controller = new controllerModule.InstagramController({ config });
  assert.equal(controller.assertAllowedUsername("@cappavictor"), "cappavictor");
  assert.throws(
    () => controller.assertAllowedUsername("outra_conta"),
    /INSTAGRAM_PROFILE_NOT_ALLOWED:outra_conta/
  );

  const openConfig = controllerModule.getInstagramConfig({
    INSTAGRAM_ALLOWED_PROFILES: ""
  });
  const openController = new controllerModule.InstagramController({ config: openConfig });
  assert.deepEqual(openConfig.allowedProfiles, []);
  assert.equal(openController.assertAllowedUsername("marcusgarcia"), "marcusgarcia");

  const guidedController = new controllerModule.InstagramController({ config });
  const guidedNavigations = [];
  const guidedStatuses = [];
  guidedController.init = async () => {};
  guidedController.configurePage = async () => {};
  guidedController.searchPublicWeb = async (query, options) => {
    assert.equal(query, "eleições de 2026");
    assert.deepEqual(options, { preferGoogle: true, news: true });
    return "google";
  };
  guidedController.collectCurrentSearchResults = async () => [
    { url: "https://jornal.example.com/politica/eleicoes", text: "Notícia eleitoral" }
  ];
  guidedController.updateStatus = (status, message) => {
    guidedController.status = status;
    guidedController.message = message;
    guidedStatuses.push({ status, message });
  };
  guidedController.page = {
    goto: async (url) => guidedNavigations.push(url),
    waitForTimeout: async () => {},
    evaluate: async () => ({
      title: "Notícia eleitoral",
      text: "Trecho factual suficientemente longo da notícia eleitoral escolhida para o teste, com contexto adicional visível e uma segunda informação concreta que ultrapassa o mínimo exigido para considerar a página realmente lida.",
      url: "https://jornal.example.com/politica/eleicoes"
    }),
    url: () => guidedNavigations.at(-1) || "https://www.google.com/"
  };
  const guidedResult = await guidedController.followGoogleGuidance("buscar sobre eleições de 2026 e escolher uma notícia");
  assert.equal(guidedResult.status, "ready");
  assert.equal(guidedController.browserMode, "google_guidance");
  assert.equal(guidedController.research.step, "research_ready");
  assert.deepEqual(guidedNavigations, ["https://jornal.example.com/politica/eleicoes"]);
  assert.equal(guidedResult.articles.length, 1);
  assert.equal(guidedStatuses.at(-1).message, "GOOGLE: 1 NOTÍCIA(S) LIDA(S)");

  const dispatchedTouchEvents = [];
  const pressedKeys = [];
  const fakeSession = {
    send: async (method, payload) => {
      dispatchedTouchEvents.push({ method, payload });
    },
    detach: async () => {}
  };
  controller.context = {
    newCDPSession: async () => fakeSession
  };
  controller.page = {
    viewportSize: () => ({ width: 430, height: 760 }),
    setExtraHTTPHeaders: async () => {},
    url: () => "https://www.instagram.com/reels/example/",
    keyboard: {
      press: async (key) => {
        pressedKeys.push(key);
      }
    }
  };

  assert.deepEqual(await controller.sendEmbeddedInput({ type: "swipe", direction: "up" }), { ok: true });
  assert.equal(dispatchedTouchEvents[0].payload.touchPoints[0].y > dispatchedTouchEvents.at(-2).payload.touchPoints[0].y, true);
  assert.equal(dispatchedTouchEvents.at(-1).payload.type, "touchEnd");
  assert.deepEqual(pressedKeys, ["ArrowDown"]);

  const reelDelayController = new controllerModule.InstagramController({ config });
  reelDelayController.page = {
    evaluate: async () => ({ duration: 7, currentTime: 1.2 })
  };
  assert.equal(await reelDelayController.getCurrentReelWatchDelayMs(), 6150);
  reelDelayController.page = {
    evaluate: async () => ({ duration: 40, currentTime: 0 })
  };
  assert.equal(await reelDelayController.getCurrentReelWatchDelayMs(), 10000);
  reelDelayController.startReelsAutoplay(1500);
  assert.equal(reelDelayController.reelsAutoplayActive, true);
  reelDelayController.stopReelsAutoplay({ silent: true });
  assert.equal(reelDelayController.reelsAutoplayActive, false);

  const audioController = new controllerModule.InstagramController({ config });
  const evaluatedPayloads = [];
  audioController.page = {
    evaluate: async (callback, payload) => {
      evaluatedPayloads.push(payload ?? "pause");
    }
  };
  audioController.updateStatus = () => {};
  assert.deepEqual(await audioController.setAudioMuted(false), {
    status: "ready",
    muted: false,
    message: "INSTAGRAM: audio ligado"
  });
  assert.equal(audioController.audioMuted, false);
  assert.deepEqual(evaluatedPayloads, [false]);
  audioController.startReelsAutoplay(2000);
  assert.equal(audioController.reelsAutoplayActive, true);
  assert.deepEqual(await audioController.stopAllRoutines(), {
    status: "stopped",
    message: "INSTAGRAM: rotinas paradas"
  });
  assert.equal(audioController.reelsAutoplayActive, false);
  assert.equal(audioController.commandInProgress, false);
  assert.equal(audioController.actionInProgress, false);

  const clickController = new controllerModule.InstagramController({ config });
  const tappedPoints = [];
  const mouseClicks = [];
  clickController.page = {
    viewportSize: () => ({ width: 430, height: 760 }),
    setExtraHTTPHeaders: async () => {},
    bringToFront: async () => {},
    touchscreen: {
      tap: async (x, y) => {
        tappedPoints.push({ x, y });
      }
    },
    mouse: {
      click: async (x, y) => {
        mouseClicks.push({ x, y });
      }
    }
  };
  assert.deepEqual(await clickController.sendEmbeddedInput({ type: "click", x: 0.5, y: 0.25 }), { ok: true });
  assert.deepEqual(tappedPoints, [{ x: 215, y: 190 }]);
  assert.deepEqual(mouseClicks, []);

  const fallbackFollowController = new controllerModule.InstagramController({ config });
  let openedMediaFor = null;
  let clickedFollow = false;
  let recoveredAfterFollow = null;
  const followStates = [
    { state: null, label: "", locator: null },
    {
      state: "follow",
      label: "Follow",
      locator: {
        click: async () => {
          clickedFollow = true;
        }
      }
    }
  ];
  fallbackFollowController.openProfile = async () => ({ status: "ready" });
  fallbackFollowController.waitForEmbeddedFrameReady = async () => true;
  fallbackFollowController.getFollowButtonState = async () => followStates.shift() || { state: "following", label: "Following", locator: null };
  fallbackFollowController.openLatestProfileMedia = async (username) => {
    openedMediaFor = username;
    return true;
  };
  fallbackFollowController.waitForFollowStateChange = async () => ({ state: "following", label: "Following", locator: null });
  fallbackFollowController.recoverProfileView = async (username) => {
    recoveredAfterFollow = username;
  };
  fallbackFollowController.theatricalDelay = async () => {};

  assert.deepEqual(await fallbackFollowController.follow("@cappavictor"), {
    status: "following",
    message: "INSTAGRAM: seguindo @cappavictor"
  });
  assert.equal(openedMediaFor, "cappavictor");
  assert.equal(clickedFollow, true);
  assert.equal(recoveredAfterFollow, "cappavictor");

  const busyController = new controllerModule.InstagramController({ config });
  busyController.actionInProgress = true;
  assert.deepEqual(await busyController.follow("@cappavictor"), {
    status: "busy",
    message: "INSTAGRAM: acao em andamento"
  });
  await assert.rejects(
    () => busyController.captureJpegFrame(),
    /INSTAGRAM_ACTION_IN_PROGRESS/
  );

  const fastFrameController = new controllerModule.InstagramController({ config });
  let setupCalled = false;
  fastFrameController.configurePage = async () => {
    setupCalled = true;
  };
  fastFrameController.applyAudioMuted = async () => {
    setupCalled = true;
  };
  fastFrameController.page = {
    viewportSize: () => ({ width: 430, height: 760 }),
    screenshot: async () => Buffer.from("frame"),
    url: () => "https://www.instagram.com/reels/"
  };
  assert.equal((await fastFrameController.captureFrame({ fast: true })).image.includes("ZnJhbWU="), true);
  assert.equal(setupCalled, false);

  const textFollowController = new controllerModule.InstagramController({ config });
  textFollowController.targetProfile = "cappavictor";
  textFollowController.page = createTextFollowPage();
  const textFollowState = await textFollowController.getFollowButtonState();
  assert.equal(textFollowState.state, "follow");
  assert.equal(textFollowState.label, "Seguir");
  assert.equal(await textFollowState.locator.isVisible(), true);

  const mediaOpenController = new controllerModule.InstagramController({ config });
  let mediaClicked = false;
  const mediaLink = createFakeLocator({
    visible: true,
    click: async () => {
      mediaClicked = true;
    }
  });
  mediaOpenController.page = createMediaOpenPage({ mediaLink });
  mediaOpenController.dismissKnownModals = async () => {};
  mediaOpenController.theatricalDelay = async () => {};
  assert.equal(await mediaOpenController.openLatestProfileMedia("cappavictor"), true);
  assert.equal(mediaClicked, true);

  const failedFollowController = new controllerModule.InstagramController({ config });
  let recoveredProfileFor = null;
  failedFollowController.openProfile = async () => ({ status: "ready" });
  failedFollowController.waitForEmbeddedFrameReady = async () => true;
  failedFollowController.getFollowButtonState = async () => ({ state: null, label: "", locator: null });
  failedFollowController.openLatestProfileMedia = async () => true;
  failedFollowController.saveDebugArtifact = async () => {};
  failedFollowController.recoverProfileView = async (username) => {
    recoveredProfileFor = username;
  };
  failedFollowController.theatricalDelay = async () => {};
  assert.deepEqual(await failedFollowController.follow("@cappavictor"), {
    status: "unconfirmed",
    message: "INSTAGRAM: nao foi possivel confirmar a acao"
  });
  assert.equal(recoveredProfileFor, "cappavictor");

  const commentController = new controllerModule.InstagramController({ config });
  let commentOpenedMediaFor = null;
  let commentClickedInput = false;
  let commentFilled = "";
  let commentTyped = "";
  let commentSubmitted = false;
  let openedComments = false;
  commentController.page = {
    keyboard: {
      press: async () => {},
      type: async (text) => {
        commentTyped += text;
      }
    }
  };
  commentController.openProfile = async () => ({ status: "ready" });
  commentController.waitForEmbeddedFrameReady = async () => true;
  commentController.openProfileMediaAt = async (username) => {
    commentOpenedMediaFor = username;
    return true;
  };
  commentController.openCommentsSurface = async () => {
    openedComments = true;
    return true;
  };
  commentController.findCommentInput = async () => ({
    click: async () => {
      commentClickedInput = true;
    },
    fill: async (text) => {
      commentFilled = text;
    }
  });
  commentController.submitComment = async () => {
    commentSubmitted = true;
  };
  commentController.theatricalDelay = async () => {};

  assert.deepEqual(await commentController.commentLatestMedia("@cappavictor", "biscoiteiro"), {
    status: "commented",
    message: "INSTAGRAM: comentario enviado para @cappavictor"
  });
  assert.equal(commentOpenedMediaFor, "cappavictor");
  assert.equal(openedComments, true);
  assert.equal(commentClickedInput, true);
  assert.equal(commentFilled, "");
  assert.equal(commentTyped, "biscoiteiro");
  assert.equal(commentSubmitted, true);

  const directController = new controllerModule.InstagramController({ config });
  let directOpenedInbox = false;
  let directOpenedLatest = false;
  let directTyped = "";
  let directSubmitted = false;
  directController.openDirectInbox = async () => {
    directOpenedInbox = true;
    return { status: "ready" };
  };
  directController.openLatestDirectThread = async () => {
    directOpenedLatest = true;
    return true;
  };
  directController.findDirectMessageInput = async () => ({});
  directController.typeCommentText = async (input, text) => {
    directTyped = text;
  };
  directController.submitDirectMessage = async () => {
    directSubmitted = true;
  };
  directController.theatricalDelay = async () => {};

  assert.deepEqual(await directController.sendDirectMessage({ message: "olá, mundo" }), {
    status: "sent",
    message: "INSTAGRAM: direct enviado"
  });
  assert.equal(directOpenedInbox, true);
  assert.equal(directOpenedLatest, true);
  assert.equal(directTyped, "olá, mundo");
  assert.equal(directSubmitted, true);

  const openDirectsController = new controllerModule.InstagramController({ config });
  let openDirectsLoaded = false;
  openDirectsController.openDirectInbox = async () => {
    openDirectsLoaded = true;
    return { status: "ready" };
  };
  openDirectsController.waitForEmbeddedFrameReady = async () => true;
  assert.deepEqual(await openDirectsController.openDirects(), {
    status: "ready",
    message: "INSTAGRAM: directs aberto no iframe"
  });
  assert.equal(openDirectsLoaded, true);

  const likeController = new controllerModule.InstagramController({ config });
  let openedLikeMedia = null;
  let clickedLike = false;
  const likeStates = [
    {
      state: "like",
      locator: {
        click: async () => {
          clickedLike = true;
        }
      }
    },
    { state: "liked", locator: null }
  ];
  likeController.openProfile = async () => ({ status: "ready" });
  likeController.waitForEmbeddedFrameReady = async () => true;
  likeController.openProfileMediaAt = async (username, index) => {
    openedLikeMedia = { username, index };
    return true;
  };
  likeController.getLikeButtonState = async () => likeStates.shift();
  likeController.theatricalDelay = async () => {};

  assert.deepEqual(await likeController.likeProfileMedia("@cappavictor", 3), {
    status: "liked",
    message: "INSTAGRAM: post curtido"
  });
  assert.deepEqual(openedLikeMedia, { username: "cappavictor", index: 3 });
  assert.equal(clickedLike, true);

  console.log("Instagram controller tests passed");
}

function createTextFollowPage() {
  const hiddenLocator = createFakeLocator({ visible: false });
  const textLocator = createFakeLocator({ visible: true });
  const contextLocator = createFakeLocator({
    visible: false,
    getByRole: () => hiddenLocator,
    getByText: (pattern) => pattern.test("Seguir") ? textLocator : hiddenLocator,
    locator: () => hiddenLocator
  });

  return {
    getByRole: () => contextLocator,
    getByText: (pattern) => pattern.test("Seguir") ? textLocator : hiddenLocator,
    locator: () => contextLocator
  };
}

function createLoginPage(values) {
  const body = createFakeLocator({
    visible: true,
    innerText: async () => "Log in"
  });
  const usernameInput = createFakeLocator({
    visible: true,
    fill: async (value) => {
      values.username = value;
    }
  });
  const passwordInput = createFakeLocator({
    visible: true,
    fill: async (value) => {
      values.password = value;
    }
  });
  const submit = createFakeLocator({
    visible: true,
    click: async () => {
      values.submitted = true;
    }
  });

  return {
    url: () => "https://www.instagram.com/accounts/login/",
    locator: (selector) => {
      if (selector === "body") return body;
      if (selector === "input[name='username']") return usernameInput;
      if (selector === "input[name='password']") return passwordInput;
      return submit;
    },
    getByRole: () => submit,
    waitForTimeout: async () => {}
  };
}

function createFakeLocator(overrides = {}) {
  const locator = {
    first: () => locator,
    filter: () => locator,
    locator: () => locator,
    getByRole: () => locator,
    getByText: () => locator,
    isVisible: async () => Boolean(overrides.visible),
    waitFor: async () => {
      if (!overrides.visible) {
        throw new Error("not visible");
      }
    },
    allTextContents: async () => overrides.textContents || [],
    ...overrides
  };
  return locator;
}

function createMediaOpenPage({ mediaLink }) {
  const hiddenLocator = createFakeLocator({
    visible: false,
    waitFor: async () => {
      throw new Error("not visible");
    }
  });

  const mediaLocator = {
    first: () => mediaLink,
    nth: () => mediaLink
  };

  return {
    url: () => "https://www.instagram.com/cappavictor/",
    locator: (selector) => selector.includes("a[href*=") ? mediaLocator : hiddenLocator,
    getByRole: () => hiddenLocator,
    waitForURL: async () => null,
    waitForTimeout: async () => {},
    evaluate: async () => {}
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
