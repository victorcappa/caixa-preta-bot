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

  const fallbackFollowController = new controllerModule.InstagramController({ config });
  let openedMediaFor = null;
  let clickedFollow = false;
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
  fallbackFollowController.getFollowButtonState = async () => followStates.shift() || { state: "following", label: "Following", locator: null };
  fallbackFollowController.openLatestProfileMedia = async (username) => {
    openedMediaFor = username;
    return true;
  };
  fallbackFollowController.waitForFollowStateChange = async () => ({ state: "following", label: "Following", locator: null });
  fallbackFollowController.theatricalDelay = async () => {};

  assert.deepEqual(await fallbackFollowController.follow("@cappavictor"), {
    status: "following",
    message: "INSTAGRAM: seguindo @cappavictor"
  });
  assert.equal(openedMediaFor, "cappavictor");
  assert.equal(clickedFollow, true);

  const textFollowController = new controllerModule.InstagramController({ config });
  textFollowController.targetProfile = "cappavictor";
  textFollowController.page = createTextFollowPage();
  const textFollowState = await textFollowController.getFollowButtonState();
  assert.equal(textFollowState.state, "follow");
  assert.equal(textFollowState.label, "Seguir");
  assert.equal(await textFollowState.locator.isVisible(), true);

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
    allTextContents: async () => overrides.textContents || [],
    ...overrides
  };
  return locator;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
