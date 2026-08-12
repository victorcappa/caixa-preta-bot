import { randomUUID } from "node:crypto";
import { inferCountdownDurationFromText } from "./countdownText.js";

export const PERFORMANCE_EVENT_TYPES = {
  fullscreenText: "FULLSCREEN_TEXT",
  flashText: "FLASH_TEXT",
  blackout: "BLACKOUT",
  hideUi: "HIDE_UI",
  glitch: "GLITCH",
  countdown: "COUNTDOWN",
  repeatText: "REPEAT_TEXT",
  showShape: "SHOW_SHAPE",
  drawing: "DRAWING",
  clearDrawing: "CLEAR_DRAWING",
  forbiddenButton: "FORBIDDEN_BUTTON",
  multipleChoice: "MULTIPLE_CHOICE",
  phoneProjectionRequest: "PHONE_PROJECTION_REQUEST",
  hidePhoneProjection: "HIDE_PHONE_PROJECTION",
  showBigText: "SHOW_BIG_TEXT",
  clearScreen: "CLEAR_SCREEN",
  showTimer: "SHOW_TIMER",
  hideTimer: "HIDE_TIMER",
  showInstagram: "SHOW_INSTAGRAM",
  hideInstagram: "HIDE_INSTAGRAM",
  startDrawing: "START_DRAWING",
  addDrawingElement: "ADD_DRAWING_ELEMENT",
  showHangman: "SHOW_HANGMAN",
  updateHangman: "UPDATE_HANGMAN",
  showPuzzle: "SHOW_PUZZLE",
  showWin: "SHOW_WIN",
  showLose: "SHOW_LOSE",
  returnToChat: "RETURN_TO_CHAT"
};

export const PERFORMANCE_TRIGGER_TYPES = {
  immediate: "IMMEDIATE",
  afterDelay: "AFTER_DELAY",
  afterMessages: "AFTER_MESSAGES",
  onUserMessage: "ON_USER_MESSAGE",
  onUiInteraction: "ON_UI_INTERACTION"
};

const MAX_DURATION_MS = 12000;
const MAX_DELAY_MS = 60000;
const MAX_TEXT_LENGTH = 240;
const MAX_DRAWING_SHAPES = 64;
const MAX_COUNTDOWN_SECONDS = 60;
const MIN_FLASH_TEXT_MS = 1200;
const EVENT_TYPES = new Set(Object.values(PERFORMANCE_EVENT_TYPES));
const TRIGGER_TYPES = new Set(Object.values(PERFORMANCE_TRIGGER_TYPES));
const COUNTDOWN_WORD_PATTERN = "(?:[3-9]|[1-5][0-9]|60|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta)";
const TIMED_ACTION_PATTERNS = [
  new RegExp(`\\bpor\\s+${COUNTDOWN_WORD_PATTERN}\\s+(?:segundo|segundos|s)\\b`),
  new RegExp(`\\bem\\s+${COUNTDOWN_WORD_PATTERN}\\s+(?:segundo|segundos|s)\\b`),
  new RegExp(`\\b${COUNTDOWN_WORD_PATTERN}\\s+(?:segundo|segundos|s)\\s+(?:para|de|sem)\\b`)
];
const ACTION_WORD_PATTERN = /\b(segura|segure|segurar|mantem|mantenha|fica|fique|ficar|levanta|levante|aponta|aponte|olha|olhe|encara|encare|fecha|feche|abre|abra|mime|conta|conte|vota|vote|silencio|mao|maos|dedo|corpo|rosto|plateia|sala|palco)\b/;
const SPEECH_ACTION_PATTERN = /\b(fala|fale|falar|diz|diga|dizer|defende|defenda|defender|conta|conte|contar)\b/;
const SPEECH_TOPIC_PATTERN = /\b(sobre|por que|porque|defende|defenda|defender|contra|a favor|sem|como se|a frase|essa palavra|esse objeto|isso|o que)\b/;
const PAST_REFERENCE_PATTERN = /\b(ha|faz|fez|atras|antes|depois|avisei|acabou|terminou)\s+(?:de\s+)?[a-z0-9]+\s+(?:segundo|segundos|s)\b/;

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, number));
}

function cleanText(value = "", fallback = "") {
  return `${value || fallback}`.slice(0, MAX_TEXT_LENGTH);
}

function normalizeForCountdownAction(text = "") {
  return `${text || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanStringArray(values = [], limit = 8) {
  return values
    .map((value) => cleanText(value))
    .filter(Boolean)
    .slice(0, limit);
}

function cleanPhonePrivacyLevel(value = "") {
  return ["low", "medium", "high"].includes(value) ? value : "high";
}

function normalizeTrigger(trigger = {}) {
  const type = TRIGGER_TYPES.has(trigger.type) ? trigger.type : PERFORMANCE_TRIGGER_TYPES.immediate;

  return {
    type,
    delayMs: clampNumber(trigger.delayMs, 0, MAX_DELAY_MS, 0),
    afterMessages: clampNumber(trigger.afterMessages, 1, 50, 1),
    match: cleanText(trigger.match || "")
  };
}

function normalizeShape(shape = {}) {
  const allowedTypes = new Set([
    "line",
    "polyline",
    "circle",
    "ellipse",
    "rect",
    "polygon",
    "arc",
    "point",
    "text"
  ]);
  const type = allowedTypes.has(shape.type) ? shape.type : "point";

  return {
    id: cleanText(shape.id || randomUUID(), randomUUID()),
    type,
    x: clampNumber(shape.x, 0, 100, 50),
    y: clampNumber(shape.y, 0, 100, 50),
    x2: clampNumber(shape.x2, 0, 100, 50),
    y2: clampNumber(shape.y2, 0, 100, 50),
    width: clampNumber(shape.width, 0, 100, 20),
    height: clampNumber(shape.height, 0, 100, 20),
    radius: clampNumber(shape.radius, 0, 100, 12),
    points: Array.isArray(shape.points)
      ? shape.points.slice(0, 20).map((point) => ({
        x: clampNumber(point.x, 0, 100, 50),
        y: clampNumber(point.y, 0, 100, 50)
      }))
      : [],
    text: cleanText(shape.text || ""),
    stroke: cleanText(shape.stroke || "#00ff66"),
    fill: cleanText(shape.fill || "none"),
    strokeWidth: clampNumber(shape.strokeWidth, 1, 16, 2)
  };
}

function normalizePayload(type, payload = {}) {
  if (
    type === PERFORMANCE_EVENT_TYPES.blackout ||
    type === PERFORMANCE_EVENT_TYPES.hideUi ||
    type === PERFORMANCE_EVENT_TYPES.clearScreen ||
    type === PERFORMANCE_EVENT_TYPES.hideTimer ||
    type === PERFORMANCE_EVENT_TYPES.hideInstagram ||
    type === PERFORMANCE_EVENT_TYPES.returnToChat
  ) {
    return {};
  }

  if (type === PERFORMANCE_EVENT_TYPES.hidePhoneProjection) {
    return {};
  }

  if (type === PERFORMANCE_EVENT_TYPES.glitch) {
    return {
      intensity: clampNumber(payload.intensity, 1, 10, 4),
      text: cleanText(payload.text || "")
    };
  }

  if (type === PERFORMANCE_EVENT_TYPES.countdown || type === PERFORMANCE_EVENT_TYPES.showTimer) {
    const duration = clampNumber(
      payload.duration ?? payload.seconds ?? payload.from,
      3,
      MAX_COUNTDOWN_SECONDS,
      5
    );
    const startedAt = clampNumber(payload.startedAt, 0, Number.MAX_SAFE_INTEGER, Date.now());

    return {
      from: duration,
      duration,
      startedAt,
      label: cleanText(payload.label || "")
    };
  }

  if (
    type === PERFORMANCE_EVENT_TYPES.fullscreenText ||
    type === PERFORMANCE_EVENT_TYPES.showBigText ||
    type === PERFORMANCE_EVENT_TYPES.showWin ||
    type === PERFORMANCE_EVENT_TYPES.showLose
  ) {
    return {
      text: cleanText(payload.text || payload.value || "REGISTRADO")
    };
  }

  if (type === PERFORMANCE_EVENT_TYPES.repeatText) {
    return {
      text: cleanText(payload.text || "REGISTRADO"),
      count: clampNumber(payload.count, 1, 60, 12)
    };
  }

  if (type === PERFORMANCE_EVENT_TYPES.showShape) {
    return {
      shape: normalizeShape(payload.shape || payload)
    };
  }

  if (
    type === PERFORMANCE_EVENT_TYPES.drawing ||
    type === PERFORMANCE_EVENT_TYPES.startDrawing ||
    type === PERFORMANCE_EVENT_TYPES.addDrawingElement
  ) {
    return {
      mode: cleanText(payload.mode || "add"),
      revealMs: clampNumber(payload.revealMs, 0, MAX_DURATION_MS, 1400),
      shapes: Array.isArray(payload.shapes)
        ? payload.shapes.slice(0, MAX_DRAWING_SHAPES).map(normalizeShape)
        : []
    };
  }

  if (type === PERFORMANCE_EVENT_TYPES.clearDrawing) {
    return {};
  }

  if (type === PERFORMANCE_EVENT_TYPES.showInstagram) {
    const person = payload.person && typeof payload.person === "object" ? payload.person : {};
    const preparedFeed = Array.isArray(person.preparedFeed)
      ? person.preparedFeed.slice(0, 12).map((post, index) => ({
        id: cleanText(post.id || `${index + 1}`),
        label: cleanText(post.label || `POST ${index + 1}`),
        caption: cleanText(post.caption || "")
      }))
      : [];

    return {
      duration: clampNumber(payload.duration, 3, 60, 60),
      person: {
        id: cleanText(person.id || payload.personId || ""),
        name: cleanText(person.name || payload.name || ""),
        instagramHandle: cleanText(person.instagramHandle || payload.instagramHandle || ""),
        instagramUrl: cleanText(person.instagramUrl || ""),
        preparedFeed
      }
    };
  }

  if (type === PERFORMANCE_EVENT_TYPES.showHangman || type === PERFORMANCE_EVENT_TYPES.updateHangman) {
    return {
      publicState: payload.publicState && typeof payload.publicState === "object" ? {
        progress: cleanText(payload.publicState.progress || ""),
        wrongLetters: cleanStringArray(payload.publicState.wrongLetters || payload.publicState.wrongGuesses || [], 12),
        attemptsLeft: clampNumber(payload.publicState.attemptsLeft, 0, 20, 6)
      } : {}
    };
  }

  if (type === PERFORMANCE_EVENT_TYPES.showPuzzle) {
    return {
      gameId: cleanText(payload.gameId || ""),
      title: cleanText(payload.title || "PUZZLE"),
      publicState: payload.publicState && typeof payload.publicState === "object"
        ? JSON.parse(JSON.stringify(payload.publicState))
        : {}
    };
  }

  if (type === PERFORMANCE_EVENT_TYPES.forbiddenButton) {
    return {
      label: cleanText(payload.label || "NAO TOQUE"),
      eventInteraction: "FORBIDDEN_BUTTON_CLICK"
    };
  }

  if (type === PERFORMANCE_EVENT_TYPES.multipleChoice) {
    return {
      prompt: cleanText(payload.prompt || ""),
      options: cleanStringArray(payload.options || ["A", "B", "C"], 6)
    };
  }

  if (type === PERFORMANCE_EVENT_TYPES.phoneProjectionRequest) {
    return {
      participant: cleanText(payload.participant || ""),
      contentType: cleanText(payload.contentType || "phone_content"),
      privacyLevel: cleanPhonePrivacyLevel(payload.privacyLevel),
      requiresHumanApproval: true,
      status: "pending_operator_confirmation"
    };
  }

  return {
    text: cleanText(payload.text || payload.value || "REGISTRADO")
  };
}

export function normalizePerformanceEvent(raw = {}, source = "agent") {
  const type = EVENT_TYPES.has(raw.type) ? raw.type : PERFORMANCE_EVENT_TYPES.fullscreenText;
  const defaultDurationMs = type === PERFORMANCE_EVENT_TYPES.countdown
    ? (clampNumber(raw.payload?.duration ?? raw.payload?.seconds ?? raw.payload?.from, 3, MAX_COUNTDOWN_SECONDS, 5) + 1) * 1000
    : type === PERFORMANCE_EVENT_TYPES.showInstagram ? 61000
    : type === PERFORMANCE_EVENT_TYPES.flashText ? 1400 : 1800;
  const maxDurationMs = type === PERFORMANCE_EVENT_TYPES.countdown || type === PERFORMANCE_EVENT_TYPES.showTimer
    ? (MAX_COUNTDOWN_SECONDS + 1) * 1000
    : type === PERFORMANCE_EVENT_TYPES.showInstagram ? 65000
    : type === PERFORMANCE_EVENT_TYPES.showPuzzle || type === PERFORMANCE_EVENT_TYPES.showHangman || type === PERFORMANCE_EVENT_TYPES.updateHangman ? 65000
    : MAX_DURATION_MS;
  const minDurationMs = type === PERFORMANCE_EVENT_TYPES.flashText ? MIN_FLASH_TEXT_MS : 80;
  const durationMs = clampNumber(raw.durationMs, minDurationMs, maxDurationMs, defaultDurationMs);
  const delayMs = clampNumber(raw.delayMs, 0, MAX_DELAY_MS, 0);

  return {
    id: cleanText(raw.id || randomUUID(), randomUUID()),
    type,
    status: "queued",
    source: raw.source || source,
    priority: clampNumber(raw.priority, 0, 100, 10),
    createdAt: new Date().toISOString(),
    trigger: normalizeTrigger(raw.trigger || { type: delayMs > 0 ? PERFORMANCE_TRIGGER_TYPES.afterDelay : PERFORMANCE_TRIGGER_TYPES.immediate, delayMs }),
    delayMs,
    durationMs,
    interrupt: Boolean(raw.interrupt),
    activityId: raw.activityId || null,
    payload: normalizePayload(type, raw.payload || {})
  };
}

export function normalizePerformanceEvents(events = [], source = "agent") {
  if (!Array.isArray(events)) {
    return [];
  }

  return events.slice(0, 8).map((event) => normalizePerformanceEvent(event, source));
}

export function filterAgentPerformanceEvents(events = [], publicText = "") {
  if (!Array.isArray(events)) {
    return [];
  }

  const explicitCountdownDuration = inferCountdownDurationFromText(publicText);

  return events.filter((event) => {
    if (event?.type !== PERFORMANCE_EVENT_TYPES.countdown) {
      return true;
    }

    return Boolean(explicitCountdownDuration);
  });
}

export function inferActionCountdownEvent(publicText = "") {
  const duration = inferCountdownDurationFromText(publicText);
  if (!duration) {
    return null;
  }

  const normalized = normalizeForCountdownAction(publicText);
  const hasTimedAction = TIMED_ACTION_PATTERNS.some((pattern) => pattern.test(normalized));
  const hasClearAction = ACTION_WORD_PATTERN.test(normalized)
    || (SPEECH_ACTION_PATTERN.test(normalized) && SPEECH_TOPIC_PATTERN.test(normalized));

  if (!hasTimedAction || !hasClearAction || PAST_REFERENCE_PATTERN.test(normalized)) {
    return null;
  }

  return {
    type: PERFORMANCE_EVENT_TYPES.countdown,
    payload: {
      duration,
      from: duration,
      seconds: duration
    }
  };
}

export function withInferredCountdownEvent(events = [], publicText = "") {
  const safeEvents = Array.isArray(events) ? events : [];

  if (safeEvents.some((event) => event?.type === PERFORMANCE_EVENT_TYPES.countdown)) {
    return safeEvents;
  }

  const inferred = inferActionCountdownEvent(publicText);
  return inferred ? [...safeEvents, inferred] : safeEvents;
}

export function performanceCapabilitiesBlock() {
  return `
CAPACIDADES DE PERFORMANCE DISPONIVEIS:
Voce pode responder com texto e tambem solicitar eventos estruturados seguros.
Eventos sao raros. Normalidade e necessaria para que a anormalidade funcione.
Nao use evento em toda mensagem. Nao explique o mecanismo ao publico.

EVENT TYPES:
- FULLSCREEN_TEXT { text }
- FLASH_TEXT { text }
- BLACKOUT {}
- HIDE_UI {}
- GLITCH { text?, intensity }
- COUNTDOWN { duration, startedAt?, label? } ou { seconds, label? }
- REPEAT_TEXT { text, count }
- SHOW_SHAPE { shape }
- DRAWING { shapes, revealMs? }
- CLEAR_DRAWING {}
- FORBIDDEN_BUTTON { label }
- MULTIPLE_CHOICE { prompt, options }
- PHONE_PROJECTION_REQUEST { participant, contentType, privacyLevel }
- HIDE_PHONE_PROJECTION {}
- SHOW_INSTAGRAM { person, duration }
- HIDE_INSTAGRAM {}
- SHOW_HANGMAN / UPDATE_HANGMAN { publicState }
- SHOW_PUZZLE { gameId, title, publicState }
- SHOW_WIN { text }
- SHOW_LOSE { text }
- RETURN_TO_CHAT {}

TRIGGERS CONCEITUAIS:
IMMEDIATE, AFTER_DELAY, AFTER_MESSAGES, ON_USER_MESSAGE, ON_UI_INTERACTION.

FORMATO ESTRUTURADO:
Quando solicitado, responda somente JSON valido:
{
  "text": "fala publica curta",
  "events": [],
  "salience": [],
  "activity": null,
  "game": null,
  "suitcase": null
}

Para iniciar jogo por autonomia da Caixa, use:
"game": { "startGame": true, "requestedGame": "cards", "gameSuggestion": "motivo curto" }
O codigo escolhe/adapta jogo elegivel, estado, participantes, placar, cooldown e fim.
Durante jogo ativo, voce pode pedir movimento validado:
"game": { "gameMove": "award_point", "target": "TIME A", "delta": 1, "personalityMove": "counter_roast" }
Durante experiencia de malas, use "suitcase" apenas para movimentos que alteram
regra/estado, como ask_question, guess ou select_post.

Training examples and performance events are behavioral mechanisms, not scripts.
Nunca gere numeros de contagem como mensagens separadas. Para contagem, emita
somente COUNTDOWN com duration entre 3 e 60 segundos; o frontend conta sozinho.
COUNTDOWN gerado pela IA so e aceito se o texto publico contiver duracao
explicita em segundos, como "vinte segundos" ou "10 segundos". Nao use
COUNTDOWN apenas para ritmo, suspense ou porque alguem perguntou sobre contagem.
Se o texto publico disser "vinte segundos", o COUNTDOWN deve ter duration 20.
Se a fala publica manda uma acao temporizada concreta, inclua COUNTDOWN no JSON.
Nao deixe a contagem so no texto.
Voce pode fingir mudar de ideia sobre a duracao na fala publica. Quando houver
mais de uma duracao explicita, a ultima e a que vale para o COUNTDOWN.
Exemplo: "vinte segundos. nao, dez segundos." deve gerar duration 10.
Eventos gerados pela IA aparecem depois que a fala publica terminar de digitar.
DRAWING precisa ter relacao clara com conversa, memoria ou pedido explicito de
desenho/imagem/adivinhacao. Nao use DRAWING para "fofoca leve", escolha social
ou jogo generico. Se for desenho temporario fora de jogo visual, mande
CLEAR_DRAWING depois.
PHONE_PROJECTION_REQUEST nunca projeta conteudo privado sozinho. E apenas um
pedido estruturado para confirmacao humana no operator.
HIDE_PHONE_PROJECTION e panic/hide imediato para qualquer tentativa de projecao
de celular.
Nunca gere HTML, JavaScript, CSS ou seletores DOM.
`.trim();
}
