import { normalizeUsername } from "./InstagramController.js";

const QUOTED_TEXT_PATTERN = /["'“”‘’]([^"'“”‘’]+)["'“”‘’]/;

export function parseInstagramCommand(content = "") {
  const trimmed = content.trim();
  const [action = "", rawUsername = "", ...extra] = trimmed.split(/\s+/).filter(Boolean);
  const normalizedAction = action.toLowerCase();
  const username = normalizeUsername(rawUsername);

  if (normalizedAction === "follow" && username && !extra.length) {
    return {
      valid: true,
      action: "follow",
      username,
      error: null
    };
  }

  const naturalCommand = parseNaturalInstagramCommand(trimmed);
  if (naturalCommand.valid) {
    return naturalCommand;
  }

  return {
    valid: false,
    action: normalizedAction,
    username,
    error: "INSTAGRAM COMMAND UNKNOWN"
  };
}

function parseNaturalInstagramCommand(content) {
  const username = extractUsername(content);

  if (!username) {
    return {
      valid: false,
      action: "",
      username: "",
      error: "INSTAGRAM COMMAND UNKNOWN"
    };
  }

  const comment = extractComment(content);
  if (comment) {
    return {
      valid: true,
      action: "comment_latest",
      username,
      comment,
      error: null
    };
  }

  if (/\b(entrar|abrir|open|perfil|profile)\b/i.test(content)) {
    return {
      valid: true,
      action: "open_profile",
      username,
      error: null
    };
  }

  return {
    valid: false,
    action: "",
    username,
    error: "INSTAGRAM COMMAND UNKNOWN"
  };
}

function extractUsername(content) {
  const explicitHandle = content.match(/@([a-zA-Z0-9._]{1,30})/);
  if (explicitHandle) {
    return normalizeUsername(explicitHandle[1]);
  }

  const afterProfile = content.match(/\b(?:perfil|profile|conta|account)\s+([a-zA-Z0-9._]{1,30})\b/i);
  if (afterProfile) {
    return normalizeUsername(afterProfile[1]);
  }

  return "";
}

function extractComment(content) {
  if (!/\b(comentar|comment|comentario|comentário)\b/i.test(content)) {
    return "";
  }

  const quoted = content.match(QUOTED_TEXT_PATTERN);
  if (quoted?.[1]) {
    return normalizeComment(quoted[1]);
  }

  const afterComment = content.match(/\b(?:comentar|comment|comentario|comentário)\b(?:\s+(?:na|no|em|a|o|ultima|última|ultimo|último|foto|post|reel))*\s+(.+)$/i);
  return normalizeComment(afterComment?.[1] || "");
}

function normalizeComment(comment) {
  return `${comment}`.trim().replace(/\s+/g, " ").slice(0, 220);
}
