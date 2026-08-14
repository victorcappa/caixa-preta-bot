import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hostGameMechanics } from "./host/games.js";

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
  "derail_and_return",
  "counter_roast",
  "game",
  "hangman",
  "whoami",
  "drawing",
  "teams",
  "cards",
  "puzzle",
  "competition",
  "arbitrary_rule",
  "trickster",
  "game_mechanic",
  "phone",
  "privacy",
  "instagram",
  "screen_time",
  "algorithm",
  "projection",
  "provocation",
  "consent",
  "phone_roast",
  "digital_forensics",
  "gen_z",
  "slang",
  "cringe",
  "fanfic",
  "rizz",
  "delulu",
  "flop",
  "tea",
  "main_character",
  "valid"
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
    ["counter_roast", /\b(inutil|burra|burr[ao]|menos importante|voce nao sabe|voce falhou|caixa ruim|ridicula|ridiculo)\b/],
    ["game", /\b(game|jogo|regra|ponto|placar|forca|maria antonieta|quem sou eu|lacuna|quiz|desenho|time|times)\b/],
    ["game_mechanic", /\b(regra|ponto|inventario|boss|tutorial|jogo|lacuna|voto|enigma|captcha|ranking)\b/],
    ["hangman", /\b(forca|letra|palavra secreta)\b/],
    ["whoami", /\b(maria antonieta|quem sou eu|sim ou nao|sim\/nao)\b/],
    ["drawing", /\b(desenho|desenhe|canvas|pictionary)\b/],
    ["teams", /\b(time|times|equipe a|equipe b|batalha)\b/],
    ["cards", /\b(lacuna|complete a frase|respostas erradas)\b/],
    ["puzzle", /\b(puzzle|enigma|escape|codigo secreto)\b/],
    ["competition", /\b(compet|contra|ganhou|perdeu|placar|ponto)\b/],
    ["arbitrary_rule", /\b(arbitrari|injusto|roubando|eram tres|antes de voce perguntar)\b/],
    ["trickster", /\b(roubando|entendeu as regras|eu faco a contabilidade)\b/],
    ["phone", /\b(celular|telefone|smartphone|screen time|tempo de tela|instagram|whatsapp|emoji|busca|abas|notificacoes)\b/],
    ["privacy", /\b(privacidade|senha|pin|banco|documento|endereco|dm|conversa privada|sensivel|esconder|hide)\b/],
    ["instagram", /\b(instagram|bio|reels?|story|stories|close friends|seguidores|following)\b/],
    ["screen_time", /\b(screen time|tempo de tela|horas de tela)\b/],
    ["algorithm", /\b(algoritmo|feed|fyp|reels?|sugestao|autocomplete)\b/],
    ["projection", /\b(projeta|projecao|mostrar na tela|tela de tres metros)\b/],
    ["provocation", /\b(me da|abre|mostra|entrega|prova|evidencia)\b/],
    ["consent", /\b(nao quero|recuso|recusou|aceitou|voluntario|limite)\b/],
    ["phone_roast", /\b(celular|telefone|tela|doomscroll|notificacao|abas|horas)\b/],
    ["digital_forensics", /\b(pericia|forense|evidencia|historico|busca|dados)\b/],
    ["gen_z", /\b(cringe|rizz|delulu|fanfic|flop|flopou|ghost|ghosting|ghostar|main character|mood|valid|slay|tea|cha|exposed|pov|trend|vibes|sem condicoes|big yikes|shook|ded|lacrou|entregou tudo)\b/],
    ["slang", /\b(cringe|rizz|delulu|fanfic|flop|flopou|main character|mood|valid|slay|tea|cha|pov|trend|vibes)\b/],
    ["cringe", /\b(cringe|vergonha alheia|big yikes|sem condicoes)\b/],
    ["fanfic", /\b(fanfic|delulu|iludid|story antigo|curtiu meu story)\b/],
    ["rizz", /\b(rizz|charme|flerte|cantada|crush)\b/],
    ["delulu", /\b(delulu|iludid|sinal|story antigo)\b/],
    ["flop", /\b(flop|flopou|ninguem respondeu|deu ruim|nao engajou)\b/],
    ["tea", /\b(tea|cha|fofoca|exposed|treta)\b/],
    ["main_character", /\b(main character|protagonista|selfie|look|estetica)\b/],
    ["valid", /\b(valid|aceitavel|faz sentido)\b/],
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
    gameMechanic: payload.gameMechanic || null,
    gameId: payload.gameId || payload.gameMechanic || null,
    gamePhase: payload.gamePhase || null,
    gameMove: payload.gameMove || null,
    personalityMove: payload.personalityMove || null,
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
        example.gameMechanic,
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
        ...(example.gameMechanic ? [`GAME_MECHANIC: ${example.gameMechanic}`] : []),
        ...(example.gameId ? [`GAME_ID: ${example.gameId}`] : []),
        ...(example.gamePhase ? [`GAME_PHASE: ${example.gamePhase}`] : []),
        ...(example.gameMove ? [`GAME_MOVE: ${example.gameMove}`] : []),
        ...(example.personalityMove ? [`PERSONALITY_MOVE: ${example.personalityMove}`] : []),
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
    suggestedTags: DEFAULT_TAGS,
    suggestedGameMechanics: hostGameMechanics.map((mechanic) => mechanic.id)
  };
}
