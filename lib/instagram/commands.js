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

export async function interpretInstagramCommand(content = "") {
  const fallback = parseInstagramCommand(content);

  try {
    const { interpretInstagramOperatorRequest } = await import("../openai.js");
    const interpreted = await interpretInstagramOperatorRequest(content);
    return normalizeInterpretedCommand(interpreted, fallback);
  } catch (error) {
    console.error("INSTAGRAM COMMAND INTERPRETATION FALLBACK", error.message || error);
    return fallback;
  }
}

function normalizeInterpretedCommand(interpreted = {}, fallback) {
  const action = `${interpreted.action || ""}`.trim().toLowerCase();
  const username = normalizeUsername(interpreted.username || "");
  const comment = normalizeComment(interpreted.comment || "");
  const question = normalizeQuestion(interpreted.question || interpreted.prompt || "");
  const allowedActions = new Set([
    "follow",
    "open_profile",
    "comment_latest",
    "follow_and_comment_latest",
    "analyze_current",
    "analyze_profile",
    "analyze_latest_media"
  ]);

  if (!allowedActions.has(action)) {
    return fallback;
  }

  if (action !== "analyze_current" && !username) {
    return fallback;
  }

  if ((action === "comment_latest" || action === "follow_and_comment_latest") && !comment) {
    return fallback.valid ? fallback : {
      valid: false,
      action,
      username,
      error: "INSTAGRAM COMMENT EMPTY"
    };
  }

  return {
    valid: true,
    action,
    username,
    ...(comment ? { comment } : {}),
    ...(question ? { question } : {}),
    error: null,
    interpretedBy: "openai"
  };
}

function parseNaturalInstagramCommand(content) {
  const username = extractUsername(content);
  const wantsAnalysis = /\b(analisar|analise|análise|analyze|ler|veja|ver)\b/i.test(content);

  if (wantsAnalysis && !username) {
    return {
      valid: true,
      action: "analyze_current",
      username: "",
      question: extractAnalysisQuestion(content),
      error: null
    };
  }

  if (!username) {
    return {
      valid: false,
      action: "",
      username: "",
      error: "INSTAGRAM COMMAND UNKNOWN"
    };
  }

  const comment = extractComment(content);
  const wantsFollow = /\b(seguir|siga|follow)\b/i.test(content);
  if (wantsAnalysis) {
    return {
      valid: true,
      action: /\b(ultima|última|ultimo|último|foto|post|reel|midia|mídia)\b/i.test(content) ? "analyze_latest_media" : "analyze_profile",
      username,
      question: extractAnalysisQuestion(content),
      error: null
    };
  }

  if (comment) {
    return {
      valid: true,
      action: wantsFollow ? "follow_and_comment_latest" : "comment_latest",
      username,
      comment,
      error: null
    };
  }

  if (wantsFollow) {
    return {
      valid: true,
      action: "follow",
      username,
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

  const afterProfile = content.match(/\b(?:perfil|profile|conta|account)(?:\s+d[oa])?\s+([a-zA-Z0-9._]{1,30})\b/i);
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
  const normalized = `${comment}`.trim().replace(/\s+/g, " ").slice(0, 220);

  if (/^algo\s+engracado$/i.test(normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
    return "biscoiteiro profissional em horario comercial";
  }

  return normalized;
}

function extractAnalysisQuestion(content) {
  return normalizeQuestion(
    content
      .replace(/^anali[sz]ar?\b/i, "")
      .replace(/\b(?:perfil|profile|conta|account)(?:\s+d[oa])?\s+[a-zA-Z0-9._]{1,30}\b/i, "")
      .replace(/@([a-zA-Z0-9._]{1,30})/g, "")
  );
}

function normalizeQuestion(question) {
  return `${question}`.trim().replace(/\s+/g, " ").slice(0, 220);
}
