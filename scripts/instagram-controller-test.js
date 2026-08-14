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
    INSTAGRAM_DEBUG: "true",
    INSTAGRAM_THEATRICAL_DELAY: "2000",
    INSTAGRAM_ALLOWED_PROFILES: "cappavictor"
  });

  assert.equal(config.enabled, true);
  assert.equal(config.debug, true);
  assert.equal(config.theatricalDelayMs, 1500);
  assert.deepEqual(config.allowedProfiles, ["cappavictor"]);
  assert(config.profileDir.endsWith(".runtime/instagram-profile"));
  assert(config.debugDir.endsWith(".runtime/instagram-debug"));

  const controller = new controllerModule.InstagramController({ config });
  assert.equal(controller.assertAllowedUsername("@cappavictor"), "cappavictor");
  assert.throws(
    () => controller.assertAllowedUsername("outra_conta"),
    /INSTAGRAM_PROFILE_NOT_ALLOWED:outra_conta/
  );

  console.log("Instagram controller tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
