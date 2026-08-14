import { normalizeUsername } from "./InstagramController.js";

export function parseInstagramCommand(content = "") {
  const [action = "", rawUsername = "", ...extra] = content.split(/\s+/).filter(Boolean);
  const normalizedAction = action.toLowerCase();
  const username = normalizeUsername(rawUsername);

  if (normalizedAction !== "follow" || !username || extra.length) {
    return {
      valid: false,
      action: normalizedAction,
      username,
      error: "INSTAGRAM COMMAND UNKNOWN"
    };
  }

  return {
    valid: true,
    action: "follow",
    username,
    error: null
  };
}
