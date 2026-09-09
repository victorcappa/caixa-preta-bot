import { randomUUID } from "node:crypto";
import { chooseHangmanWord } from "../activities.js";
import { PERFORMANCE_EVENT_TYPES } from "../performanceEvents.js";
import { getParticipantPool } from "../participants.js";
import {
  controlVerdadeOuBolo,
  createVerdadeOuBoloGameData,
  isVerdadeOuBolo,
  VERDADE_OU_BOLO_ID
} from "./verdade-ou-bolo/controller.js";
import { getHostMechanicById, hostGameMechanics } from "./games.js";

const DEFAULT_CAPABILITIES = {
  canvas: true,
  phoneProjection: true,
  countdown: true,
  teams: true,
  webSearch: process.env.CAIXA_PRETA_WEB_SEARCH !== "false"
};

const GAME_ALIASES = new Map([
  ["", null],
  ["random", null],
  ["aleatorio", null],
  ["forca", "hangman"],
  ["hangman", "hangman"],
  ["maria", "who_am_i"],
  ["mariaantonieta", "who_am_i"],
  ["whoami", "who_am_i"],
  ["quem sou eu", "who_am_i"],
  ["quemsoueu", "who_am_i"],
  ["mestre", "master_mandou"],
  ["mestremandou", "master_mandou"],
  ["caixamandou", "master_mandou"],
  ["simon", "master_mandou"],
  ["cards", "cards_style_fill_in"],
  ["card", "cards_style_fill_in"],
  ["cartas", "cards_style_fill_in"],
  ["cartascontrahumanidade", "cards_style_fill_in"],
  ["cartascontraahumanidade", "cards_style_fill_in"],
  ["cah", "cards_style_fill_in"],
  ["desenho", "draw_and_guess"],
  ["draw", "draw_and_guess"],
  ["pictionary", "pictionary_teams"],
  ["morel", "morel_recording"],
  ["invencaodemorel", "morel_recording"],
  ["mala", "three_suitcases"],
  ["malas", "three_suitcases"],
  ["caixapreta", "black_box_transcript"],
  ["transcricao", "black_box_transcript"],
  ["vestigio", "object_trace"],
  ["objeto", "object_trace"],
  ["cor", "color_failure"],
  ["puzzle", "mini_escape_room"],
  ["escape", "mini_escape_room"],
  ["teams", "team_battle"],
  ["times", "team_battle"],
  ["regra", "guess_the_rule"],
  ["tribunal", "internet_trial"],
  ["simnao", "yes_no_forbidden"],
  ["sim/nao", "yes_no_forbidden"],
  ["proibida", "forbidden_word"],
  ["palavraproibida", "forbidden_word"],
  ["historia", "collective_story"],
  ["conspiracao", "express_conspiracy"],
  ["quiz", "impossible_quiz"],
  ["aventura", "text_adventure"],
  ["adventure", "text_adventure"],
  ["verdadeoubolo", VERDADE_OU_BOLO_ID],
  ["verdade/bolo", VERDADE_OU_BOLO_ID],
  ["verdadebolo", VERDADE_OU_BOLO_ID],
  ["bolo", VERDADE_OU_BOLO_ID]
]);

const MIN_CONVERSATIONAL_TURNS_AFTER_GAME = 6;

const PREFERRED_INTERACTIVE_GAMES = new Set([
  "hangman",
  "who_am_i",
  "master_mandou",
  "cards_style_fill_in",
  "complete_phrase",
  "two_truths_one_lie",
  "most_likely",
  "guess_who_said",
  "black_box_transcript",
  "draw_and_guess",
  "pictionary_teams",
  "guess_the_rule",
  "secret_rule",
  "yes_no_forbidden",
  "forbidden_word",
  "micro_riddle",
  "textual_telephone",
  "collective_story",
  "team_battle",
  VERDADE_OU_BOLO_ID
]);

const DRAMATURGY_GAMES = new Set([
  "morel_recording",
  "three_suitcases",
  "black_box_transcript",
  "object_trace",
  "color_failure",
  "rehearsal_loop",
  "boarding_gate"
]);

const LOW_PRIORITY_RANDOM_GAMES = new Set([
  "fake_points",
  "blank_game",
  "worst_possible_answer",
  "prediction_template",
  "prediction",
  "impossible_choice",
  "absurd_assignment",
  "collective_judgment",
  "useless_referendum",
  "temporary_boss",
  "npc_mode",
  "imaginary_item",
  "inventory",
  "ranking",
  "achievement",
  "patch_notes",
  "instant_horoscope",
  "cardless_tarot",
  "apology_video",
  "express_conspiracy",
  "mini_escape_room",
  "secret_code",
  "fake_interview",
  "interrogation",
  "lawyer"
]);

const AUTOMATIC_EXCLUDED_GAMES = new Set([
  "draw_and_guess",
  "pictionary_teams",
  "three_suitcases",
  VERDADE_OU_BOLO_ID
]);

const DRAWING_SHAPES = {
  caixa: [
    { type: "rect", id: "box-body", x: 25, y: 36, width: 50, height: 36, strokeWidth: 3 },
    { type: "line", id: "box-top", x: 25, y: 36, x2: 50, y2: 22, strokeWidth: 3 },
    { type: "line", id: "box-top-2", x: 75, y: 36, x2: 50, y2: 22, strokeWidth: 3 },
    { type: "line", id: "box-mid", x: 50, y: 22, x2: 50, y2: 58, strokeWidth: 2 }
  ],
  celular: [
    { type: "rect", id: "phone-body", x: 34, y: 16, width: 32, height: 68, strokeWidth: 3 },
    { type: "circle", id: "phone-button", x: 50, y: 76, radius: 2, strokeWidth: 2 },
    { type: "line", id: "phone-crack", x: 40, y: 24, x2: 58, y2: 42, strokeWidth: 2 }
  ],
  teatro: [
    { type: "line", id: "stage", x: 14, y: 75, x2: 86, y2: 75, strokeWidth: 3 },
    { type: "line", id: "curtain-l", x: 22, y: 18, x2: 34, y2: 75, strokeWidth: 3 },
    { type: "line", id: "curtain-r", x: 78, y: 18, x2: 66, y2: 75, strokeWidth: 3 },
    { type: "circle", id: "actor", x: 50, y: 62, radius: 6, strokeWidth: 2 }
  ],
  algoritmo: [
    { type: "circle", id: "node-a", x: 28, y: 30, radius: 8, strokeWidth: 3 },
    { type: "circle", id: "node-b", x: 70, y: 34, radius: 8, strokeWidth: 3 },
    { type: "circle", id: "node-c", x: 50, y: 70, radius: 8, strokeWidth: 3 },
    { type: "line", id: "edge-a", x: 36, y: 34, x2: 62, y2: 34, strokeWidth: 2 },
    { type: "line", id: "edge-b", x: 32, y: 38, x2: 48, y2: 64, strokeWidth: 2 },
    { type: "line", id: "edge-c", x: 66, y: 42, x2: 54, y2: 64, strokeWidth: 2 }
  ]
};

function normalizeRequest(raw = "") {
  return `${raw || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, "");
}

function hashNumber(text = "") {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function weightedPick(scoredGames, seedText) {
  const total = scoredGames.reduce((sum, item) => sum + Math.max(1, item.score), 0);
  let cursor = hashNumber(seedText) % total;

  for (const item of scoredGames) {
    cursor -= Math.max(1, item.score);
    if (cursor < 0) {
      return item;
    }
  }

  return scoredGames[0];
}

function recentText(state = {}) {
  return [
    ...(state.memories || []).slice(-8).map((memory) => memory.content || ""),
    ...(state.conversation || []).slice(-8).map((message) => message.content || "")
  ].join("\n");
}

function keywordScore(mechanic, text = "") {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const rules = [
    [/\b(espetaculo|teatro|peca|caixa preta|caixa|palco|plateia|publico)\b/, ["black_box_transcript", "morel_recording", "cards_style_fill_in", "complete_phrase", "object_trace", "boarding_gate"]],
    [/\b(morel|ilha|duplicacao|copia|gravacao|imagem|registro|eterno|repeticao)\b/, ["morel_recording", "rehearsal_loop", "who_am_i", "guess_the_rule"]],
    [/\b(mala|malas|cadeado|codigo|abrir|fechar|botao)\b/, ["three_suitcases", "secret_code", "guess_the_rule", "collective_judgment"]],
    [/\b(aeroporto|embarque|aviao|voo|fila|espera|atrasad|portao)\b/, ["boarding_gate", "black_box_transcript", "impossible_quiz", "worst_possible_answer"]],
    [/\b(objeto|bolsa|mochila|chave|cueca|roupa|vestigio|coisa)\b/, ["object_trace", "cards_style_fill_in", "draw_and_guess", "guess_who_said"]],
    [/\b(cor|cores|cinza|vermelho|azul|verde|amarelo|preto|laranja)\b/, ["color_failure", "draw_and_guess", "secret_rule"]],
    [/\batrasad|chegou tarde|ofegante|desculpa\b/, ["worst_possible_answer", "internet_trial", "blank_game", "prediction_template"]],
    [/\bcasal|namorad|ficante|marido|esposa|acompanhante\b/, ["prediction", "prediction_template", "most_likely", "role_swap"]],
    [/\bcelular|telefone|instagram|feed|algoritmo|abas|emoji\b/, ["phone_screen_time", "phone_tab_count", "human_captcha", "express_conspiracy", "phone_algorithm_profile"]],
    [/\btime|grupo|muita gente|plateia|publico\b/, ["team_battle", "useless_referendum", "most_likely"]],
    [/\bsilencio|parado|esperando|nada acontece|travou\b/, ["hangman", "guess_the_rule", "draw_and_guess", "complete_phrase"]],
    [/\bdesenh|imagem|adivinh\b/, ["draw_and_guess", "pictionary_teams"]],
    [/\broubando|injusto|ponto|placar\b/, ["fake_points", "rule_change", "team_battle"]],
    [/\bconspir|teoria|conectar\b/, ["express_conspiracy"]],
    [/\btarot|signo|horoscopo\b/, ["cardless_tarot", "instant_horoscope"]]
  ];

  return rules.reduce((score, [pattern, ids]) => (
    pattern.test(normalized) && ids.includes(mechanic.id) ? score + 18 : score
  ), 0);
}

function mapRequestedGame(requestedGame) {
  const raw = `${requestedGame || ""}`.trim();
  if (getHostMechanicById(raw)) {
    return raw;
  }

  const normalized = normalizeRequest(requestedGame);
  return GAME_ALIASES.has(normalized) ? GAME_ALIASES.get(normalized) : normalized || null;
}

function isEligible(mechanic, context) {
  const participantCount = context.participantPool.participants.length;

  if (!mechanic) {
    return false;
  }

  if (mechanic.requiresCanvas && !context.capabilities.canvas) {
    return false;
  }

  if (mechanic.category === "phone_games" && !context.capabilities.phoneProjection) {
    return false;
  }

  if (mechanic.teamGame && (!context.capabilities.teams || participantCount < 4)) {
    return false;
  }

  return participantCount >= (mechanic.minParticipants || 1);
}

function createScore(mechanic, context) {
  const recentGameIds = [
    context.gameState.active ? context.gameState.id : null,
    ...(context.gameState.recentGames || [])
  ].filter(Boolean);
  const recentPenalty = recentGameIds.includes(mechanic.id) ? -28 : 0;
  const cooldownPenalty = context.gameState.cooldownTurnsRemaining > 0 ? -80 : 0;
  const easyBonus = mechanic.physical ? 0 : 8;
  const interactiveBonus = PREFERRED_INTERACTIVE_GAMES.has(mechanic.id) ? 26 : 0;
  const recognizableBonus = mechanic.recognizableGame ? 22 : 0;
  const qualityBonus = (mechanic.gameQuality || 1) * 8;
  const lowPriorityPenalty = LOW_PRIORITY_RANDOM_GAMES.has(mechanic.id) || mechanic.microDynamic ? -44 : 0;
  const statefulBonus = mechanic.stateful ? 8 : 0;
  const concreteGuessBonus = /adivinh|lacuna|forca|sim\/nao|sim ou nao|desenho|comando|regra|charada|quiz/i.test(`${mechanic.name} ${mechanic.description}`) ? 8 : 0;
  const contextBonus = keywordScore(mechanic, context.recentText);
  const dramaturgyBonus = DRAMATURGY_GAMES.has(mechanic.id) ? 10 : 0;
  const audienceBonus = context.participantPool.audienceAvailable && mechanic.minParticipants > 1 ? 4 : 0;
  const sourceBonus = mechanic.category === "phone_games" && /celular|telefone|instagram|feed|abas|emoji/i.test(context.recentText) ? 20 : 0;

  return Math.max(1, 12 + easyBonus + interactiveBonus + recognizableBonus + qualityBonus + lowPriorityPenalty + statefulBonus + concreteGuessBonus + contextBonus + dramaturgyBonus + audienceBonus + sourceBonus + recentPenalty + cooldownPenalty);
}

function selectParticipants(pool, count = 1, seed = "") {
  const ordered = [...pool.participants]
    .filter((participant) => participant.present !== "false")
    .sort((a, b) => {
      const sourceBias = (source) => {
        if (pool.audienceAvailable && source === "audience") return -3;
        if (pool.audienceAvailable && source === "session") return -4;
        return 0;
      };
      const scoreA = (a.selectedCount || 0) * 10 + sourceBias(a.source) + (hashNumber(`${seed}:${a.key}`) % 7);
      const scoreB = (b.selectedCount || 0) * 10 + sourceBias(b.source) + (hashNumber(`${seed}:${b.key}`) % 7);
      return scoreA - scoreB;
    });

  return ordered.slice(0, Math.max(0, count));
}

function createTeams(participants = []) {
  return participants.reduce((teams, participant, index) => {
    const target = index % 2 === 0 ? teams[0] : teams[1];
    target.participants.push(participant);
    return teams;
  }, [
    { id: "A", name: "TIME A", participants: [] },
    { id: "B", name: "TIME B", participants: [] }
  ]);
}

function gameDataFor(mechanic, state, participants) {
  if (mechanic.id === VERDADE_OU_BOLO_ID) {
    return createVerdadeOuBoloGameData();
  }

  if (mechanic.id === "hangman") {
    const secretWord = chooseHangmanWord({
      memories: state.memories,
      conversation: state.conversation
    });
    return {
      publicData: {
        progress: secretWord.replace(/./g, "_").split("").join(" "),
        wrongLetters: [],
        attemptsLeft: 6
      },
      privateData: {
        secretWord,
        guessedLetters: []
      },
      phase: "guess"
    };
  }

  if (mechanic.id === "who_am_i") {
    return {
      publicData: {
        mode: "BOT_GUESSES",
        targetParticipant: null,
        questionCount: 0,
        maxQuestions: 10,
        answers: [],
        guesses: [],
        secretSet: false,
        secretKnownToOperator: true,
        secretKnownToModel: false
      },
      privateData: {
        secret: null,
        hiddenFromModel: true,
        acceptedAnswers: ["sim", "nao", "talvez"]
      },
      phase: "awaiting_secret"
    };
  }

  if (mechanic.id === "master_mandou") {
    return {
      publicData: {
        formula: "Caixa mandou",
        commands: [],
        misses: [],
        validCommands: 0,
        trapCommands: 0
      },
      privateData: {
        formula: "Caixa mandou"
      },
      phase: "command"
    };
  }

  if (mechanic.id === "cards_style_fill_in" || mechanic.id === "complete_phrase") {
    const seeds = [
      "o verdadeiro motivo pelo qual o teatro nacional ainda existe e _____.",
      "a equipe tecnica so queria _____.",
      "minha proxima atualizacao deveria incluir _____.",
      "a coisa mais perigosa para dizer em voz alta agora e _____.",
      "o algoritmo olhou para esta sala e recomendou _____."
    ];
    const prompt = seeds[hashNumber(recentText(state)) % seeds.length];
    return {
      publicData: {
        prompt,
        responses: [],
        targetResponses: mechanic.id === "cards_style_fill_in" ? 3 : 1,
        winner: null
      },
      privateData: {},
      phase: "collect_answers"
    };
  }

  if (mechanic.id === "draw_and_guess" || mechanic.id === "pictionary_teams") {
    const words = Object.keys(DRAWING_SHAPES);
    const word = words[hashNumber(recentText(state)) % words.length];
    return {
      publicData: {
        prompt: "adivinhe o desenho",
        guesses: [],
        canvas: true
      },
      privateData: {
        secretWord: word,
        shapes: DRAWING_SHAPES[word]
      },
      phase: "guess"
    };
  }

  return {
    publicData: {
      promptSeed: (state.memories || []).at(-1)?.content || (state.conversation || []).at(-1)?.content || "",
      notes: "template_improvisation"
    },
    privateData: {},
    phase: mechanic.teamGame ? "team_round" : "open_round"
  };
}

function publicGame(gameState = {}) {
  const { privateData, ...publicState } = gameState;
  return {
    ...publicState,
    data: gameState.publicData || gameState.data || {}
  };
}

export function createInitialGameState() {
  return {
    active: false,
    id: null,
    startSource: null,
    phase: null,
    participants: [],
    teams: [],
    score: {},
    publicData: {},
    privateData: {},
    round: 0,
    turnCount: 0,
    startedAt: null,
    updatedAt: null,
    endedAt: null,
    recentGames: [],
    cooldownTurnsRemaining: 0,
    autoGamesEnabled: true,
    sequence: 0,
    lastOpportunity: null,
    lastSelectionDebug: null
  };
}

export function buildGameContext(state = {}) {
  return {
    capabilities: DEFAULT_CAPABILITIES,
    gameState: state.game || createInitialGameState(),
    participantPool: getParticipantPool({
      sessionParticipants: state.participants?.session || [],
      history: state.participants?.history || {}
    }),
    recentText: recentText(state),
    mode: state.mode || "host"
  };
}

export function getEligibleGames(state = {}, requestedGame = null) {
  const context = buildGameContext(state);
  const requestedId = mapRequestedGame(requestedGame);
  const games = requestedId
    ? [getHostMechanicById(requestedId)].filter(Boolean)
    : hostGameMechanics;

  return games.filter((mechanic) => isEligible(mechanic, context));
}

export function scoreGames(state = {}, requestedGame = null) {
  const context = buildGameContext(state);
  const requestedId = mapRequestedGame(requestedGame);

  return getEligibleGames(state, requestedGame)
    .filter((mechanic) => requestedId || (mechanic.id !== context.gameState.id && mechanic.id !== VERDADE_OU_BOLO_ID))
    .map((mechanic) => ({
      game: mechanic,
      score: createScore(mechanic, context) + (requestedId === mechanic.id ? 100 : 0)
    }))
    .sort((a, b) => b.score - a.score);
}

export function selectGame(state = {}, requestedGame = null, { source = "operator" } = {}) {
  const requestedId = mapRequestedGame(requestedGame);
  let scoredGames = scoreGames(state, requestedId);
  let adaptedFrom = null;

  if (!requestedId && source === "automatic") {
    scoredGames = scoredGames.filter((item) => (
      !AUTOMATIC_EXCLUDED_GAMES.has(item.game.id) &&
      !item.game.microDynamic &&
      (item.game.gameQuality || 0) >= 4
    ));
  }

  if (requestedId && !scoredGames.length) {
    adaptedFrom = requestedId;
    scoredGames = scoreGames(state, null);
  }

  if (!scoredGames.length) {
    return { game: null, eligibleGames: [], adaptedFrom };
  }

  const seed = [
    requestedId || "auto",
    state.game?.sequence || 0,
    state.conversation?.length || 0,
    state.memories?.length || 0,
    recentText(state).slice(-240)
  ].join(":");
  const selected = requestedId ? scoredGames[0] : weightedPick(scoredGames.slice(0, 12), seed);

  return {
    game: selected.game,
    score: selected.score,
    eligibleGames: scoredGames.map((item) => ({ id: item.game.id, score: item.score })).slice(0, 12),
    adaptedFrom
  };
}

export function startGame(state = {}, { requestedGame = null, source = "operator", replace = false } = {}) {
  const currentGame = state.game || createInitialGameState();

  if (currentGame.active && !replace) {
    return {
      gameState: currentGame,
      selection: {
        game: null,
        blockedReason: "game_already_active",
        eligibleGames: [],
        adaptedFrom: null
      },
      events: [],
      participants: [],
      blocked: true
    };
  }

  const selectionState = replace && currentGame.active
    ? { ...state, game: stopGame(state, { status: "replaced", source }).gameState }
    : state;
  const selection = selectGame(selectionState, requestedGame, { source });
  const mechanic = selection.game;

  if (!mechanic) {
    return { gameState: currentGame, selection, events: [], participants: [] };
  }

  const participantPool = buildGameContext(selectionState).participantPool;
  const participantCount = mechanic.id === VERDADE_OU_BOLO_ID
    ? 0
    : mechanic.teamGame ? Math.min(6, Math.max(4, mechanic.minParticipants || 4)) : Math.max(1, mechanic.minParticipants || 1);
  const participants = selectParticipants(participantPool, participantCount, `${mechanic.id}:${selectionState.game?.sequence || 0}`);
  const teams = mechanic.teamGame ? createTeams(participants) : [];
  const now = new Date().toISOString();
  const data = gameDataFor(mechanic, selectionState, participants);
  const score = data.score || (teams.length
    ? Object.fromEntries(teams.map((team) => [team.id, 0]))
    : Object.fromEntries(participants.map((participant) => [participant.name, 0])));

  const gameState = {
    ...createInitialGameState(),
    active: true,
    id: mechanic.id,
    name: mechanic.name,
    startSource: source,
    phase: data.phase,
    participants,
    teams,
    score,
    publicData: data.publicData,
    privateData: data.privateData,
    round: 1,
    turnCount: 0,
    startedAt: now,
    updatedAt: now,
    recentGames: selectionState.game?.recentGames || [],
    cooldownTurnsRemaining: 0,
    autoGamesEnabled: selectionState.game?.autoGamesEnabled !== false,
    sequence: (selectionState.game?.sequence || 0) + 1,
    lastOpportunity: selectionState.game?.lastOpportunity || null,
    lastSelectionDebug: {
      requestedGame: requestedGame || null,
      adaptedFrom: selection.adaptedFrom,
      eligibleGames: selection.eligibleGames,
      selectedScore: selection.score || null
    }
  };

  const events = startEventsForGame(gameState);
  return { gameState, selection, events, participants };
}

export function stopGame(state = {}, { status = "stopped", source = "operator" } = {}) {
  const current = state.game || createInitialGameState();
  const now = new Date().toISOString();

  if (!current.active) {
    const mechanic = getHostMechanicById(current.id);
    return {
      gameState: {
        ...current,
        phase: status || current.phase,
        endedAt: current.endedAt || now,
        cooldownTurnsRemaining: current.id
          ? Math.max(MIN_CONVERSATIONAL_TURNS_AFTER_GAME, mechanic?.cooldown || MIN_CONVERSATIONAL_TURNS_AFTER_GAME)
          : Math.max(current.cooldownTurnsRemaining || 0, MIN_CONVERSATIONAL_TURNS_AFTER_GAME),
        recentGames: current.id
          ? [current.id, ...(current.recentGames || []).filter((id) => id !== current.id)].slice(0, 8)
          : current.recentGames || [],
        updatedAt: now,
        lastStopSource: source
      },
      stopped: false
    };
  }

  const mechanic = getHostMechanicById(current.id);
  return {
    stopped: true,
    gameState: {
      ...current,
      active: false,
      phase: status,
      endedAt: now,
      updatedAt: now,
      cooldownTurnsRemaining: Math.max(MIN_CONVERSATIONAL_TURNS_AFTER_GAME, mechanic?.cooldown || MIN_CONVERSATIONAL_TURNS_AFTER_GAME),
      recentGames: [current.id, ...(current.recentGames || []).filter((id) => id !== current.id)].slice(0, 8),
      lastStopSource: source
    }
  };
}

export function tickGameAfterTurn(state = {}) {
  const current = state.game || createInitialGameState();

  if (current.active) {
    if (isVerdadeOuBolo(current)) {
      return {
        ...current,
        updatedAt: new Date().toISOString()
      };
    }

    const mechanic = getHostMechanicById(current.id);
    if ((current.turnCount || 0) + 1 >= (mechanic?.maxTurns || 5)) {
      return stopGame({ ...state, game: current }, { status: "auto_ended", source: "automatic" }).gameState;
    }

    return {
      ...current,
      turnCount: (current.turnCount || 0) + 1,
      updatedAt: new Date().toISOString()
    };
  }

  return {
    ...current,
    cooldownTurnsRemaining: Math.max(0, (current.cooldownTurnsRemaining || 0) - 1),
    updatedAt: new Date().toISOString()
  };
}

function conversationRunScore(state = {}, latestInput = "") {
  const recentConversation = (state.conversation || []).slice(-8);
  const text = `${recentConversation.map((message) => message.content || "").join("\n")}\n${latestInput}`.toLowerCase();
  const directGameRequest = /\b(me da um jogo|vamos jogar|jogo|brincadeira|forca|maria antonieta|mestre mandou|cards|desenho|adivinha)\b/.test(text);
  const conversationalHeat = [
    /\b(testar|humilh|alma|inteligente|burra|filha da puta|kkkk|ex|namorad|ficante|fofoca|internet|instagram|trabalho|chuva|transporte)\b/.test(text),
    recentConversation.length >= 2,
    recentConversation.some((message) => message.role === "assistant" && !/[?]$/.test(`${message.content || ""}`.trim())),
    recentConversation.filter((message) => message.role === "assistant" && /\b(escolh|aponte|levanta|vota|ponto|penalidade|cargo|suspeito|cumplice)\b/i.test(message.content || "")).length === 0
  ].filter(Boolean).length;

  if (directGameRequest) {
    return 0;
  }

  return conversationalHeat;
}

export function evaluateGameOpportunity(state = {}, latestInput = "") {
  const gameState = state.game || createInitialGameState();
  const text = `${recentText(state)}\n${latestInput}`.toLowerCase();
  const reasons = [];
  let score = 0;
  const runScore = conversationRunScore(state, latestInput);
  const conversationRun = {
    score: runScore,
    continueConversation: runScore >= 2
  };

  if (state.mode !== "host" || gameState.active || gameState.autoGamesEnabled === false) {
    return { score: 0, reasons: [], conversationRun, shouldStartAutomatic: false, aiMayStart: false };
  }

  if ((gameState.cooldownTurnsRemaining || 0) > 0) {
    return { score: 0, reasons: ["cooldown"], conversationRun, shouldStartAutomatic: false, aiMayStart: false };
  }

  const directGameRequest = /\b(me da um jogo|vamos jogar|jogo|brincadeira|adivinha|forca|maria antonieta|mestre mandou|cards|desenho)\b/.test(text);
  conversationRun.continueConversation = runScore >= 2 && !directGameRequest;

  if (runScore >= 2 && !directGameRequest) {
    reasons.push("conversation_run_interessante");
    score -= 5;
  }

  if (/\b(parado|esperando|silencio|sem assunto|nada acontece|chato|me da um jogo|vamos jogar|jogo|brincadeira|adivinha|forca|mestre mandou|maria antonieta)\b/.test(text)) {
    score += 5;
    reasons.push("ritmo_pede_acao");
  }

  if (/\b(atrasad|ofegante|celular|casal|namorad|ficante|time|publico|voluntari|nome|pessoa|alguem|plateia)\b/.test(text)) {
    score += 3;
    reasons.push("material_social");
  }

  if ((state.memories || []).length >= 1) {
    score += 2;
    reasons.push("memoria_disponivel");
  }

  const participantCount = buildGameContext(state).participantPool.participants.length;
  if (participantCount >= 1) {
    score += 2;
    reasons.push("participantes_identificados");
  }

  if (participantCount >= 2) {
    score += 1;
    reasons.push("dois_ou_mais_participantes");
  }

  const recentAssistant = (state.conversation || []).slice(-5).filter((message) => message.role === "assistant");
  const questiony = recentAssistant.filter((message) => /\?$/.test(`${message.content || ""}`.trim())).length;
  if (questiony >= 2) {
    score += 2;
    reasons.push("interacao_repetitiva");
  }

  const latestTokens = `${latestInput || ""}`.trim().split(/\s+/).filter(Boolean);
  if (latestTokens.length >= 1 && latestTokens.length <= 4 && directGameRequest) {
    score += 2;
    reasons.push("resposta_curta_jogavel");
  }

  if (recentAssistant.some((message) => /\b(uma letra|adivinhe|perguntas de sim|complete a frase|caixa mandou)\b/i.test(message.content || ""))) {
    score += 2;
    reasons.push("acao_pendente");
  }

  if ((state.conversation || []).length >= 6 && directGameRequest) {
    score += 1;
    reasons.push("conversa_aquecida");
  }

  return {
    score,
    reasons,
    conversationRun,
    shouldStartAutomatic: score >= 10,
    aiMayStart: score >= 7,
    suggestedGames: scoreGames(state, null).slice(0, 5).map((item) => ({ id: item.game.id, score: item.score }))
  };
}

export function advanceGame(state = {}, rawInput = "") {
  const current = state.game || createInitialGameState();

  if (!current.active) {
    return { gameState: current, result: null, events: [] };
  }

  if (isVerdadeOuBolo(current)) {
    return { gameState: current, result: { type: "operator_controlled_game" }, events: [] };
  }

  if (current.id === "hangman") {
    return advanceHangman(current, rawInput);
  }

  if (current.id === "who_am_i") {
    return advanceWhoAmI(current, rawInput);
  }

  if (current.id === "cards_style_fill_in" || current.id === "complete_phrase") {
    return advanceCards(current, rawInput);
  }

  if (current.id === "master_mandou") {
    return advanceMasterMandou(current, rawInput);
  }

  if (current.id === "draw_and_guess" || current.id === "pictionary_teams") {
    return advanceDrawing(current, rawInput);
  }

  return {
    gameState: {
      ...current,
      round: current.round + 1,
      updatedAt: new Date().toISOString()
    },
    result: {
      type: "template_input",
      input: rawInput
    },
    events: []
  };
}

export function applyGameMove(state = {}, move = {}) {
  const current = state.game || createInitialGameState();

  if (!current.active) {
    return { gameState: current, applied: false };
  }

  if (isVerdadeOuBolo(current)) {
    return { gameState: current, applied: false, result: { type: "operator_controlled_game" } };
  }

  const action = `${move.gameMove || move.action || ""}`.trim();
  if (action === "stop_game") {
    return {
      ...stopGame(state, { status: "ai_stopped", source: "ai" }),
      applied: true
    };
  }

  if (action === "guess_secret" && current.id === "who_am_i") {
    const guess = `${move.guess || move.target || ""}`.trim();
    const secret = `${current.privateData.secret || ""}`.trim();
    const hit = Boolean(secret && guess && normalizeRequest(guess) === normalizeRequest(secret));

    return {
      gameState: {
        ...current,
        active: !hit,
        phase: hit ? "completed" : "yes_no_questions",
        publicData: {
          ...current.publicData,
          guesses: [...(current.publicData.guesses || []), { guess, hit }].slice(-8),
          lastGuess: guess,
          lastGuessResult: hit ? "hit" : "miss"
        },
        endedAt: hit ? new Date().toISOString() : current.endedAt,
        updatedAt: new Date().toISOString()
      },
      applied: Boolean(guess),
      result: {
        type: "guess_secret",
        guess,
        hit
      }
    };
  }

  if (action === "master_command" && current.id === "master_mandou") {
    const command = `${move.command || move.text || ""}`.trim();
    const valid = Boolean(move.valid ?? command.toLowerCase().startsWith("caixa mandou"));
    const commands = [...(current.publicData.commands || []), { command, valid }].filter((item) => item.command).slice(-12);

    return {
      gameState: {
        ...current,
        publicData: {
          ...current.publicData,
          commands,
          lastCommand: command,
          lastCommandValid: valid,
          validCommands: commands.filter((item) => item.valid).length,
          trapCommands: commands.filter((item) => !item.valid).length
        },
        updatedAt: new Date().toISOString()
      },
      applied: Boolean(command)
    };
  }

  if (action === "choose_winner" && (current.id === "cards_style_fill_in" || current.id === "complete_phrase")) {
    const winner = `${move.winner || move.target || move.response || ""}`.trim();

    return {
      gameState: {
        ...current,
        active: false,
        phase: "completed",
        publicData: {
          ...current.publicData,
          winner
        },
        endedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      applied: Boolean(winner)
    };
  }

  if (!["award_point", "penalize", "set_score"].includes(action)) {
    return {
      gameState: {
        ...current,
        publicData: {
          ...current.publicData,
          lastGameMove: action || null
        },
        updatedAt: new Date().toISOString()
      },
      applied: Boolean(action)
    };
  }

  const score = { ...(current.score || {}) };
  const target = resolveScoreTarget(current, move.target);

  if (!target) {
    return { gameState: current, applied: false };
  }

  const rawDelta = Number(move.delta ?? move.points ?? 1);
  const delta = Number.isFinite(rawDelta) ? Math.max(-5, Math.min(5, rawDelta)) : 1;
  score[target] = action === "set_score" ? delta : (score[target] || 0) + (action === "penalize" ? -Math.abs(delta) : delta);

  return {
    gameState: {
      ...current,
      score,
      publicData: {
        ...current.publicData,
        lastGameMove: action,
        lastScoreTarget: target,
        lastScoreDelta: action === "penalize" ? -Math.abs(delta) : delta
      },
      updatedAt: new Date().toISOString()
    },
    applied: true
  };
}

function resolveScoreTarget(gameState, requestedTarget = "") {
  const target = `${requestedTarget || ""}`.trim().toLowerCase();
  const scoreKeys = Object.keys(gameState.score || {});

  if (!scoreKeys.length) {
    return null;
  }

  if (!target) {
    return scoreKeys[0];
  }

  return scoreKeys.find((key) => key.toLowerCase() === target)
    || gameState.teams?.find((team) => [team.id, team.name].some((value) => `${value}`.toLowerCase() === target))?.id
    || gameState.participants?.find((participant) => participant.name.toLowerCase() === target)?.name
    || scoreKeys[0];
}

export function setGameSecret(state = {}, secret = "") {
  const current = state.game || createInitialGameState();
  const cleanSecret = `${secret || ""}`.trim().slice(0, 120);

  if (!current.active || current.id !== "who_am_i" || !cleanSecret) {
    return { gameState: current, applied: false };
  }

  return {
    applied: true,
    gameState: {
      ...current,
      phase: "yes_no_questions",
      publicData: {
        ...current.publicData,
        mode: "BOT_GUESSES",
        secretSet: true,
        secretKnownToOperator: true,
        secretKnownToModel: false
      },
      privateData: {
        ...current.privateData,
        secret: cleanSecret,
        hiddenFromModel: true
      },
      updatedAt: new Date().toISOString()
    }
  };
}

export function controlStructuredGame(state = {}, action = "", payload = {}) {
  const current = state.game || createInitialGameState();

  if (isVerdadeOuBolo(current)) {
    return controlVerdadeOuBolo(current, action, payload);
  }

  return {
    gameState: current,
    applied: false,
    result: { type: "not_structured_game" }
  };
}

function normalizeAnswer(rawInput = "") {
  const text = `${rawInput || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/\b(sim|s|yes)\b/.test(text)) return "sim";
  if (/\b(nao|n|no)\b/.test(text)) return "nao";
  if (/\b(talvez|depende|mais ou menos|parcial)\b/.test(text)) return "talvez";
  return null;
}

function advanceWhoAmI(current, rawInput) {
  if (!current.publicData.secretSet) {
    return {
      gameState: current,
      result: { type: "awaiting_secret" },
      events: []
    };
  }

  const answer = normalizeAnswer(rawInput);
  if (!answer) {
    return {
      gameState: current,
      result: { type: "invalid_answer", input: rawInput },
      events: []
    };
  }

  const answers = [...(current.publicData.answers || []), answer].slice(-12);
  const questionCount = answers.length;
  const completed = questionCount >= (current.publicData.maxQuestions || 10);

  return {
    gameState: {
      ...current,
      active: !completed,
      phase: completed ? "guess_or_quit" : "yes_no_questions",
      publicData: {
        ...current.publicData,
        answers,
        questionCount
      },
      round: current.round + 1,
      endedAt: completed ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    },
    result: {
      type: "yes_no_answer",
      answer,
      completed,
      questionCount
    },
    events: []
  };
}

function advanceCards(current, rawInput) {
  const responses = [...(current.publicData.responses || []), `${rawInput || ""}`.trim()]
    .filter(Boolean)
    .slice(-6);
  const targetResponses = current.publicData.targetResponses || 3;
  const readyToJudge = responses.length >= targetResponses;

  return {
    gameState: {
      ...current,
      phase: readyToJudge ? "judge" : "collect_answers",
      publicData: {
        ...current.publicData,
        responses
      },
      round: current.round + 1,
      updatedAt: new Date().toISOString()
    },
    result: {
      type: "cards_response",
      responses,
      readyToJudge
    },
    events: []
  };
}

function advanceMasterMandou(current, rawInput) {
  const observation = `${rawInput || ""}`.trim();

  return {
    gameState: {
      ...current,
      publicData: {
        ...current.publicData,
        lastObservation: observation,
        observations: [...(current.publicData.observations || []), observation].filter(Boolean).slice(-10)
      },
      round: current.round + 1,
      updatedAt: new Date().toISOString()
    },
    result: {
      type: "master_observation",
      observation
    },
    events: []
  };
}

function advanceHangman(current, rawInput) {
  const guess = `${rawInput || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 18);
  const secretWord = current.privateData.secretWord;

  if (!guess) {
    return { gameState: current, result: { type: "invalid" }, events: [] };
  }

  const guessedLetters = new Set(current.privateData.guessedLetters || []);
  const wrongLetters = [...(current.publicData.wrongLetters || [])];
  let resultType = "repeat";

  if (guess.length === 1) {
    if (secretWord.includes(guess)) {
      guessedLetters.add(guess);
      resultType = "letter_hit";
    } else if (!wrongLetters.includes(guess)) {
      wrongLetters.push(guess);
      resultType = "letter_miss";
    }
  } else if (guess === secretWord) {
    for (const letter of secretWord) {
      guessedLetters.add(letter);
    }
    resultType = "word_hit";
  } else {
    wrongLetters.push(guess);
    resultType = "word_miss";
  }

  const progress = secretWord
    .split("")
    .map((letter) => (guessedLetters.has(letter) ? letter.toUpperCase() : "_"))
    .join(" ");
  const attemptsLeft = Math.max(0, 6 - wrongLetters.length);
  const completed = !progress.includes("_") || attemptsLeft <= 0;
  const gameState = {
    ...current,
    active: !completed,
    phase: completed ? "completed" : "guess",
    publicData: {
      ...current.publicData,
      progress,
      wrongLetters,
      attemptsLeft
    },
    privateData: {
      ...current.privateData,
      guessedLetters: [...guessedLetters]
    },
    round: current.round + 1,
    endedAt: completed ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString()
  };

  const events = [];

  if (resultType.includes("miss") || attemptsLeft <= 0) {
    events.push({
      type: PERFORMANCE_EVENT_TYPES.flashText,
      durationMs: 1200,
      payload: { text: attemptsLeft <= 0 ? "PERDEU" : "NAO." }
    });
  }

  return {
    gameState,
    result: {
      type: resultType,
      guess,
      completed,
      attemptsLeft,
      progress
    },
    events
  };
}

function advanceDrawing(current, rawInput) {
  const guess = `${rawInput || ""}`.trim().toLowerCase();
  const secretWord = current.privateData.secretWord;
  const hit = guess.includes(secretWord);
  const completed = hit || current.round >= 4;

  return {
    gameState: {
      ...current,
      active: !completed,
      phase: completed ? "completed" : "guess",
      publicData: {
        ...current.publicData,
        guesses: [...(current.publicData.guesses || []), rawInput].slice(-6)
      },
      round: current.round + 1,
      endedAt: completed ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    },
    result: {
      type: hit ? "guess_hit" : "guess_miss",
      completed,
      secretWord
    },
    events: [
      ...(hit
        ? [{ type: PERFORMANCE_EVENT_TYPES.flashText, durationMs: 1400, payload: { text: "INFELIZMENTE SIM" } }]
        : []),
      ...(completed
        ? [{ type: PERFORMANCE_EVENT_TYPES.clearDrawing, durationMs: 100, payload: {} }]
        : [])
    ]
  };
}

function startEventsForGame(gameState) {
  if (gameState.id === "hangman") {
    return [];
  }

  if (gameState.id === "draw_and_guess" || gameState.id === "pictionary_teams") {
    return [
      { type: PERFORMANCE_EVENT_TYPES.clearDrawing, durationMs: 100, payload: {} },
      {
        type: PERFORMANCE_EVENT_TYPES.drawing,
        durationMs: 2200,
        payload: {
          revealMs: 1600,
          shapes: gameState.privateData.shapes || []
        }
      }
    ];
  }

  if (gameState.teams?.length) {
    return [{
      type: PERFORMANCE_EVENT_TYPES.fullscreenText,
      durationMs: 2200,
      payload: { text: `${gameState.teams[0].name} 0\n${gameState.teams[1].name} 0` }
    }];
  }

  return [];
}

export function publicGameSnapshot(gameState = createInitialGameState()) {
  return publicGame(gameState);
}

export function gameContextBlock(state = {}) {
  const context = buildGameContext(state);
  const opportunity = evaluateGameOpportunity(state);
  const publicState = publicGameSnapshot(context.gameState);
  const privateForModel = context.gameState.privateData?.hiddenFromModel
    ? {
      hiddenFromModel: true,
      secretKnownToOperator: true,
      secretKnownToModel: false
    }
    : context.gameState.privateData || {};

  return [
    "GAME DIRECTOR STATE:",
    "O codigo controla estado, cooldown, participantes, secrets e fim. Nao invente estado diferente.",
    "JOGO deve ser jogo: regra compreensivel, objetivo, estado, sucesso/fracasso e varios turnos possiveis.",
    "MICRO-DYNAMIC nao e GAME START. Cargo, ponto falso, inventario, votacao abstrata ou tarefa curta podem ser piada de conversa, nao empilhamento de /game.",
    "Depois de jogo encerrado, respeite varios turnos de conversa antes de pedir outro jogo autonomo.",
    JSON.stringify({
      game: publicState,
      privateForModel: context.gameState.active ? privateForModel : {},
      participants: context.participantPool.counts,
      capabilities: context.capabilities,
      opportunity: {
        score: opportunity.score,
        reasons: opportunity.reasons,
        conversationRun: opportunity.conversationRun,
        aiMayStart: opportunity.aiMayStart,
        suggestedGames: opportunity.suggestedGames || []
      }
    }, null, 2),
    "Se opportunity.conversationRun.continueConversation for true, continue conversando e use \"game\": null.",
    "Se opportunity.aiMayStart for true e nao houver game ativo, voce pode pedir inicio autonomo no envelope JSON.",
    "Formato opcional para iniciar: \"game\": { \"startGame\": true, \"requestedGame\": \"cards\", \"gameSuggestion\": \"frase curta\" }.",
    "Formato opcional Maria Antonieta quando a Caixa der palpite: \"game\": { \"gameMove\": \"guess_secret\", \"guess\": \"Anitta\", \"personalityMove\": \"dry_judgment\" }.",
    "Formato opcional Mestre Mandou: \"game\": { \"gameMove\": \"master_command\", \"command\": \"Caixa mandou levantar a mao\", \"valid\": true, \"personalityMove\": \"compliance_roast\" }.",
    "Formato opcional Cards: \"game\": { \"gameMove\": \"choose_winner\", \"winner\": \"segunda resposta\", \"personalityMove\": \"dry_judgment\" }.",
    "Formato opcional durante jogo: \"game\": { \"gameMove\": \"award_point\", \"target\": \"TIME A\", \"delta\": 1, \"personalityMove\": \"counter_roast\" }.",
    "Durante jogo ativo, combine gameMove com personalityMove. Nao vire arbitra neutra."
  ].join("\n");
}

export function gameTrainingTags(gameState = {}) {
  if (!gameState?.active && !gameState?.id) {
    return [];
  }

  const tags = ["game"];
  const id = gameState.id;
  if (id === "hangman") tags.push("hangman");
  if (id === "who_am_i") tags.push("whoami");
  if (id === "draw_and_guess" || id === "pictionary_teams") tags.push("drawing");
  if (gameState.teams?.length || id === "team_battle") tags.push("teams", "competition");
  if (id === "cards_style_fill_in" || id === "blank_game") tags.push("cards");
  if (id === "mini_escape_room" || id === "micro_riddle" || id === "secret_code") tags.push("puzzle");
  return tags;
}

export function normalizeGameCommand(content = "") {
  const [first = "", ...rest] = `${content || ""}`.trim().split(/\s+/);
  const normalizedFirst = normalizeRequest(first);

  if (normalizedFirst === "stop") {
    return { action: "stop", requestedGame: null };
  }

  if (normalizedFirst === "replace") {
    return { action: "replace", requestedGame: rest.join(" ") || null };
  }

  if (normalizedFirst === "secret") {
    return { action: "secret", requestedGame: null, secret: rest.join(" ") };
  }

  const structuredActions = new Map([
    ["intro", "intro"],
    ["iniciarintro", "intro"],
    ["startintro", "intro"],
    ["round", "start_round"],
    ["rodada", "start_round"],
    ["iniciarrodada", "start_round"],
    ["startround", "start_round"],
    ["play", "video_play"],
    ["pause", "video_pause"],
    ["pausar", "video_pause"],
    ["restart", "video_restart"],
    ["reiniciar", "video_restart"],
    ["resetvideo", "video_restart"],
    ["verdade", "select_answer"],
    ["true", "select_answer"],
    ["bolo", "select_answer"],
    ["reveal", "reveal"],
    ["revelar", "reveal"],
    ["resposta", "reveal"],
    ["videoended", "video_ended"],
    ["videoend", "video_ended"],
    ["ended", "video_ended"],
    ["videoready", "video_ready"],
    ["frameready", "video_ready"],
    ["votetimeout", "vote_timeout"],
    ["voteend", "vote_timeout"],
    ["votoacabou", "vote_timeout"],
    ["semvoto", "vote_timeout"],
    ["next", "next"],
    ["proxima", "next"],
    ["prox", "next"],
    ["previous", "previous_round"],
    ["prev", "previous_round"],
    ["anterior", "previous_round"],
    ["nextround", "next_round"],
    ["proximarodada", "next_round"],
    ["finish", "finish"],
    ["finalizar", "finish"],
    ["encerrar", "finish"],
    ["cancel", "cancel"],
    ["cancelar", "cancel"]
  ]);

  if (structuredActions.has(normalizedFirst)) {
    const action = structuredActions.get(normalizedFirst);
    return {
      action: "control",
      controlAction: action,
      payload: {
        answer: ["verdade", "true"].includes(normalizedFirst) ? "verdade" : normalizedFirst === "bolo" ? "bolo" : rest.join(" ")
      }
    };
  }

  return {
    action: "start",
    requestedGame: first
  };
}

export function createGameLogEntry(gameState = {}) {
  return {
    id: randomUUID(),
    type: "GAME_STATE",
    timestamp: new Date().toISOString(),
    gameId: gameState.id,
    phase: gameState.phase,
    startSource: gameState.startSource,
    public: false
  };
}
