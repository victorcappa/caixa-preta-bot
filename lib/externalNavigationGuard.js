const EXTERNAL_TARGET_PATTERN = /(?:https?:\/\/|instagram\.com|www\.instagram\.com|instagram:\/\/)/i;

export function containsExternalNavigationTarget(value) {
  if (typeof value === "string") return EXTERNAL_TARGET_PATTERN.test(value);
  if (Array.isArray(value)) return value.some(containsExternalNavigationTarget);
  if (value && typeof value === "object") return Object.values(value).some(containsExternalNavigationTarget);
  return false;
}

export function assertBotCannotNavigateExternal({ source = "system", target = "", action = "navigate" } = {}) {
  if (source !== "operator" && containsExternalNavigationTarget(target)) {
    const error = new Error("BOT_EXTERNAL_NAVIGATION_BLOCKED");
    error.code = "BOT_EXTERNAL_NAVIGATION_BLOCKED";
    error.action = action;
    throw error;
  }
  return true;
}

export function blockedAutonomousInstagramResult() {
  return {
    ok: false,
    code: "BOT_EXTERNAL_NAVIGATION_BLOCKED",
    message: "Navegação externa automática bloqueada; somente uma ação explícita do operador pode abrir o Instagram."
  };
}
