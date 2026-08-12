import fs from "node:fs";
import path from "node:path";

import { PERFORMANCE_EVENT_TYPES } from "../performanceEvents.js";

const INSTAGRAM_PATH = path.join(process.cwd(), "data", "instagram-participants.json");

export const SUITCASE_PHASES = {
  idle: "IDLE",
  waitingSelection: "WAITING_FOR_SUITCASE_SELECTION",
  waitingContent: "WAITING_FOR_SUITCASE_CONTENT",
  activeExperience: "ACTIVE_EXPERIENCE",
  finished: "FINISHED",
  aborted: "ABORTED"
};

export const SUITCASE_EXPERIENCES = {
  guessWho: "guess_who",
  instagram: "instagram",
  miniGame: "mini_game"
};

const MINI_GAME_IDS = [
  "hangman",
  "drawing_guess",
  "scrambled_word",
  "riddle",
  "guess_the_rule"
];

const WORDS = [
  "teatro",
  "arquivo",
  "algoritmo",
  "memoria",
  "sombra",
  "espelho",
  "suspeito",
  "palco"
];

const RIDDLES = [
  {
    id: "eco",
    prompt: "Falo sem boca e respondo sem corpo. O que sou?",
    answer: "eco",
    hints: ["repete o que recebe", "nao inventa, devolve", "mora em parede ruim"]
  },
  {
    id: "senha",
    prompt: "Quanto mais gente sabe, menos eu funciono. O que sou?",
    answer: "senha",
    hints: ["tem dono e vazamento", "parece seguranca ate alguem dizer em voz alta"]
  },
  {
    id: "memoria",
    prompt: "Guardo tudo errado, mas ainda assim convenço alguem. O que sou?",
    answer: "memoria",
    hints: ["parece arquivo", "tambem e cena"]
  }
];

const RULES = [
  {
    id: "tem_letra_a",
    label: "aceita palavras com a letra A",
    examples: [
      { word: "banana", accepted: true },
      { word: "limao", accepted: false }
    ],
    test: (word) => normalizeText(word).includes("a")
  },
  {
    id: "tamanho_par",
    label: "aceita palavras com numero par de letras",
    examples: [
      { word: "cadeira", accepted: false },
      { word: "mesa", accepted: true }
    ],
    test: (word) => normalizeText(word).replace(/[^a-z0-9]/g, "").length % 2 === 0
  },
  {
    id: "comeca_consoante",
    label: "aceita palavras que comecam com consoante",
    examples: [
      { word: "banana", accepted: true },
      { word: "abacate", accepted: false }
    ],
    test: (word) => /^[bcdfghjklmnpqrstvwxyz]/.test(normalizeText(word))
  }
];

const DRAWING_SHAPES = {
  bicicleta: [
    { type: "circle", id: "bike-wheel-a", x: 28, y: 68, radius: 11, strokeWidth: 3 },
    { type: "circle", id: "bike-wheel-b", x: 72, y: 68, radius: 11, strokeWidth: 3 },
    { type: "line", id: "bike-frame-a", x: 28, y: 68, x2: 48, y2: 44, strokeWidth: 3 },
    { type: "line", id: "bike-frame-b", x: 48, y: 44, x2: 72, y2: 68, strokeWidth: 3 },
    { type: "line", id: "bike-seat", x: 42, y: 38, x2: 54, y2: 38, strokeWidth: 3 },
    { type: "line", id: "bike-handle", x: 70, y: 48, x2: 82, y2: 42, strokeWidth: 3 }
  ],
  casa: [
    { type: "rect", id: "house-body", x: 30, y: 46, width: 40, height: 32, strokeWidth: 3 },
    { type: "line", id: "house-roof-a", x: 28, y: 46, x2: 50, y2: 24, strokeWidth: 3 },
    { type: "line", id: "house-roof-b", x: 72, y: 46, x2: 50, y2: 24, strokeWidth: 3 },
    { type: "rect", id: "house-door", x: 46, y: 58, width: 9, height: 20, strokeWidth: 2 },
    { type: "rect", id: "house-window", x: 34, y: 54, width: 8, height: 8, strokeWidth: 2 }
  ],
  gato: [
    { type: "circle", id: "cat-head", x: 50, y: 46, radius: 17, strokeWidth: 3 },
    { type: "line", id: "cat-ear-a", x: 39, y: 35, x2: 35, y2: 20, strokeWidth: 3 },
    { type: "line", id: "cat-ear-b", x: 61, y: 35, x2: 65, y2: 20, strokeWidth: 3 },
    { type: "circle", id: "cat-eye-a", x: 44, y: 44, radius: 2, strokeWidth: 2 },
    { type: "circle", id: "cat-eye-b", x: 56, y: 44, radius: 2, strokeWidth: 2 },
    { type: "line", id: "cat-whisker", x: 36, y: 54, x2: 64, y2: 54, strokeWidth: 2 }
  ]
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(text = "") {
  return `${text || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeWord(word = "") {
  return normalizeText(word).replace(/[^a-z0-9]/g, "").slice(0, 18);
}

function hashNumber(text = "") {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function choose(items = [], seed = "") {
  if (!items.length) {
    return null;
  }

  return items[hashNumber(seed || nowIso()) % items.length];
}

function shuffleWord(word = "") {
  const letters = word.split("");
  const reversed = [...letters].reverse();

  if (reversed.join("") !== word) {
    return reversed.join("");
  }

  return [...letters.slice(1), letters[0]].join("");
}

function visibleProgress(word, guesses = []) {
  const guessed = new Set(guesses);
  return word
    .split("")
    .map((letter) => (guessed.has(letter) ? letter.toUpperCase() : "_"))
    .join(" ");
}

function normalizeQuestionKey(question = "") {
  return normalizeText(question).replace(/[^a-z0-9]+/g, " ").trim();
}

const GUESS_WHO_FALLBACK_QUESTIONS = [
  {
    id: "real",
    text: "Essa pessoa era real?"
  },
  {
    id: "alive",
    text: "Essa pessoa ainda esta viva?"
  },
  {
    id: "brazil",
    text: "Essa pessoa construiu a carreira principalmente no Brasil?"
  },
  {
    id: "twentieth_century",
    text: "Essa pessoa ficou famosa principalmente no seculo XX?"
  },
  {
    id: "entertainment_media",
    text: "Essa pessoa ficou famosa principalmente em entretenimento e midia?"
  },
  {
    id: "television",
    text: "O principal meio dessa pessoa era a televisao?",
    when: (facts) => factAnswer(facts, "entertainment_media") !== "no"
  },
  {
    id: "on_camera",
    text: "Essa pessoa aparecia pessoalmente diante das cameras?",
    when: (facts) => factAnswer(facts, "television") === "yes"
  },
  {
    id: "presenter",
    text: "Essa pessoa era principalmente apresentadora?",
    when: (facts) => factAnswer(facts, "on_camera") === "yes"
  },
  {
    id: "auditorium",
    text: "Essa pessoa ficou famosa por programas de auditorio?",
    when: (facts) => factAnswer(facts, "presenter") === "yes"
  },
  {
    id: "business_owner",
    text: "Essa pessoa tambem era empresaria?",
    when: (facts) => factAnswer(facts, "presenter") === "yes" || factAnswer(facts, "television") === "yes"
  },
  {
    id: "politics",
    text: "Essa pessoa ficou famosa principalmente pela politica?"
  },
  {
    id: "music",
    text: "Essa pessoa ficou famosa principalmente pela musica?",
    when: (facts) => factAnswer(facts, "entertainment_media") !== "no"
  },
  {
    id: "cinema",
    text: "Essa pessoa ficou famosa principalmente pelo cinema?",
    when: (facts) => factAnswer(facts, "entertainment_media") !== "no"
  },
  {
    id: "humor",
    text: "Essa pessoa era conhecida principalmente pelo humor?",
    when: (facts) => factAnswer(facts, "entertainment_media") !== "no"
  },
  {
    id: "journalism",
    text: "Essa pessoa era ligada principalmente ao jornalismo?"
  },
  {
    id: "sports",
    text: "Essa pessoa ficou famosa principalmente pelo esporte?"
  },
  {
    id: "science",
    text: "Essa pessoa ficou famosa principalmente pela ciencia?"
  },
  {
    id: "business",
    text: "Essa pessoa ficou famosa principalmente por negocios?"
  },
  {
    id: "internet",
    text: "Essa pessoa ficou famosa principalmente pela internet?"
  },
  {
    id: "public_reach",
    text: "Essa pessoa era conhecida nacionalmente?"
  }
];

const GUESS_WHO_QUESTION_IDS = new Map(
  GUESS_WHO_FALLBACK_QUESTIONS.map((entry) => [normalizeQuestionKey(entry.text), entry.id])
);

function normalizeGuessWhoAnswer(answer = "") {
  const text = normalizeText(answer);
  if (/\b(sim|s|yes)\b/.test(text)) return "yes";
  if (/\b(nao|n|no)\b/.test(text)) return "no";
  if (/\b(talvez|nao sei|n sei|incerto)\b/.test(text)) return "unknown";
  return "";
}

function guessWhoFactMap(guessWho = {}) {
  const facts = new Map();
  for (const fact of guessWho.knownFacts || []) {
    const key = normalizeQuestionKey(fact.question || "");
    const id = GUESS_WHO_QUESTION_IDS.get(key) || key;
    if (id) {
      facts.set(id, normalizeGuessWhoAnswer(fact.answer));
    }
  }
  return facts;
}

function factAnswer(facts, id) {
  return facts.get(id) || "";
}

function alreadyAskedGuessWhoQuestion(guessWho = {}, question = "") {
  const key = normalizeQuestionKey(question);
  if (!key) {
    return false;
  }

  const pending = normalizeQuestionKey(guessWho.pendingQuestion || "");
  if (pending === key) {
    return true;
  }

  return (guessWho.knownFacts || []).some((fact) => normalizeQuestionKey(fact.question || "") === key);
}

export function isGuessWhoClosedQuestion(text = "") {
  const normalized = normalizeText(text);

  if (!normalized.includes("?")) {
    return false;
  }

  if ((normalized.match(/\?/g) || []).length !== 1) {
    return false;
  }

  if (/\b(escolha|qual|quais|categoria|uma palavra|quer que|prefere|me diga|me diz|conte|conta|local ou nacional|financeir[ao]s?,?\s+morais|conflitos de interesse)\b/.test(normalized)) {
    return false;
  }

  if (/\b(artista|politic[ao]|parente famoso|cientista)\s*,/.test(normalized)) {
    return false;
  }

  const withoutAllowedYesNo = normalized
    .replace(/sim\s*(?:\/|ou)\s*nao/g, "")
    .replace(/nao sei/g, "");
  if (/\bou\b/.test(withoutAllowedYesNo)) {
    return false;
  }

  return true;
}

function extractLastQuestion(text = "") {
  const questions = `${text || ""}`.match(/[^.!?\n]*\?/g) || [];
  return questions.at(-1)?.trim() || "";
}

function nextGuessWhoFallbackQuestion(guessWho = {}) {
  const facts = guessWhoFactMap(guessWho);
  const pending = normalizeQuestionKey(guessWho.pendingQuestion || "");

  const next = GUESS_WHO_FALLBACK_QUESTIONS.find((entry) => {
    const key = normalizeQuestionKey(entry.text);
    const allowed = typeof entry.when === "function" ? entry.when(facts) : true;
    return allowed && key && key !== pending && !alreadyAskedGuessWhoQuestion(guessWho, entry.text);
  });

  return next?.text || "Essa pessoa era conhecida publicamente?";
}

export function enforceGuessWhoTurn(turn = {}, suitcaseState = createInitialSuitcaseState()) {
  const guessWho = suitcaseState.guessWho;

  if (
    !suitcaseState.active ||
    suitcaseState.activeExperience !== SUITCASE_EXPERIENCES.guessWho ||
    !guessWho?.active ||
    guessWho.finished
  ) {
    return turn;
  }

  const move = turn.suitcase || null;
  const action = `${move?.action || move?.suitcaseMove || ""}`.trim();

  if (action === "guess") {
    const guess = `${move.guess || move.target || ""}`.trim();
    if (!guess) {
      return turn;
    }

    const text = isGuessWhoClosedQuestion(turn.text || "")
      ? turn.text
      : `E ${guess}?`;
    return {
      ...turn,
      text,
      suitcase: {
        ...move,
        action: "guess",
        guess
      }
    };
  }

  const question = action === "ask_question"
    ? `${move.question || move.text || ""}`.trim()
    : extractLastQuestion(turn.text || "");
  const validQuestion = isGuessWhoClosedQuestion(question) ? question : "";

  if (
    validQuestion &&
    !alreadyAskedGuessWhoQuestion(guessWho, validQuestion) &&
    isGuessWhoClosedQuestion(turn.text || validQuestion)
  ) {
    return {
      ...turn,
      suitcase: {
        ...(move || {}),
        action: "ask_question",
        question: validQuestion
      }
    };
  }

  const fallbackQuestion = nextGuessWhoFallbackQuestion(guessWho);
  return {
    ...turn,
    text: fallbackQuestion,
    suitcase: {
      ...(move || {}),
      action: "ask_question",
      question: fallbackQuestion
    }
  };
}

function safeLogState(state = {}) {
  return {
    active: state.active,
    phase: state.phase,
    activeExperience: state.activeExperience,
    selectedSuitcase: state.selectedSuitcase,
    gameType: state.gameType,
    currentGame: state.currentGame?.id || null,
    questionCount: state.guessWho?.questionCount || 0,
    timer: state.instagram?.remainingTime || 0,
    selectedPerson: state.instagram?.selectedPerson?.id || null,
    selectedWord: state.currentGame?.publicState?.word || state.currentGame?.publicState?.progress || null,
    result: state.result || null
  };
}

function readInstagramParticipants() {
  try {
    const parsed = JSON.parse(fs.readFileSync(INSTAGRAM_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function selectInstagramPerson(history = [], seed = "") {
  const enabled = readInstagramParticipants().filter((person) => person?.enabled !== false);
  const recent = new Set(history.slice(-Math.max(1, enabled.length - 1)));
  const eligible = enabled.filter((person) => !recent.has(person.id));
  const selected = choose(eligible.length ? eligible : enabled, seed);

  return selected ? { ...selected } : null;
}

function interpretSuitcaseSelection(input = "") {
  const text = normalizeText(input);
  const match = text.match(/\b(?:mala\s*)?([123])\b/);
  if (match) {
    return Number(match[1]);
  }

  if (/\bprimeir[ao]\b/.test(text)) return 1;
  if (/\bsegund[ao]\b/.test(text)) return 2;
  if (/\bterceir[ao]\b/.test(text)) return 3;
  return null;
}

export function interpretSuitcaseContent(input = "") {
  const text = normalizeText(input);
  const hasPaper = /\b(papel|cartao|bilhete|folha|post-it|postit)\b/.test(text);
  const hasName = /\b(nome|pessoa|personagem|figura|celebridade|escrito|escrita|madonna|anitta|batman)\b/.test(text);
  const hasInstagram = /\b(instagram|insta|perfil|feed|stories|reels|arroba|@)\b/.test(text);
  const hasChallenge = /\b(jogo|desafio|puzzle|quebra cabeca|quebra-cabeca|enigma|charada|brincadeira)\b/.test(text);

  if (hasInstagram) {
    return { type: SUITCASE_EXPERIENCES.instagram, confidence: 0.95, reason: "instagram_keyword" };
  }

  if ((hasPaper && hasName) || /\btem um nome\b/.test(text) || /\bnome escrito\b/.test(text)) {
    return { type: SUITCASE_EXPERIENCES.guessWho, confidence: 0.92, reason: "paper_name" };
  }

  if (hasChallenge) {
    return { type: SUITCASE_EXPERIENCES.miniGame, confidence: 0.9, reason: "challenge_keyword" };
  }

  return { type: "unknown", confidence: 0.2, reason: "unclear" };
}

export function createInitialSuitcaseState() {
  return {
    active: false,
    phase: SUITCASE_PHASES.idle,
    activeExperience: null,
    gameType: null,
    selectedSuitcase: null,
    lastUserInput: null,
    lastBotIntent: null,
    lastInterpretation: null,
    visualActions: [],
    result: null,
    startedAt: null,
    updatedAt: null,
    endedAt: null,
    logs: [],
    recentMiniGames: [],
    guessWho: null,
    instagram: {
      selectedPerson: null,
      startTime: null,
      duration: 60,
      remainingTime: 0,
      selectedPost: null,
      history: [],
      finished: false
    },
    currentGame: null
  };
}

function appendLog(state, entry = {}) {
  return {
    ...state,
    logs: [
      ...(state.logs || []),
      {
        timestamp: nowIso(),
        experience: state.activeExperience,
        gameType: state.gameType,
        stateBefore: entry.stateBefore || null,
        stateAfter: entry.stateAfter || null,
        userInput: entry.userInput || null,
        botOutput: entry.botOutput || null,
        visualActions: entry.visualActions || [],
        selectedInstagramPerson: entry.selectedInstagramPerson || null,
        selectedMiniGame: entry.selectedMiniGame || null,
        questionCount: entry.questionCount ?? state.guessWho?.questionCount ?? null,
        guesses: entry.guesses ?? state.guessWho?.guesses ?? null,
        result: entry.result || state.result || null,
        duration: entry.duration || null,
        action: entry.action || "state_change"
      }
    ].slice(-120)
  };
}

function withActions(state, actions = []) {
  return {
    ...state,
    visualActions: actions,
    updatedAt: nowIso()
  };
}

function startGuessWho(state, { source = "system" } = {}) {
  const actions = [
    { type: "FULLSCREEN_TEXT", durationMs: 1600, payload: { text: "NOME ESCONDIDO" } }
  ];
  const next = withActions({
    ...state,
    active: true,
    phase: SUITCASE_PHASES.activeExperience,
    activeExperience: SUITCASE_EXPERIENCES.guessWho,
    gameType: "guess_who",
    result: null,
    guessWho: {
      gameType: "guess_who",
      active: true,
      questionCount: 0,
      maxQuestions: 12,
      guesses: [],
      maxGuesses: 3,
      knownFacts: [],
      rejectedHypotheses: [],
      currentHypothesis: null,
      pendingQuestion: null,
      pendingGuess: null,
      winner: null,
      finished: false
    }
  }, actions);

  return {
    state: appendLog(next, {
      action: "start_guess_who",
      selectedMiniGame: "guess_who",
      visualActions: actions,
      result: source
    }),
    events: actions,
    result: { type: "experience_started", experience: SUITCASE_EXPERIENCES.guessWho }
  };
}

function startInstagram(state, { source = "system", nextPerson = false } = {}) {
  const currentHistory = state.instagram?.history || [];
  const selectedPerson = selectInstagramPerson(
    nextPerson ? currentHistory : currentHistory,
    `${state.selectedSuitcase}:${state.startedAt}:${currentHistory.join(",")}:${source}`
  );
  const startTime = nowIso();
  const history = selectedPerson
    ? [...currentHistory, selectedPerson.id].slice(-20)
    : currentHistory;
  const actions = [
    { type: "FULLSCREEN_TEXT", durationMs: 1400, payload: { text: "ESCOLHENDO UMA VIDA..." } },
    {
      type: "FULLSCREEN_TEXT",
      delayMs: 1300,
      durationMs: 2200,
      payload: { text: selectedPerson ? `HOJE EU QUERO VER A VIDA DE ${selectedPerson.name}` : "NINGUEM CADASTRADO" }
    },
    ...(selectedPerson
      ? [
        {
          type: "SHOW_INSTAGRAM",
          delayMs: 3200,
          durationMs: 61000,
          payload: { person: selectedPerson, duration: 60 }
        },
        {
          type: "COUNTDOWN",
          delayMs: 3200,
          durationMs: 61000,
          payload: { duration: 60, label: "UM MINUTO DE VIDA", experience: "instagram" }
        }
      ]
      : [])
  ];
  const next = withActions({
    ...state,
    active: true,
    phase: SUITCASE_PHASES.activeExperience,
    activeExperience: SUITCASE_EXPERIENCES.instagram,
    gameType: "instagram",
    result: selectedPerson ? null : "no_instagram_participants",
    instagram: {
      selectedPerson,
      startTime,
      duration: 60,
      remainingTime: 60,
      selectedPost: null,
      history,
      finished: !selectedPerson
    }
  }, actions);

  return {
    state: appendLog(next, {
      action: nextPerson ? "next_instagram_person" : "start_instagram",
      selectedInstagramPerson: selectedPerson?.id || null,
      visualActions: actions,
      duration: 60
    }),
    events: actions,
    result: { type: "experience_started", experience: SUITCASE_EXPERIENCES.instagram, selectedPerson }
  };
}

function createMiniGame(id, state) {
  const seed = `${state.startedAt}:${state.selectedSuitcase}:${state.recentMiniGames.join(",")}`;
  const word = choose(WORDS, `${seed}:${id}`) || "teatro";

  if (id === "hangman") {
    return {
      id,
      name: "FORCA",
      active: true,
      finished: false,
      winner: null,
      attempts: 0,
      maxAttempts: 8,
      publicState: {
        progress: visibleProgress(word),
        wrongLetters: [],
        attemptsLeft: 6
      },
      privateState: {
        word,
        guessedLetters: []
      }
    };
  }

  if (id === "drawing_guess") {
    const drawingWord = choose(Object.keys(DRAWING_SHAPES), seed) || "bicicleta";
    return {
      id,
      name: "ADIVINHE O DESENHO",
      active: true,
      finished: false,
      winner: null,
      attempts: 0,
      maxAttempts: DRAWING_SHAPES[drawingWord].length + 2,
      publicState: {
        prompt: "adivinhe o desenho",
        guesses: [],
        revealedSteps: 1
      },
      privateState: {
        word: drawingWord,
        shapes: DRAWING_SHAPES[drawingWord]
      }
    };
  }

  if (id === "scrambled_word") {
    return {
      id,
      name: "PALAVRA EMBARALHADA",
      active: true,
      finished: false,
      winner: null,
      attempts: 0,
      maxAttempts: 8,
      publicState: {
        scrambled: shuffleWord(word),
        hints: [],
        guesses: []
      },
      privateState: { word }
    };
  }

  if (id === "riddle") {
    const riddle = choose(RIDDLES, seed) || RIDDLES[0];
    return {
      id,
      name: "ENIGMA",
      active: true,
      finished: false,
      winner: null,
      attempts: 0,
      maxAttempts: 6,
      publicState: {
        prompt: riddle.prompt,
        hints: [],
        guesses: []
      },
      privateState: riddle
    };
  }

  const rule = choose(RULES, seed) || RULES[0];
  return {
    id: "guess_the_rule",
    name: "QUAL E A REGRA?",
    active: true,
    finished: false,
    winner: null,
    attempts: 0,
    maxAttempts: 8,
    publicState: {
      examples: rule.examples,
      tests: []
    },
    privateState: rule
  };
}

function startMiniGame(state, { requestedGame = null, source = "system" } = {}) {
  const eligible = requestedGame && MINI_GAME_IDS.includes(requestedGame)
    ? [requestedGame]
    : MINI_GAME_IDS.filter((id) => !(state.recentMiniGames || []).slice(0, 3).includes(id));
  const id = choose(eligible.length ? eligible : MINI_GAME_IDS, `${state.startedAt}:${source}:${requestedGame || ""}`);
  const currentGame = createMiniGame(id, state);
  const actions = [
    { type: "FULLSCREEN_TEXT", durationMs: 1500, payload: { text: currentGame.name } },
    ...visualActionsForMiniGame(currentGame, "start")
  ];
  const next = withActions({
    ...state,
    active: true,
    phase: SUITCASE_PHASES.activeExperience,
    activeExperience: SUITCASE_EXPERIENCES.miniGame,
    gameType: currentGame.id,
    currentGame,
    recentMiniGames: [currentGame.id, ...(state.recentMiniGames || []).filter((item) => item !== currentGame.id)].slice(0, 8),
    result: null
  }, actions);

  return {
    state: appendLog(next, {
      action: "start_minigame",
      selectedMiniGame: currentGame.id,
      visualActions: actions
    }),
    events: actions,
    result: { type: "experience_started", experience: SUITCASE_EXPERIENCES.miniGame, selectedMiniGame: currentGame.id }
  };
}

function visualActionsForMiniGame(game, reason = "update") {
  if (!game) {
    return [];
  }

  if (game.id === "drawing_guess") {
    const count = Math.min(game.publicState.revealedSteps || 1, game.privateState.shapes.length);
    return [
      ...(reason === "start" ? [{ type: "CLEAR_DRAWING", durationMs: 100, payload: {} }] : []),
      {
        type: "DRAWING",
        durationMs: 2200,
        payload: {
          revealMs: 1400,
          shapes: game.privateState.shapes.slice(count - 1, count)
        }
      }
    ];
  }

  if (["scrambled_word", "riddle", "guess_the_rule"].includes(game.id)) {
    return [{
      type: "SHOW_PUZZLE",
      durationMs: 12000,
      payload: {
        gameId: game.id,
        title: game.name,
        publicState: game.publicState
      }
    }];
  }

  return [{
    type: "UPDATE_HANGMAN",
    durationMs: 12000,
    payload: {
      publicState: game.publicState
    }
  }];
}

export function startSuitcases(state = createInitialSuitcaseState(), { source = "operator" } = {}) {
  const actions = [
    { type: "FULLSCREEN_TEXT", durationMs: 1800, payload: { text: "ESCOLHA UMA MALA" } }
  ];
  const next = withActions({
    ...createInitialSuitcaseState(),
    active: true,
    phase: SUITCASE_PHASES.waitingSelection,
    startedAt: nowIso()
  }, actions);

  return {
    state: appendLog(next, { action: "start_suitcases", visualActions: actions, result: source }),
    events: actions,
    result: { type: "suitcases_started" }
  };
}

export function resetSuitcases(state = createInitialSuitcaseState(), { source = "operator" } = {}) {
  const next = createInitialSuitcaseState();
  return {
    state: appendLog(next, { action: "reset_suitcases", result: source }),
    events: [{ type: "RETURN_TO_CHAT", durationMs: 100, payload: {} }],
    result: { type: "suitcases_reset" }
  };
}

export function abortSuitcases(state = createInitialSuitcaseState(), { source = "operator" } = {}) {
  const actions = [
    { type: "HIDE_INSTAGRAM", durationMs: 100, payload: {} },
    { type: "CLEAR_DRAWING", durationMs: 100, payload: {} },
    { type: "RETURN_TO_CHAT", durationMs: 100, payload: {} }
  ];
  const next = withActions({
    ...state,
    active: false,
    phase: SUITCASE_PHASES.aborted,
    result: "aborted",
    endedAt: nowIso(),
    guessWho: state.guessWho ? { ...state.guessWho, active: false, finished: true } : null,
    currentGame: state.currentGame ? { ...state.currentGame, active: false, finished: true } : null,
    instagram: {
      ...(state.instagram || createInitialSuitcaseState().instagram),
      remainingTime: 0,
      finished: true
    }
  }, actions);

  return {
    state: appendLog(next, { action: "abort_suitcases", result: source, visualActions: actions }),
    events: actions,
    result: { type: "suitcases_aborted" }
  };
}

export function forceSuitcaseExperience(state, experience, options = {}) {
  const base = state?.active ? state : startSuitcases(state, options).state;

  if (experience === SUITCASE_EXPERIENCES.guessWho || experience === "name") {
    return startGuessWho(base, options);
  }

  if (experience === SUITCASE_EXPERIENCES.instagram || experience === "instagram") {
    return startInstagram(base, options);
  }

  return startMiniGame(base, {
    source: options.source || "operator",
    requestedGame: options.requestedGame || null
  });
}

export function finishSuitcases(state = createInitialSuitcaseState(), result = "finished", { source = "system" } = {}) {
  const wonByMachine = result === "machine_win";
  const wonByAudience = result === "audience_win";
  const actions = [
    ...(wonByMachine ? [{ type: "SHOW_WIN", durationMs: 2400, payload: { text: "VITORIA DA MAQUINA" } }] : []),
    ...(wonByAudience ? [{ type: "SHOW_LOSE", durationMs: 2400, payload: { text: "PUBLICO DERROTOU A MAQUINA" } }] : []),
    { type: "HIDE_INSTAGRAM", delayMs: wonByMachine || wonByAudience ? 2200 : 0, durationMs: 100, payload: {} },
    { type: "CLEAR_DRAWING", delayMs: wonByMachine || wonByAudience ? 2200 : 0, durationMs: 100, payload: {} },
    { type: "RETURN_TO_CHAT", delayMs: wonByMachine || wonByAudience ? 2400 : 0, durationMs: 100, payload: {} }
  ];
  const next = withActions({
    ...state,
    active: false,
    phase: SUITCASE_PHASES.finished,
    result,
    endedAt: nowIso(),
    guessWho: state.guessWho ? {
      ...state.guessWho,
      active: false,
      finished: true,
      winner: wonByMachine ? "machine" : wonByAudience ? "audience" : state.guessWho.winner
    } : null,
    currentGame: state.currentGame ? {
      ...state.currentGame,
      active: false,
      finished: true,
      winner: wonByMachine ? "machine" : wonByAudience ? "audience" : state.currentGame.winner
    } : null,
    instagram: {
      ...(state.instagram || createInitialSuitcaseState().instagram),
      remainingTime: 0,
      finished: true
    }
  }, actions);

  return {
    state: appendLog(next, { action: "finish_suitcases", result: `${result}:${source}`, visualActions: actions }),
    events: actions,
    result: { type: "suitcases_finished", result }
  };
}

export function finishInstagramTimer(state = createInitialSuitcaseState()) {
  if (state.activeExperience !== SUITCASE_EXPERIENCES.instagram || state.instagram?.finished) {
    return { state, events: [], result: null };
  }

  const actions = [
    { type: "HIDE_INSTAGRAM", durationMs: 100, payload: {} },
    { type: "FULLSCREEN_TEXT", durationMs: 2200, payload: { text: "ACESSO ENCERRADO" } },
    { type: "RETURN_TO_CHAT", delayMs: 2200, durationMs: 100, payload: {} }
  ];
  const next = withActions({
    ...state,
    active: false,
    phase: SUITCASE_PHASES.finished,
    result: "instagram_timeout",
    endedAt: nowIso(),
    instagram: {
      ...state.instagram,
      remainingTime: 0,
      finished: true
    }
  }, actions);

  return {
    state: appendLog(next, { action: "instagram_timer_finished", visualActions: actions, duration: 60, result: "instagram_timeout" }),
    events: actions,
    result: { type: "instagram_timer_finished" }
  };
}

export function advanceSuitcases(state = createInitialSuitcaseState(), input = "") {
  if (!state.active) {
    return { state, result: null, events: [] };
  }

  const stateBefore = safeLogState(state);
  const base = {
    ...state,
    lastUserInput: input,
    updatedAt: nowIso()
  };

  if (base.phase === SUITCASE_PHASES.waitingSelection) {
    const selectedSuitcase = interpretSuitcaseSelection(input);
    if (!selectedSuitcase) {
      const next = withActions(base, []);
      return {
        state: appendLog(next, {
          action: "selection_unclear",
          userInput: input,
          stateBefore,
          stateAfter: safeLogState(next),
          result: "unclear"
        }),
        events: [],
        result: { type: "selection_unclear" }
      };
    }

    const actions = [
      { type: "FLASH_TEXT", durationMs: 1400, payload: { text: `MALA ${selectedSuitcase}` } }
    ];
    const next = withActions({
      ...base,
      selectedSuitcase,
      phase: SUITCASE_PHASES.waitingContent
    }, actions);

    return {
      state: appendLog(next, {
        action: "suitcase_selected",
        userInput: input,
        visualActions: actions,
        stateBefore,
        stateAfter: safeLogState(next),
        result: selectedSuitcase
      }),
      events: actions,
      result: { type: "suitcase_selected", selectedSuitcase }
    };
  }

  if (base.phase === SUITCASE_PHASES.waitingContent) {
    const interpretation = interpretSuitcaseContent(input);
    const withInterpretation = {
      ...base,
      lastInterpretation: interpretation
    };

    if (interpretation.type === SUITCASE_EXPERIENCES.guessWho) {
      return startGuessWho(withInterpretation);
    }

    if (interpretation.type === SUITCASE_EXPERIENCES.instagram) {
      return startInstagram(withInterpretation);
    }

    if (interpretation.type === SUITCASE_EXPERIENCES.miniGame) {
      return startMiniGame(withInterpretation);
    }

    const next = withActions(withInterpretation, []);
    return {
      state: appendLog(next, {
        action: "content_unclear",
        userInput: input,
        stateBefore,
        stateAfter: safeLogState(next),
        result: interpretation.reason
      }),
      events: [],
      result: { type: "content_unclear", interpretation }
    };
  }

  if (base.activeExperience === SUITCASE_EXPERIENCES.guessWho) {
    return advanceGuessWho(base, input, stateBefore);
  }

  if (base.activeExperience === SUITCASE_EXPERIENCES.miniGame) {
    return advanceMiniGame(base, input, stateBefore);
  }

  if (base.activeExperience === SUITCASE_EXPERIENCES.instagram) {
    const next = appendLog(withActions(base, []), {
      action: "instagram_public_input",
      userInput: input,
      stateBefore,
      stateAfter: safeLogState(base)
    });
    return { state: next, result: { type: "instagram_public_input" }, events: [] };
  }

  return { state: base, result: null, events: [] };
}

function normalizeYesNo(input = "") {
  const text = normalizeText(input);
  if (/\b(sim|s|yes|acertou|isso|exato|correto)\b/.test(text)) return "sim";
  if (/\b(nao|n|no|errou|errado|nunca)\b/.test(text)) return "nao";
  if (/\b(nao sei|talvez|depende|mais ou menos)\b/.test(text)) return "nao_sei";
  return null;
}

function advanceGuessWho(state, input, stateBefore) {
  const guessWho = state.guessWho;
  const answer = normalizeYesNo(input);

  if (!guessWho || guessWho.finished) {
    return { state, result: null, events: [] };
  }

  if (!answer) {
    const next = appendLog(withActions(state, []), {
      action: "guess_who_unstructured_input",
      userInput: input,
      stateBefore,
      stateAfter: safeLogState(state)
    });
    return { state: next, result: { type: "guess_who_unstructured_input" }, events: [] };
  }

  if (guessWho.pendingGuess) {
    const hit = answer === "sim";
    const guesses = [...guessWho.guesses, { guess: guessWho.pendingGuess, hit }].slice(-8);
    const exhausted = guesses.length >= guessWho.maxGuesses;
    const result = hit ? "machine_win" : exhausted ? "audience_win" : null;
    const nextGuessWho = {
      ...guessWho,
      guesses,
      pendingGuess: null,
      rejectedHypotheses: hit
        ? guessWho.rejectedHypotheses
        : [...guessWho.rejectedHypotheses, guessWho.pendingGuess].slice(-12),
      active: !result,
      finished: Boolean(result),
      winner: hit ? "machine" : exhausted ? "audience" : null
    };
    const next = {
      ...state,
      guessWho: nextGuessWho,
      result,
      active: result ? false : state.active,
      phase: result ? SUITCASE_PHASES.finished : state.phase,
      endedAt: result ? nowIso() : state.endedAt
    };

    if (result) {
      return finishSuitcases(next, result);
    }

    const logged = appendLog(withActions(next, []), {
      action: "guess_who_guess_answered",
      userInput: input,
      stateBefore,
      stateAfter: safeLogState(next),
      guesses,
      result: hit ? "guess_hit" : "guess_miss"
    });
    return { state: logged, result: { type: "guess_answer", answer, hit, exhausted }, events: [] };
  }

  const questionCount = Math.min(guessWho.maxQuestions, guessWho.questionCount + (guessWho.pendingQuestion ? 1 : 0));
  const exhausted = questionCount >= guessWho.maxQuestions;
  const nextGuessWho = {
    ...guessWho,
    questionCount,
    pendingQuestion: null,
    knownFacts: [
      ...guessWho.knownFacts,
      {
        question: guessWho.pendingQuestion || "pergunta anterior",
        answer
      }
    ].slice(-16),
    active: !exhausted,
    finished: exhausted,
    winner: exhausted ? "audience" : null
  };
  const next = {
    ...state,
    guessWho: nextGuessWho,
    result: exhausted ? "audience_win" : null
  };

  if (exhausted) {
    return finishSuitcases(next, "audience_win");
  }

  const logged = appendLog(withActions(next, []), {
    action: "guess_who_answer",
    userInput: input,
    stateBefore,
    stateAfter: safeLogState(next),
    questionCount,
    result: answer
  });
  return { state: logged, result: { type: "yes_no_answer", answer, questionCount }, events: [] };
}

function advanceMiniGame(state, input, stateBefore) {
  const game = state.currentGame;
  if (!game || game.finished) {
    return { state, result: null, events: [] };
  }

  const normalized = normalizeWord(input);
  let nextGame = {
    ...game,
    attempts: game.attempts + 1
  };
  let result = "miss";
  let events = [];

  if (game.id === "hangman") {
    const word = game.privateState.word;
    const guessedLetters = new Set(game.privateState.guessedLetters || []);
    const wrongLetters = [...(game.publicState.wrongLetters || [])];

    if (normalized.length === 1 && word.includes(normalized)) {
      guessedLetters.add(normalized);
      result = "letter_hit";
    } else if (normalized === word) {
      for (const letter of word) guessedLetters.add(letter);
      result = "word_hit";
    } else if (normalized && !wrongLetters.includes(normalized)) {
      wrongLetters.push(normalized);
      result = normalized.length === 1 ? "letter_miss" : "word_miss";
    }

    const progress = visibleProgress(word, [...guessedLetters]);
    const attemptsLeft = Math.max(0, 6 - wrongLetters.length);
    const won = !progress.includes("_");
    const lost = attemptsLeft <= 0 || nextGame.attempts >= game.maxAttempts;
    nextGame = {
      ...nextGame,
      active: !(won || lost),
      finished: won || lost,
      winner: won ? "audience" : lost ? "machine" : null,
      publicState: { progress, wrongLetters, attemptsLeft },
      privateState: { ...game.privateState, guessedLetters: [...guessedLetters] }
    };
  } else if (game.id === "drawing_guess") {
    const won = normalized === normalizeWord(game.privateState.word);
    const revealedSteps = Math.min(game.privateState.shapes.length, (game.publicState.revealedSteps || 1) + 1);
    const lost = !won && nextGame.attempts >= game.maxAttempts;
    nextGame = {
      ...nextGame,
      active: !(won || lost),
      finished: won || lost,
      winner: won ? "audience" : lost ? "machine" : null,
      publicState: {
        ...game.publicState,
        guesses: [...(game.publicState.guesses || []), input].slice(-8),
        revealedSteps
      }
    };
  } else if (game.id === "scrambled_word") {
    const won = normalized === normalizeWord(game.privateState.word);
    const lost = !won && nextGame.attempts >= game.maxAttempts;
    const hints = [...(game.publicState.hints || [])];
    if (!won && nextGame.attempts % 2 === 0 && hints.length < game.privateState.word.length) {
      hints.push(`${hints.length + 1}: ${game.privateState.word[hints.length].toUpperCase()}`);
    }
    nextGame = {
      ...nextGame,
      active: !(won || lost),
      finished: won || lost,
      winner: won ? "audience" : lost ? "machine" : null,
      publicState: {
        ...game.publicState,
        hints,
        guesses: [...(game.publicState.guesses || []), input].slice(-8)
      }
    };
  } else if (game.id === "riddle") {
    const won = normalized === normalizeWord(game.privateState.answer);
    const lost = !won && nextGame.attempts >= game.maxAttempts;
    const hintCount = Math.min(game.privateState.hints.length, Math.floor(nextGame.attempts / 2));
    nextGame = {
      ...nextGame,
      active: !(won || lost),
      finished: won || lost,
      winner: won ? "audience" : lost ? "machine" : null,
      publicState: {
        ...game.publicState,
        hints: game.privateState.hints.slice(0, hintCount),
        guesses: [...(game.publicState.guesses || []), input].slice(-8)
      }
    };
  } else {
    const accepted = game.privateState.test(input);
    const declaredRule = /\b(regra|criterio|aceita|letra|par|consoante|comeca)\b/.test(normalizeText(input));
    const won = declaredRule && normalizeText(input).includes(normalizeText(game.privateState.label).split(" ").at(-1));
    const lost = !won && nextGame.attempts >= game.maxAttempts;
    result = accepted ? "accepted_example" : "rejected_example";
    nextGame = {
      ...nextGame,
      active: !(won || lost),
      finished: won || lost,
      winner: won ? "audience" : lost ? "machine" : null,
      publicState: {
        ...game.publicState,
        tests: [...(game.publicState.tests || []), { input, accepted }].slice(-10)
      }
    };
  }

  events = visualActionsForMiniGame(nextGame, "update");

  if (nextGame.finished) {
    return finishSuitcases({
      ...state,
      currentGame: nextGame,
      result: nextGame.winner === "audience" ? "audience_win" : "machine_win"
    }, nextGame.winner === "audience" ? "audience_win" : "machine_win");
  }

  const next = appendLog(withActions({
    ...state,
    currentGame: nextGame,
    gameType: nextGame.id
  }, events), {
    action: "minigame_advance",
    userInput: input,
    stateBefore,
    stateAfter: safeLogState({ ...state, currentGame: nextGame }),
    selectedMiniGame: nextGame.id,
    visualActions: events,
    result
  });

  return {
    state: next,
    result: { type: "minigame_advance", gameId: nextGame.id, result, attempts: nextGame.attempts },
    events
  };
}

export function applySuitcaseMove(state = createInitialSuitcaseState(), move = {}) {
  if (!state.active || !move) {
    return { state, applied: false, events: [], result: null };
  }

  const action = `${move.action || move.suitcaseMove || ""}`.trim();
  const base = {
    ...state,
    lastBotIntent: action || state.lastBotIntent,
    updatedAt: nowIso()
  };

  if (action === "ask_question" && base.guessWho?.active) {
    const question = `${move.question || move.text || ""}`.trim().slice(0, 200);
    const next = appendLog(withActions({
      ...base,
      guessWho: {
        ...base.guessWho,
        pendingQuestion: question || base.guessWho.pendingQuestion,
        currentHypothesis: move.currentHypothesis || base.guessWho.currentHypothesis
      }
    }, []), {
      action,
      botOutput: question,
      questionCount: base.guessWho.questionCount
    });
    return { state: next, applied: Boolean(question), events: [], result: { type: "question_registered", question } };
  }

  if (action === "guess" && base.guessWho?.active) {
    const guess = `${move.guess || move.target || ""}`.trim().slice(0, 120);
    const next = appendLog(withActions({
      ...base,
      guessWho: {
        ...base.guessWho,
        pendingGuess: guess,
        currentHypothesis: guess || base.guessWho.currentHypothesis
      }
    }, []), {
      action,
      botOutput: guess,
      guesses: [...(base.guessWho.guesses || []), { guess, pending: true }]
    });
    return { state: next, applied: Boolean(guess), events: [], result: { type: "guess_registered", guess } };
  }

  if (action === "select_post" && base.activeExperience === SUITCASE_EXPERIENCES.instagram) {
    const selectedPost = `${move.postId || move.label || move.text || ""}`.trim().slice(0, 120);
    const next = appendLog(withActions({
      ...base,
      instagram: {
        ...base.instagram,
        selectedPost
      }
    }, []), {
      action,
      botOutput: selectedPost
    });
    return { state: next, applied: Boolean(selectedPost), events: [], result: { type: "post_selected", selectedPost } };
  }

  if (action === "finish") {
    return finishSuitcases(base, move.result || "finished", { source: "ai" });
  }

  return { state: base, applied: false, events: [], result: null };
}

export function suitcaseContextBlock(state = {}) {
  const suitcase = state.suitcase || createInitialSuitcaseState();
  const instagramParticipants = readInstagramParticipants()
    .filter((person) => person.enabled !== false)
    .map((person) => ({
      id: person.id,
      name: person.name,
      instagramHandle: person.instagramHandle,
      enabled: person.enabled !== false
    }));

  return [
    "SUITCASE EXPERIENCE STATE:",
    "As 3 malas sao uma dinamica viva, nao menu rigido. O codigo controla fases, limites, vitoria/derrota, timer, pessoa selecionada e minigame.",
    "Voce controla a fala: improvisa, provoca, comenta, pergunta e muda estrategia sem expor estado tecnico.",
    "NUNCA escreva no texto publico nomes tecnicos como suitcase, suitcase.action, ask_question, guess, select_post, envelope, JSON, campo estruturado, registrar ou pergunta formal. Esses nomes so podem existir no objeto estruturado, nunca na fala da Caixa.",
    "Se phase = WAITING_FOR_SUITCASE_SELECTION, conduza para uma escolha curta de mala.",
    "Se phase = WAITING_FOR_SUITCASE_CONTENT, pergunte naturalmente o que tem dentro.",
    "Mala 1 / guess_who: sua missao e DESCOBRIR A PESSOA. Faca EXCLUSIVAMENTE uma pergunta por vez, respondivel por sim, nao ou nao sei. Nunca peca categoria, uma palavra, local/nacional, escolha entre opcoes ou permissao para palpite. A Caixa decide a proxima pergunta e decide quando arriscar o nome.",
    "Maria Antonieta e 20 Questions, nao interrogatorio solto: ignore a conversa anterior como pista da identidade, pense em espaco de hipoteses, separe dominio, meio, profissao e papel publico, e escolha a pergunta que mais reduz candidatos nos dois resultados possiveis.",
    "Comece amplo: pessoa real/ficticia, viva/morta, epoca, Brasil/exterior, dominio de fama. Depois refine meio e papel. Televisao e categoria de primeira classe: apresentador, comunicador, jornalista, humorista, empresaria, jurada, dona de emissora, produtora ou personalidade nao sao automaticamente ator/cinema.",
    "Nao repita pergunta ja respondida. Se tres negativas derrubarem um ramo, mude de eixo. Se uma categoria ampla como artes/cultura nao encaixar, reinterprete como entretenimento, midia, televisao, radio, humor, apresentacao, producao, moda ou outro meio em vez de cavar uma categoria obscura.",
    "Palpites devem ser ganhos. Nao chute nome com poucos fatos; quando restarem poucos candidatos fortes, faca uma pergunta discriminatoria entre eles ou arrisque o nome. Comentarios nao contam, mas nao podem substituir a pergunta objetiva.",
    "Se o publico der uma categoria por conta propria, use como fato informal e volte imediatamente a uma pergunta fechada. Depois de acumular fatos suficientes, arrisque um nome; nao pergunte se o publico quer palpite.",
    "Quando fizer pergunta fechada, coloque a pergunta no objeto suitcase com action ask_question, mas no text escreva somente a fala natural da Caixa. Quando der palpite, coloque o palpite no objeto suitcase com action guess, mas no text escreva somente o palpite como fala publica.",
    "Mala 2 / instagram: provocacao performatica, sem diagnostico psicologico, atributos sensiveis ou profiling como fato. Pode pedir voltar/parar/destacar como fala, mas conteudo real depende do que estiver configurado/visivel.",
    "Mala 3 / mini_game: reaja a tentativas e continue o jogo ativo. Nao invente progresso visual diferente do estado.",
    "Envelope opcional:",
    "\"suitcase\": { \"action\": \"ask_question\", \"question\": \"Sou uma pessoa real?\", \"currentHypothesis\": \"...\" }",
    "\"suitcase\": { \"action\": \"guess\", \"guess\": \"Marie Curie\" }",
    "\"suitcase\": { \"action\": \"select_post\", \"postId\": \"1\" }",
    "Exemplo correto: text = \"Essa pessoa era conhecida publicamente?\" e suitcase.action = ask_question. Exemplo proibido: \"vou registrar ask_question\".",
    JSON.stringify({
      suitcase: {
        active: suitcase.active,
        phase: suitcase.phase,
        activeExperience: suitcase.activeExperience,
        selectedSuitcase: suitcase.selectedSuitcase,
        gameType: suitcase.gameType,
        lastUserInput: suitcase.lastUserInput,
        lastBotIntent: suitcase.lastBotIntent,
        lastInterpretation: suitcase.lastInterpretation,
        result: suitcase.result
      },
      guessWho: suitcase.guessWho,
      instagram: suitcase.instagram,
      currentGame: suitcase.currentGame
        ? {
          id: suitcase.currentGame.id,
          name: suitcase.currentGame.name,
          active: suitcase.currentGame.active,
          finished: suitcase.currentGame.finished,
          winner: suitcase.currentGame.winner,
          attempts: suitcase.currentGame.attempts,
          maxAttempts: suitcase.currentGame.maxAttempts,
          publicState: suitcase.currentGame.publicState
        }
        : null,
      privateForModel: suitcase.currentGame?.active
        ? {
          answer: suitcase.currentGame.privateState?.word || suitcase.currentGame.privateState?.answer || suitcase.currentGame.privateState?.label || null,
          ruleId: suitcase.currentGame.id === "guess_the_rule" ? suitcase.currentGame.privateState?.id : null
        }
        : {},
      instagramParticipants
    }, null, 2)
  ].join("\n");
}
