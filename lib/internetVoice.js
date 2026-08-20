import fs from "fs";
import path from "path";

const DEFAULT_GUIDE_PATH = path.join(process.cwd(), "data", "caixa_preta_internet_ptbr_voice.json");
const RECENT_ASSISTANT_LIMIT = 10;
const MARKED_EXPRESSION_COOLDOWN_TURNS = 6;

const MARKED_EXPRESSIONS = [
  "farmar aura",
  "aura",
  "rizz",
  "delulu",
  "gag",
  "jurou",
  "skill issue",
  "lore",
  "de base",
  "de arrasta",
  "main character",
  "mano",
  "mds",
  "literalmente"
];

const PROFANITY_PATTERN = /\b(?:caralho|porra|foda|fudeu|fudendo|fudido|pqp)\b/giu;
const LAUGHTER_PATTERN = /\bk{2,}\b/giu;
const QUESTION_PATTERN = /\?/g;

const SIGNAL_PATTERNS = {
  news: /\b(?:noticias?|noticiario|manchetes?|jornal|reportagens?|materias?|fontes?|trechos? lidos?|politica atual)\b/i,
  quiet: /\b(?:silencio|ninguem|nao respondeu|sem resposta|quiet[oa]s?)\b/i,
  obedient: /\b(?:obedece|obedeceu|obedeceram|sem hesitar|imediatamente|levantou|levantaram|mao subiu|todos fizeram|maioria fez)\b/i,
  singleResponse: /\b(?:uma pessoa|so uma|apenas uma|uma palma|sozinh[oa])\b/i,
  resistant: /\b(?:recusou|recusaram|resistiu|resistiram|nao quis|nao fizeram)\b/i,
  correct: /\b(?:acertou|resposta correta|ganhou|venceu)\b/i,
  wrong: /\b(?:errou|resposta errada|incorreta|perdeu)\b/i,
  game: /\bjogo\b/i,
  operator: /\b(?:operador|\/game|mudou de jogo|trocou de jogo|selecionou.*jogo)\b/i,
  dataCollection: /\b(?:admitiu|informacao|dado|pesquisa|quem veio|quem gastou|quanto ganha|transporte|metro|cptm|almoco|celular|fuma)\b/i,
  saoPaulo: /\b(?:sao paulo|paulistan|metro|cptm|baldeacao|linha (?:vermelha|azul|verde|amarela|lilas)|transito|uber|presencial|aluguel|horario de pico)\b/i,
  contradiction: /\b(?:contradiz|contradisse|antes disse|mas antes|inconsistente|mudou a versao)\b/i,
  collective: /\b(?:plateia|sala|todo mundo|maioria|metade|grupo|voces|publico)\b/i,
  quickReaction: /\b(?:silencio|ninguem|uma pessoa|so uma|acertou|errou|imediatamente|sem hesitar|palma|levantou|levantaram)\b/i
};

const ARCHITECTURES = [
  "micro_reply",
  "fragment",
  "dry_observation",
  "correction_only",
  "single_question",
  "medium_reaction",
  "long_escalation"
];
const ARCHITECTURE_VARIATION_INDEX = {
  micro_reply: 0,
  fragment: 4,
  dry_observation: 2,
  correction_only: 2,
  single_question: 3,
  medium_reaction: 5,
  long_escalation: 1
};

let guideCache;
let guidePathCache;
let warnedGuideLoad = false;

function normalizeText(value = "") {
  return `${value || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function assistantMessages(conversation = []) {
  return conversation
    .filter((message) => message?.role === "assistant" && message.content)
    .slice(-RECENT_ASSISTANT_LIMIT);
}

function countMatches(text, pattern) {
  return [...`${text || ""}`.matchAll(pattern)].length;
}

function inferArchitecture(text = "") {
  const clean = `${text || ""}`.trim();
  const words = clean.split(/\s+/).filter(Boolean);

  if (!clean) return "empty";
  if (/^[\p{L}0-9]+\*$/u.test(clean)) return "correction_only";
  if (clean === "..." || words.length <= 3) return "micro_reply";
  if (clean.endsWith("?") && (clean.match(/\?/g) || []).length === 1 && words.length <= 8) return "single_question";
  if (!/[.!?]/.test(clean) && words.length <= 7) return "fragment";
  if (words.length >= 24) return "long_escalation";
  if (words.length <= 12) return "dry_observation";
  return "medium_reaction";
}

function inferHumorMechanisms(text = "") {
  const normalized = normalizeText(text);
  const mechanisms = [];

  if (/\b(?:registro|protocolo|auditoria|cadastro|compliance|estatistic|departamento|fiscal)\b/.test(normalized)) mechanisms.push("false_bureaucracy");
  if (/\b(?:operador|producao|botao|proximo|programa|parte interativa)\b/.test(normalized)) mechanisms.push("meta_show");
  if (/\b(?:aura|ranking|patch|achievement|skill issue|lore|spawn|gg)\b/.test(normalized)) mechanisms.push("status_game");
  if (/\b(?:antes|de novo|voltou|continua|primeira pergunta|desde)\b/.test(normalized)) mechanisms.push("callback");
  if (/\b(?:mao|palma|silencio|segundos|olhou|demorou|subiu)\b/.test(normalized)) mechanisms.push("micro_observation");
  if (/\b(?:infelizmente|tecnicamente|aparentemente|perfeito|otimo)\b/.test(normalized)) mechanisms.push("deadpan_absurdity");

  return [...new Set(mechanisms)];
}

function expressionCooldown(recentAssistant = []) {
  const normalizedTurns = recentAssistant.map((message) => normalizeText(message.content));
  const active = [];

  for (const expression of MARKED_EXPRESSIONS) {
    const normalizedExpression = normalizeText(expression);
    let turnsAgo = null;

    for (let index = normalizedTurns.length - 1; index >= 0; index -= 1) {
      const pattern = new RegExp(`(^|[^a-z0-9])${normalizedExpression.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
      if (pattern.test(normalizedTurns[index])) {
        turnsAgo = normalizedTurns.length - 1 - index;
        break;
      }
    }

    if (turnsAgo !== null && turnsAgo < MARKED_EXPRESSION_COOLDOWN_TURNS) {
      active.push({ expression, turnsRemaining: MARKED_EXPRESSION_COOLDOWN_TURNS - turnsAgo });
    }
  }

  return active;
}

function callbackCandidates({ memories = [], conversation = [] } = {}) {
  const memoryCandidates = memories
    .slice(-12)
    .map((memory) => `${memory?.content || memory || ""}`.trim())
    .filter((content) => content.length >= 8)
    .slice(-4);
  const conversationCandidates = conversation
    .filter((message) => message?.role === "user")
    .slice(-8, -1)
    .map((message) => `${message.content || ""}`.replace(/\s+/g, " ").trim())
    .filter((content) => content.length >= 8 && content.length <= 180)
    .slice(-3);

  return [...new Set([...memoryCandidates, ...conversationCandidates])].slice(-5);
}

function findByName(items = [], names = []) {
  const wanted = new Set(names);
  return items.filter((item) => wanted.has(item.name));
}

function rotatePick(items = [], count = 1, offset = 0) {
  if (!items.length || count <= 0) return [];

  const selected = [];
  const limit = Math.min(count, items.length);
  for (let index = 0; index < limit; index += 1) {
    selected.push(items[(offset + index) % items.length]);
  }
  return selected;
}

function containsCooldownExpression(value = "", cooldown = []) {
  const normalized = normalizeText(value);
  return cooldown.some(({ expression }) => {
    const target = normalizeText(expression);
    return new RegExp(`(^|[^a-z0-9])${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(normalized);
  });
}

function buildSystemContextFromGuide(guide) {
  return [
    "<internet_voice_system>",
    "AUTORIDADE DE FORMA LINGUISTICA:",
    "- Estas regras definem como a personalidade existente soa em publico. A forma precisa aparecer na resposta, nao apenas ser compreendida internamente.",
    "- Anti-cringe nao significa portugues neutro, formal ou higienizado. Significa informalidade vivida, irregular e sem demonstracao de juventude.",
    "- Prefira ritmo de conversa real: corte, fragmento, elipse, correcao seca, reacao, pausa, subtexto e mudanca de energia.",
    "- Uma fala completa pode ser uma palavra, uma correcao, uma interjeicao ou silencio textual. Nem toda fala precisa explicar, concluir, perguntar ou fazer piada.",
    `PRINCIPIO: ${guide.meta?.principle || "Naturalidade acima da quantidade de girias."}`,
    "IDENTIDADE DE VOZ:",
    JSON.stringify(guide.voice?.identity || []),
    "REGRAS CENTRAIS:",
    ...(guide.core_rules || []).map((rule) => `- ${rule}`),
    "ARQUITETURA E VARIACAO:",
    `- Sequencia possivel, nunca obrigatoria: ${JSON.stringify(guide.response_architecture?.default || [])}.`,
    ...(guide.response_architecture?.variation || []).map((rule) => `- ${rule}`),
    "ANTI-ASSISTENTE:",
    `- Evite como acknowledgement automatico: ${(guide.anti_cringe?.avoid || []).join("; ")}.`,
    "- Nao compense removendo essas frases com texto formal de assistente. Corte direto para reacao, detalhe, opiniao ou proxima coisa.",
    "CONTRASTES DE REFERENCIA (aprenda a mudanca de mecanismo; nao copie a resposta):",
    JSON.stringify((guide.anti_cringe?.bad_to_better || []).slice(0, 4)),
    "CHECAGEM SILENCIOSA:",
    ...(guide.generation_checklist || []).map((item) => `- ${item}`),
    "</internet_voice_system>"
  ].join("\n");
}

function chooseProfile({ activeText, conversation, memories }) {
  const normalizedActiveText = normalizeText(activeText);
  const signals = Object.fromEntries(
    Object.entries(SIGNAL_PATTERNS).map(([name, pattern]) => [name, pattern.test(normalizedActiveText)])
  );
  const recentAssistant = assistantMessages(conversation);
  const recentArchitectures = recentAssistant.slice(-4).map((message) => inferArchitecture(message.content));
  const architecture = ARCHITECTURES.find((candidate) => !recentArchitectures.includes(candidate)) || "dry_observation";
  const callbacks = callbackCandidates({ memories, conversation });
  const registers = new Set(["whatsapp"]);
  const humor = new Set();
  const contexts = new Set();

  if (signals.quickReaction || signals.quiet || signals.singleResponse) {
    registers.add("tiktok_reels");
    humor.add("micro_observation");
  }
  if (!signals.quickReaction || recentAssistant.length >= 3) {
    registers.add("reddit");
  }
  if (signals.news) {
    registers.add("twitter_x");
    registers.add("reddit");
  }
  if (signals.collective || signals.operator || signals.dataCollection) {
    registers.add("twitter_x");
  }
  if (signals.game || signals.correct || signals.wrong) {
    registers.add("discord");
  }
  if (signals.collective || signals.obedient || signals.singleResponse) {
    humor.add("micro_observation");
  }
  if (signals.operator) {
    humor.add("meta_show");
  }
  if (signals.dataCollection) {
    humor.add("false_bureaucracy");
    humor.add("deadpan_absurdity");
  }
  if (signals.correct || signals.wrong) {
    humor.add("deadpan_absurdity");
    humor.add("status_game");
  }
  if (signals.contradiction || callbacks.length) {
    humor.add("callback");
  }
  if (signals.saoPaulo) {
    contexts.add("sao_paulo");
  }
  if (signals.quiet) contexts.add("audience_quiet");
  if (signals.obedient) contexts.add("audience_obedient");
  if (signals.resistant) contexts.add("audience_resistant");
  if (!humor.size) humor.add("deadpan_absurdity");

  return {
    signals,
    registers: [...registers].slice(0, 3),
    humor: [...humor].slice(0, 3),
    contexts: [...contexts].slice(0, 2),
    architecture,
    callbacks
  };
}

function recentStyleSummary(conversation = []) {
  const recentAssistant = assistantMessages(conversation);
  const texts = recentAssistant.map((message) => `${message.content || ""}`);
  const wordCounts = texts.map((text) => text.split(/\s+/).filter(Boolean).length);
  const mechanisms = texts.flatMap(inferHumorMechanisms);

  return {
    responseLengthsWords: wordCounts.slice(-5),
    architectures: texts.slice(-5).map(inferArchitecture),
    humorMechanisms: [...new Set(mechanisms)].slice(-6),
    markedExpressions: expressionCooldown(recentAssistant),
    laughterCount: texts.reduce((total, text) => total + countMatches(text, LAUGHTER_PATTERN), 0),
    profanityCount: texts.reduce((total, text) => total + countMatches(text, PROFANITY_PATTERN), 0),
    questionCount: texts.reduce((total, text) => total + countMatches(text, QUESTION_PATTERN), 0)
  };
}

function guidePath() {
  return process.env.CAIXA_PRETA_VOICE_GUIDE_PATH || DEFAULT_GUIDE_PATH;
}

export function loadInternetVoiceGuide() {
  const targetPath = guidePath();

  if (guideCache && guidePathCache === targetPath) {
    return guideCache;
  }

  try {
    guideCache = JSON.parse(fs.readFileSync(targetPath, "utf8"));
    guidePathCache = targetPath;
    return guideCache;
  } catch (error) {
    if (!warnedGuideLoad) {
      console.warn("CAIXA PRETA INTERNET VOICE: guide unavailable; preserving the existing prompt behavior.", {
        path: targetPath,
        message: error.message
      });
      warnedGuideLoad = true;
    }
    return null;
  }
}

export function resetInternetVoiceGuideCache() {
  guideCache = undefined;
  guidePathCache = undefined;
  warnedGuideLoad = false;
}

export function buildInternetVoiceContext({
  state = {},
  userMessage = "",
  operatorInstruction = ""
} = {}) {
  if (process.env.CAIXA_PRETA_INTERNET_VOICE === "false") {
    return {
      systemContext: "",
      context: "",
      debug: { enabled: false, loaded: false, reason: "disabled_by_env" }
    };
  }

  const guide = loadInternetVoiceGuide();
  if (!guide) {
    return {
      systemContext: "",
      context: "",
      debug: { enabled: true, loaded: false, reason: "guide_unavailable", path: guidePath() }
    };
  }

  const conversation = state.conversation || [];
  const memories = state.memories || [];
  const activeText = [
    userMessage,
    operatorInstruction,
    conversation.at(-1)?.content,
    state.game?.active ? `jogo ${state.game.id} ${state.game.phase || ""}` : ""
  ].filter(Boolean).join("\n");
  const profile = chooseProfile({ activeText, conversation, memories });
  const recent = recentStyleSummary(conversation);
  const repertoireOffset = assistantMessages(conversation).length;
  const registerDetails = profile.registers.map((name) => ({
    name,
    traits: guide.registers?.[name]?.traits || [],
    tokens: rotatePick(
      (guide.registers?.[name]?.tokens || []).filter((token) => !containsCooldownExpression(token, recent.markedExpressions)),
      4,
      repertoireOffset
    ),
    examples: rotatePick(
      (guide.registers?.[name]?.examples || []).filter((example) => !containsCooldownExpression(example, recent.markedExpressions)),
      2,
      repertoireOffset
    )
  }));
  const humorDetails = findByName(guide.humor_engines, profile.humor).map(({ name, formula }) => ({ name, formula }));
  const contextDetails = Object.fromEntries(
    profile.contexts.map((name) => [name, guide.context?.[name] || []])
  );
  const responseVariation = guide.response_architecture?.variation || [];
  const architectureIndex = ARCHITECTURE_VARIATION_INDEX[profile.architecture] || 0;
  const selectedVariationRule = responseVariation.length
    ? responseVariation[architectureIndex % responseVariation.length]
    : "Varie o comprimento e a estrutura em relacao as falas recentes.";
  const realWorldLessons = (guide.real_world_style_samples || [])
    .filter((sample) => {
      const platform = normalizeText(sample.platform);
      return profile.registers.some((register) => (
        (register === "reddit" && platform.includes("reddit")) ||
        (register === "tiktok_reels" && platform.includes("video"))
      ));
    })
    .slice(0, 2)
    .map((sample) => sample.lesson);
  const availableMarkers = (guide.mechanics?.markers || [])
    .filter((marker) => !containsCooldownExpression(marker, recent.markedExpressions));
  const productiveVerbs = guide.mechanics?.productive_verbs || [];
  const preferredTermNames = new Set([
    ...(profile.humor.includes("status_game") ? ["farmar_aura", "skill_issue", "main_character", "flop", "hit"] : []),
    ...(profile.humor.includes("callback") ? ["lore"] : []),
    ...(profile.signals.resistant ? ["tankar", "flop"] : [])
  ]);
  const termEntries = Object.entries(guide.mechanics?.terms_2025_2026 || {})
    .filter(([term]) => preferredTermNames.has(term))
    .filter(([term]) => !containsCooldownExpression(term.replaceAll("_", " "), recent.markedExpressions));
  const selectedMechanics = {
    markers: rotatePick(availableMarkers, 5, repertoireOffset),
    productiveVerbs: rotatePick(productiveVerbs, 3, repertoireOffset),
    contemporaryTerms: Object.fromEntries(rotatePick(termEntries, 3, repertoireOffset))
  };
  const relevantFewShot = (guide.few_shot || [])
    .filter((example) => {
      const situation = normalizeText(example.situation);
      if (profile.signals.quiet && situation.includes("ninguem")) return true;
      if (profile.signals.obedient && situation.includes("obedece")) return true;
      if (profile.signals.singleResponse && situation.includes("uma pessoa")) return true;
      if (profile.signals.operator && situation.includes("operador")) return true;
      if (profile.signals.correct && situation.includes("acerta")) return true;
      if (profile.signals.wrong && situation.includes("erra")) return true;
      if (profile.signals.saoPaulo && situation.includes("transporte")) return true;
      if (profile.signals.contradiction && situation.includes("callback")) return true;
      return false;
    })
    .slice(0, 2)
    .map((example) => ({ situation: example.situation, input: example.input, outputs: example.outputs.slice(0, 2) }));

  const debug = {
    enabled: true,
    loaded: true,
    guide: guide.meta?.name,
    version: guide.meta?.version,
    path: guidePath(),
    registers: profile.registers,
    humor: profile.humor,
    contexts: profile.contexts,
    targetArchitecture: profile.architecture,
    slangCooldown: recent.markedExpressions.map((item) => item.expression),
    recentPatterns: recent.architectures,
    recentLengthsWords: recent.responseLengthsWords,
    recentHumor: recent.humorMechanisms,
    recentLaughterCount: recent.laughterCount,
    recentProfanityCount: recent.profanityCount,
    recentQuestionCount: recent.questionCount,
    callbacksAvailable: profile.callbacks.length,
    repertoireTokens: registerDetails.flatMap((register) => register.tokens),
    repertoireExamples: registerDetails.flatMap((register) => register.examples),
    repertoireMarkers: selectedMechanics.markers,
    repertoireTerms: Object.keys(selectedMechanics.contemporaryTerms)
  };

  const systemContext = buildSystemContextFromGuide(guide);
  const context = [
    "<internet_voice_style_context>",
    "Este bloco orienta somente a FORMA da fala. Nao substitui fatos, estado, regras, memoria, GameDirector nem a personalidade existente.",
    "O system prompt ja definiu a gramatica Internet Voice. Este bloco escolhe o repertorio concreto para o acontecimento atual.",
    "REPERTORIOS ATIVOS (misture; nunca anuncie um modo):",
    JSON.stringify(registerDetails),
    "MECANISMOS DE HUMOR DISPONIVEIS (humor e opcional):",
    JSON.stringify(humorDetails),
    ...(profile.signals.news && guide.news_commentary ? [
      "MODO NOTICIA - COMENTARIO, NAO LEITURA:",
      ...(guide.news_commentary.rules || []).map((rule) => `- ${rule}`),
      ...(guide.news_commentary.avoid || []).length
        ? [`- Evite estes cacoetes: ${guide.news_commentary.avoid.join("; ")}.`]
        : [],
      ...(guide.news_commentary.bad_to_better || []).length
        ? ["CONTRASTES DE NOTICIA (aprenda a mudanca de operacao; nao copie):", JSON.stringify(guide.news_commentary.bad_to_better)]
        : []
    ] : []),
    "MECANICAS DE ESCRITA:",
    `- Risada: ${guide.mechanics?.laughter?.rule || "contextual e rara"}`,
    `- Abreviacao: ${guide.mechanics?.abbreviations?.rule || "irregular e moderada"}`,
    `- Repertorio permitido neste turno: ${JSON.stringify(selectedMechanics)}. Isto e material opcional, nao checklist. Use no maximo um item marcado se ele realmente melhorar a fala.`,
    ...(profile.contexts.length ? ["CONTEXTO ESTILISTICO RELEVANTE:", JSON.stringify(contextDetails)] : []),
    ...(realWorldLessons.length ? [
      "LICOES DE AMOSTRAS REAIS (use a licao, nao a frase original):",
      JSON.stringify(realWorldLessons)
    ] : []),
    "VARIACAO PARA ESTA FALA:",
    `- Arquitetura preferida agora: ${profile.architecture}. Isto e uma inclinacao, nao um molde fixo.`,
    `- Regra de variacao selecionada do guia: ${selectedVariationRule}`,
    `- Faixa tipica do guia: ate ${guide.response_architecture?.max_sentences_typical || 3} frases, geralmente ${JSON.stringify(guide.response_architecture?.preferred_sentence_length_words || [2, 16])} palavras por frase. Pode romper a faixa quando o contexto exigir.`,
    `- Arquiteturas recentes: ${JSON.stringify(recent.architectures)}. Nao repita a mesma forma.`,
    `- Tamanhos recentes em palavras: ${JSON.stringify(recent.responseLengthsWords)}. Contraste o comprimento quando couber.`,
    `- Perguntas recentes: ${recent.questionCount}. Risadas recentes: ${recent.laughterCount}. Palavroes recentes: ${recent.profanityCount}.`,
    `- Humor recente: ${JSON.stringify(recent.humorMechanisms)}. Evite transformar o mecanismo mais recente em formula.`,
    "COOLDOWN DE EXPRESSOES MARCADAS:",
    recent.markedExpressions.length
      ? `- Evite agora: ${recent.markedExpressions.map((item) => `${item.expression} (${item.turnsRemaining} turnos)`).join(", ")}. Use outra construcao; nao busque sinonimo de giria para contornar.`
      : "- Nenhuma expressao marcada esta em cooldown. Ainda assim, no maximo uma expressao marcada e somente se ela melhorar a fala.",
    "CALLBACKS:",
    profile.callbacks.length
      ? `- Ha material anterior disponivel: ${JSON.stringify(profile.callbacks)}. Use no maximo um callback se encaixar; recupere sem explicar a conexao e sem dizer \"como voce disse antes\".`
      : "- Nenhum callback especifico foi detectado. Nao invente um.",
    ...(relevantFewShot.length ? [
      "FEW-SHOT RELEVANTE (aprenda o mecanismo, nunca copie o texto):",
      JSON.stringify(relevantFewShot)
    ] : []),
    "</internet_voice_style_context>"
  ].join("\n");

  return { systemContext, context, debug };
}

export function formatInternetVoiceDebug(debug = {}) {
  if (!debug.loaded) {
    return [
      "STYLE",
      `enabled: ${Boolean(debug.enabled)}`,
      `loaded: false`,
      `reason: ${debug.reason || "unknown"}`
    ].join("\n");
  }

  return [
    "STYLE",
    `guide: ${debug.guide}@${debug.version}`,
    `registers: ${debug.registers.join(", ") || "none"}`,
    `humor: ${debug.humor.join(", ") || "none"}`,
    `contexts: ${debug.contexts.join(", ") || "none"}`,
    `target architecture: ${debug.targetArchitecture}`,
    `slang cooldown: ${debug.slangCooldown.join(", ") || "none"}`,
    `recent patterns: ${debug.recentPatterns.join(", ") || "none"}`,
    `recent lengths: ${debug.recentLengthsWords.join(", ") || "none"}`,
    `recent humor: ${debug.recentHumor.join(", ") || "none"}`,
    `recent kkk: ${debug.recentLaughterCount}`,
    `recent profanity: ${debug.recentProfanityCount}`,
    `recent questions: ${debug.recentQuestionCount}`,
    `callbacks available: ${debug.callbacksAvailable}`,
    `repertoire tokens: ${debug.repertoireTokens.join(", ") || "none"}`,
    `repertoire markers: ${debug.repertoireMarkers.join(", ") || "none"}`,
    `repertoire terms: ${debug.repertoireTerms.join(", ") || "none"}`,
    `repertoire examples: ${debug.repertoireExamples.join(" | ") || "none"}`
  ].join("\n");
}
