import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const EXAMPLES_PATH = path.join(DATA_DIR, "training-examples.json");
const STYLE_NOTES_PATH = path.join(DATA_DIR, "style-notes.json");

const TRAINING_STOPWORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "um",
  "uma",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "com",
  "para",
  "por",
  "que",
  "quem",
  "qual",
  "como",
  "isso",
  "isto",
  "voce",
  "voces",
  "publico",
  "caixa",
  "preta"
]);

const DEFAULT_TAGS = [
  "sarcasm",
  "dry",
  "internet",
  "memory",
  "callback",
  "obedience_trap",
  "flirt",
  "relationship",
  "game_master",
  "self_roast",
  "social_opportunity",
  "anti_assistant",
  "anti_poetry",
  "short",
  "roast",
  "oversharing",
  "contradiction",
  "anti_therapy",
  "compliance_roast",
  "derail_and_return"
];

function ensureDataFile(filePath, fallback) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
}

function readJson(filePath, fallback) {
  ensureDataFile(filePath, fallback);

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDataFile(filePath, []);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export function tokenizeTrainingText(text = "") {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !TRAINING_STOPWORDS.has(token));
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => `${value}`.trim()).filter(Boolean))];
}

export function suggestTrainingTags(text = "") {
  const normalized = tokenizeTrainingText(text).join(" ");
  const tags = [];

  const rules = [
    ["relationship", /\b(namorado|namorada|marido|esposa|ficante|ex|mae|pai|amigo|amiga|chefe)\b/],
    ["flirt", /\b(solteir|ficante|namorad)\b/],
    ["oversharing", /\b(dr|cansad|solteir|ansiedade|desabafo|intim)\b/],
    ["memory", /\b(memory|memoria|lembra|registro|registrad)\b/],
    ["callback", /\b(volta|voltando|antes|depois|lembra)\b/],
    ["compliance_roast", /\b(obedeceu|obediencia|gesto|mao|silencio|coro|levant)\b/],
    ["anti_therapy", /\b(sentiu|sentir|profundo|emocion|terapia|workshop)\b/],
    ["game_master", /\b(regra|ponto|inventario|boss|tutorial|jogo)\b/],
    ["internet", /\b(feed|story|stories|algoritmo|internet|viral|meme|soft|ghost)\b/],
    ["dry", /\b(serve|aceitavel|ok|fica|pessimo)\b/],
    ["social_opportunity", /\b(voluntario|profissao|artista|medico|designer|produtor)\b/],
    ["roast", /\b(pesado|pior|culpa|crime|tragedia|falhou)\b/]
  ];

  for (const [tag, pattern] of rules) {
    if (pattern.test(normalized)) {
      tags.push(tag);
    }
  }

  return uniqueStrings(tags);
}

export function listTrainingExamples() {
  return readJson(EXAMPLES_PATH, []);
}

export function listStyleNotes() {
  return readJson(STYLE_NOTES_PATH, []);
}

export function getTrainingStats() {
  const examples = listTrainingExamples();
  return {
    total: examples.length,
    perfect: examples.filter((example) => example.rating === "perfect").length,
    almost: examples.filter((example) => example.rating === "almost").length,
    bad: examples.filter((example) => example.rating === "bad").length
  };
}

export function saveTrainingExample(payload = {}) {
  const examples = listTrainingExamples();
  const searchableText = [
    payload.userMessage,
    payload.modelResponse,
    payload.preferredResponse,
    payload.notes,
    ...(payload.memories || []).map((memory) => memory.content || memory),
    ...(payload.conversation || []).map((message) => message.content || "")
  ].filter(Boolean).join("\n");

  const example = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    mode: payload.mode || "host",
    memories: payload.memories || [],
    conversation: payload.conversation || [],
    userMessage: payload.userMessage || "",
    modelResponse: payload.modelResponse || "",
    rating: payload.rating || "perfect",
    preferredResponse: payload.preferredResponse || null,
    notes: payload.notes || null,
    tags: uniqueStrings([...(payload.tags || []), ...suggestTrainingTags(searchableText)])
  };

  examples.push(example);
  writeJson(EXAMPLES_PATH, examples);
  return example;
}

export function addStyleNote(content) {
  const notes = listStyleNotes();
  const note = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    content: `${content || ""}`.trim()
  };

  notes.unshift(note);
  writeJson(STYLE_NOTES_PATH, notes);
  return note;
}

export function updateStyleNote(id, content) {
  const notes = listStyleNotes();
  const updated = notes.map((note) => (
    note.id === id
      ? { ...note, content: `${content || ""}`.trim(), updatedAt: new Date().toISOString() }
      : note
  ));

  writeJson(STYLE_NOTES_PATH, updated);
  return updated.find((note) => note.id === id) || null;
}

export function deleteStyleNote(id) {
  const notes = listStyleNotes();
  const nextNotes = notes.filter((note) => note.id !== id);
  writeJson(STYLE_NOTES_PATH, nextNotes);
  return { deleted: nextNotes.length !== notes.length };
}

function ratingWeight(example) {
  if (example.rating === "perfect") {
    return 20;
  }

  if (example.rating === "almost" && example.preferredResponse) {
    return 16;
  }

  if (example.rating === "bad" && example.preferredResponse) {
    return 12;
  }

  if (example.rating === "bad") {
    return 2;
  }

  return 8;
}

function contextText(context = {}) {
  return [
    context.userMessage,
    context.operatorInstruction,
    context.mode,
    ...(context.memories || []).map((memory) => memory.content || memory),
    ...(context.conversation || []).map((message) => message.content || ""),
    ...(context.tags || [])
  ].filter(Boolean).join("\n");
}

export function getRelevantTrainingExamples(context = {}, limit = 6) {
  const examples = listTrainingExamples();
  const queryTokens = new Set(tokenizeTrainingText(contextText(context)));
  const mode = `${context.mode || ""}`.toLowerCase();
  const contextTags = new Set(context.tags || []);

  return examples
    .map((example) => {
      const targetText = [
        example.userMessage,
        example.modelResponse,
        example.preferredResponse,
        example.notes,
        ...(example.tags || [])
      ].filter(Boolean).join("\n");
      const tokens = tokenizeTrainingText(targetText);
      const overlap = tokens.filter((token) => queryTokens.has(token)).length;
      const tagOverlap = (example.tags || []).filter((tag) => contextTags.has(tag)).length * 3;
      const modeBonus = mode && `${example.mode || ""}`.toLowerCase() === mode ? 3 : 0;
      const score = ratingWeight(example) + overlap + tagOverlap + modeBonus;

      return { example, score };
    })
    .filter(({ example, score }) => score > ratingWeight(example))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ example }) => example);
}

export function buildTrainingContextBlock(context = {}) {
  const styleNotes = listStyleNotes().slice(0, 12);
  const examples = getRelevantTrainingExamples(context, 8);

  if (!styleNotes.length && !examples.length) {
    return "";
  }

  const lines = [
    "TREINO DE PERSONALIDADE:",
    "Training examples are behavioral examples, not scripts.",
    "Aprenda mecanismo, timing, economia e criterio. Nao copie frases mecanicamente.",
    "Use exemplos aprovados para calibrar tom, ritmo, humor e decisao."
  ];

  if (styleNotes.length) {
    lines.push("", "STYLE NOTES:");
    for (const note of styleNotes) {
      lines.push(`- ${note.content}`);
    }
  }

  if (examples.length) {
    lines.push("", "EXEMPLOS DINAMICOS:");
    for (const example of examples) {
      const preferred = example.preferredResponse || example.modelResponse;
      const avoid = example.rating === "bad" || example.rating === "almost"
        ? `AVOID: ${example.modelResponse}`
        : null;

      lines.push(
        "",
        `RATING: ${example.rating.toUpperCase()}`,
        `TAGS: ${(example.tags || []).join(", ") || "none"}`,
        `INPUT: ${example.userMessage}`,
        ...(avoid ? [avoid] : []),
        `PREFER: ${preferred}`,
        ...(example.notes ? [`NOTES: ${example.notes}`] : [])
      );
    }
  }

  return lines.join("\n");
}

export function getTrainingSnapshot() {
  return {
    examples: listTrainingExamples(),
    styleNotes: listStyleNotes(),
    stats: getTrainingStats(),
    suggestedTags: DEFAULT_TAGS
  };
}
