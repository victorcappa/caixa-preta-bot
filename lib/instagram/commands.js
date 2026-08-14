import { normalizeUsername } from "./InstagramController.js";

const QUOTED_TEXT_PATTERN = /["'“”‘’]([^"'“”‘’]+)["'“”‘’]/;
const ORDINAL_WORDS = new Map([
  ["primeiro", 1],
  ["primeira", 1],
  ["segundo", 2],
  ["segunda", 2],
  ["terceiro", 3],
  ["terceira", 3],
  ["quarto", 4],
  ["quarta", 4],
  ["quinto", 5],
  ["quinta", 5]
]);

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
  const message = normalizeMessage(interpreted.message || interpreted.text || "");
  const question = normalizeQuestion(interpreted.question || interpreted.prompt || "");
  const thread = normalizeThread(interpreted.thread || interpreted.group || interpreted.chat || "");
  const postIndex = normalizePostIndex(interpreted.postIndex || interpreted.index || interpreted.position);
  const allowedActions = new Set([
    "follow",
    "open_profile",
    "open_latest_media",
    "open_nth_media",
    "comment_latest",
    "comment_nth_media",
    "follow_and_comment_latest",
    "watch_reels",
    "open_directs",
    "send_direct_latest",
    "send_direct_thread",
    "like_latest_media",
    "like_nth_media",
    "analyze_current",
    "analyze_profile",
    "analyze_recent_posts",
    "analyze_latest_media"
  ]);

  if (!allowedActions.has(action)) {
    return fallback;
  }

  const actionsWithoutUsername = new Set(["analyze_current", "watch_reels", "open_directs", "send_direct_latest", "send_direct_thread"]);
  if (!actionsWithoutUsername.has(action) && !username) {
    return fallback;
  }

  if ((action === "comment_latest" || action === "comment_nth_media" || action === "follow_and_comment_latest") && !comment) {
    return fallback.valid ? fallback : {
      valid: false,
      action,
      username,
      error: "INSTAGRAM COMMENT EMPTY"
    };
  }

  if ((action === "send_direct_latest" || action === "send_direct_thread") && !message) {
    return fallback.valid ? fallback : {
      valid: false,
      action,
      username: "",
      error: "INSTAGRAM DIRECT MESSAGE EMPTY"
    };
  }

  if (action === "send_direct_thread" && !thread) {
    return fallback;
  }

  if ((action === "like_nth_media" || action === "open_nth_media" || action === "comment_nth_media") && !postIndex) {
    return fallback;
  }

  return {
    valid: true,
    action,
    username,
    ...(comment ? { comment } : {}),
    ...(message ? { message } : {}),
    ...(question ? { question } : {}),
    ...(thread ? { thread } : {}),
    ...(postIndex ? { postIndex } : {}),
    error: null,
    interpretedBy: "openai"
  };
}

function parseNaturalInstagramCommand(content) {
  const username = extractUsername(content);
  const directMessage = extractDirectMessage(content);
  if (directMessage) {
    const thread = extractDirectThread(content);
    return {
      valid: true,
      action: thread ? "send_direct_thread" : "send_direct_latest",
      username: "",
      message: directMessage,
      ...(thread ? { thread } : {}),
      error: null
    };
  }

  if (wantsOpenDirects(content)) {
    return {
      valid: true,
      action: "open_directs",
      username: "",
      error: null
    };
  }

  const wantsReels = wantsWatchReels(content);
  if (wantsReels) {
    return {
      valid: true,
      action: "watch_reels",
      username: "",
      error: null
    };
  }

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
  const wantsLike = wantsLikeMedia(content);
  const postIndex = extractPostIndex(content);
  if (wantsAnalysis) {
    return {
      valid: true,
      action: analysisActionFromContent(content),
      username,
      question: extractAnalysisQuestion(content),
      error: null
    };
  }

  if (comment) {
    return {
      valid: true,
      action: wantsFollow ? "follow_and_comment_latest" : postIndex > 1 ? "comment_nth_media" : "comment_latest",
      username,
      comment,
      ...(postIndex > 1 ? { postIndex } : {}),
      error: null
    };
  }

  if (wantsLike) {
    return {
      valid: true,
      action: postIndex > 1 ? "like_nth_media" : "like_latest_media",
      username,
      ...(postIndex > 1 ? { postIndex } : {}),
      error: null
    };
  }

  if (wantsOpenMedia(content)) {
    return {
      valid: true,
      action: postIndex > 1 ? "open_nth_media" : "open_latest_media",
      username,
      ...(postIndex > 1 ? { postIndex } : {}),
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

  const afterProfile = content.match(/\b(?:perfil|profile|conta|account)(?:\s+d(?:e|o|a))?\s+([a-zA-Z0-9._]{1,30})\b/i);
  if (afterProfile) {
    return normalizeUsername(afterProfile[1]);
  }

  return "";
}

function extractComment(content) {
  if (!/\b(comentar|comment|comentario|comentário)\b/i.test(content)) {
    return "";
  }

  const afterColon = content.match(/:\s*(.+)$/);
  if (afterColon?.[1]) {
    return normalizeComment(afterColon[1]);
  }

  const quoted = content.match(QUOTED_TEXT_PATTERN);
  if (quoted?.[1]) {
    return normalizeComment(quoted[1]);
  }

  const afterComment = content.match(/\b(?:comentar|comment|comentario|comentário)\b(?:\s+(?:na|no|em|a|o|ultima|última|ultimo|último|foto|post|reel))*\s+(.+)$/i);
  return normalizeComment(afterComment?.[1] || "");
}

function extractDirectMessage(content) {
  if (!/\b(directs?|dm|inbox|mensagens?|messages?|chat|grupo|group|conversa)\b/i.test(content)) {
    return "";
  }

  const afterColon = content.match(/:\s*(.+)$/);
  if (afterColon?.[1]) {
    return normalizeMessage(afterColon[1]);
  }

  const quoted = content.match(QUOTED_TEXT_PATTERN);
  if (quoted?.[1]) {
    return normalizeMessage(quoted[1]);
  }

  const afterVerb = content.match(/\b(?:escrever|enviar|mandar|digitar|write|send)\b(?:\s+(?:uma|um|a|o|mensagem|message|direct|dm|para|pro|pra|no|na|ao|a|grupo|group|chat|conversa|com))*\s+(.+)$/i);
  return normalizeMessage(afterVerb?.[1] || "");
}

function extractDirectThread(content) {
  const afterGroup = content.match(/\b(?:grupo|group|chat|conversa)(?:\s+(?:com|da|do|de))\s+(.+?)(?=\s*:|\s+e\s+(?:escrever|enviar|mandar)\b|\s+(?:escrever|enviar|mandar)\b|$)/i);
  return normalizeThread(afterGroup?.[1] || "");
}

function normalizeComment(comment) {
  const normalized = `${comment}`.trim().replace(/\s+/g, " ").slice(0, 220);

  if (/^algo\s+engracado$/i.test(normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
    return "biscoiteiro profissional em horario comercial";
  }

  return normalized;
}

function normalizeMessage(message) {
  return `${message}`.trim().replace(/\s+/g, " ").slice(0, 1000);
}

function normalizeThread(thread) {
  return `${thread}`.trim().replace(/\s+/g, " ").replace(/[,:;]+$/g, "").slice(0, 160);
}

function extractAnalysisQuestion(content) {
  return normalizeQuestion(
    content
      .replace(/^anali[sz]ar?\b/i, "")
      .replace(/\b(?:entrar|abrir|open)\s+(?:no|na|em)?\s*/i, "")
      .replace(/\b(?:perfil|profile|conta|account)(?:\s+d(?:e|o|a))?\s+[a-zA-Z0-9._]{1,30}\b/i, "")
      .replace(/\be\s+anali[sz]ar?\b/i, "")
      .replace(/@([a-zA-Z0-9._]{1,30})/g, "")
  );
}

function normalizeQuestion(question) {
  return `${question}`.trim().replace(/\s+/g, " ").slice(0, 220);
}

function analysisActionFromContent(content) {
  const normalized = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const wantsMultipleRecentPosts = (
    /\b(ultimos|ultimas|recentes|tres|3)\b/.test(normalized) &&
    /\b(posts?|fotos?|reels?|midias?)\b/.test(normalized)
  );

  if (wantsMultipleRecentPosts) {
    return "analyze_recent_posts";
  }

  if (/\b(ultima|ultimo|foto|post|reel|midia)\b/.test(normalized)) {
    return "analyze_latest_media";
  }

  return "analyze_profile";
}

function wantsLikeMedia(content) {
  const normalized = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return (
    /\b(curtir|like|dar\s+like)\b/.test(normalized) &&
    /\b(post|foto|reel|midia|publicacao)\b/.test(normalized)
  );
}

function wantsOpenMedia(content) {
  const normalized = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return (
    /\b(olhar|ver|abrir|entrar|open)\b/.test(normalized) &&
    /\b(ultimo|ultima|primeiro|primeira|segundo|segunda|terceiro|terceira|\d+o?|\d+a?|post|foto|reel|midia|publicacao)\b/.test(normalized) &&
    /\b(post|foto|reel|midia|publicacao)\b/.test(normalized) &&
    !/\b(analisar|analise|analyze|ler|curtir|like|comentar|comment)\b/.test(normalized)
  );
}

function extractPostIndex(content) {
  const normalized = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const numeric = normalized.match(/\b(\d+)(?:o|a|º|ª)?\s+(?:post|foto|reel|midia|publicacao)\b/);
  if (numeric) {
    return Math.min(12, Math.max(1, Number(numeric[1]) || 1));
  }

  for (const [word, index] of ORDINAL_WORDS.entries()) {
    if (new RegExp(`\\b${word}\\s+(?:post|foto|reel|midia|publicacao)\\b`).test(normalized)) {
      return index;
    }
  }

  return 1;
}

function normalizePostIndex(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(12, Math.max(1, Math.round(parsed)));
}

function wantsWatchReels(content) {
  const normalized = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return (
    /\b(assistir|ver|abrir|entrar|watch|open)\b/.test(normalized) &&
    /\breels?\b/.test(normalized) &&
    !/\b(analisar|analise|analyze|ler)\b/.test(normalized)
  );
}

function wantsOpenDirects(content) {
  const normalized = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return (
    /\b(abrir|entrar|ver|olhar|open|go)\b/.test(normalized) &&
    /\b(directs?|dms?|inbox|mensagens?)\b/.test(normalized) &&
    !/\b(escrever|enviar|mandar|digitar|write|send)\b/.test(normalized)
  );
}
