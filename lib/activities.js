import { randomUUID } from "node:crypto";
import { PERFORMANCE_EVENT_TYPES } from "./performanceEvents.js";

export const ACTIVITY_TYPES = {
  hangman: "HANGMAN",
  guessDrawing: "GUESS_DRAWING",
  guessWord: "GUESS_WORD",
  puzzle: "PUZZLE"
};

const FALLBACK_WORDS = [
  "teatro",
  "arquivo",
  "gorro",
  "memoria",
  "trabalho",
  "silencio",
  "suspeito"
];

function normalizeWord(word = "") {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 18);
}

function visibleProgress(word, guesses = []) {
  const guessed = new Set(guesses);

  return word
    .split("")
    .map((letter) => (guessed.has(letter) ? letter.toUpperCase() : "_"))
    .join(" ");
}

export function chooseHangmanWord({ memories = [], conversation = [], explicitWord = "" } = {}) {
  const candidates = [
    explicitWord,
    ...memories.map((memory) => memory.content || ""),
    ...conversation.map((message) => message.content || "")
  ]
    .flatMap((text) => `${text}`.split(/\s+/))
    .map(normalizeWord)
    .filter((word) => word.length >= 4 && word.length <= 12);

  if (candidates.length) {
    return candidates[candidates.length - 1];
  }

  return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
}

export function createHangmanActivity({ word, source = "operator" } = {}) {
  const secretWord = normalizeWord(word) || chooseHangmanWord();

  return {
    id: randomUUID(),
    type: ACTIVITY_TYPES.hangman,
    status: "active",
    source,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    participants: [],
    step: "guess",
    publicState: {
      progress: visibleProgress(secretWord),
      wrongGuesses: [],
      guessCount: 0,
      maxErrors: 6
    },
    privateState: {
      secretWord
    },
    rules: [
      "aceita letra ou palavra",
      "nao anunciar como game show",
      "pode ser pausado ou abandonado"
    ]
  };
}

export function activityContextBlock(activities = []) {
  const publicActivities = activities
    .filter((activity) => activity.status === "active" || activity.status === "paused")
    .map((activity) => ({
      id: activity.id,
      type: activity.type,
      status: activity.status,
      step: activity.step,
      publicState: activity.publicState,
      rules: activity.rules
    }));

  if (!publicActivities.length) {
    return "";
  }

  return [
    "ATIVIDADES ESTRUTURADAS ATIVAS:",
    "Estado essencial de jogos vem daqui. Nao invente progresso diferente.",
    JSON.stringify(publicActivities, null, 2)
  ].join("\n");
}

export function applyHangmanGuess(activity, rawGuess = "") {
  if (!activity || activity.type !== ACTIVITY_TYPES.hangman || activity.status !== "active") {
    return null;
  }

  const guess = normalizeWord(rawGuess);
  const secretWord = activity.privateState.secretWord;
  const correctLetters = new Set(activity.publicState.progress.replace(/\s/g, "").toLowerCase().replace(/_/g, ""));
  const wrongGuesses = [...activity.publicState.wrongGuesses];
  let status = "active";
  let result = "invalid";

  if (!guess) {
    return { activity, result: "invalid", events: [] };
  }

  if (guess.length === 1) {
    if (secretWord.includes(guess)) {
      correctLetters.add(guess);
      result = "letter-hit";
    } else if (!wrongGuesses.includes(guess)) {
      wrongGuesses.push(guess);
      result = "letter-miss";
    } else {
      result = "repeat";
    }
  } else if (guess === secretWord) {
    for (const letter of secretWord) {
      correctLetters.add(letter);
    }
    result = "word-hit";
  } else {
    wrongGuesses.push(guess);
    result = "word-miss";
  }

  const progress = visibleProgress(secretWord, [...correctLetters]);
  if (!progress.includes("_")) {
    status = "completed";
  } else if (wrongGuesses.length >= activity.publicState.maxErrors) {
    status = "completed";
    result = "failed";
  }

  const nextActivity = {
    ...activity,
    status,
    updatedAt: new Date().toISOString(),
    publicState: {
      ...activity.publicState,
      progress,
      wrongGuesses,
      guessCount: activity.publicState.guessCount + 1
    }
  };

  const events = [
    {
      type: PERFORMANCE_EVENT_TYPES.fullscreenText,
      durationMs: 1600,
      payload: { text: progress }
    }
  ];

  if (result.includes("miss") || result === "failed") {
    events.push({
      type: PERFORMANCE_EVENT_TYPES.flashText,
      durationMs: 220,
      payload: { text: "NAO." }
    });
  }

  return { activity: nextActivity, result, events };
}
