const assert = require("node:assert/strict");

async function main() {
  const controllerModule = await import("../lib/instagram/InstagramController.js");
  const commands = await import("../lib/instagram/commands.js");

  assert.equal(controllerModule.normalizeUsername("@cappavictor"), "cappavictor");
  assert.equal(controllerModule.normalizeUsername(" cappavictor "), "cappavictor");
  assert.equal(controllerModule.normalizeUsername("https://instagram.com/cappavictor"), "");

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
