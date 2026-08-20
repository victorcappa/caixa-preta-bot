import { getVerdadeOuBoloRuntimeConfig } from "./config.js";

export const VERDADE_OU_BOLO_ID = "verdade_ou_bolo";

export const VERDADE_OU_BOLO_STATES = {
  idle: "IDLE",
  intro: "INTRO",
  question: "QUESTION",
  answerLocked: "ANSWER_LOCKED",
  voting: "VOTING",
  reveal: "REVEAL",
  roundResult: "ROUND_RESULT",
  gameResult: "GAME_RESULT",
  finished: "FINISHED"
};

const VALID_ANSWERS = new Set(["verdade", "bolo"]);

function normalizeAnswer(answer = "") {
  const normalized = `${answer || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  if (normalized === "verdade" || normalized === "v" || normalized === "true") {
    return "verdade";
  }

  if (normalized === "bolo" || normalized === "b" || normalized === "false") {
    return "bolo";
  }

  return null;
}

function now() {
  return new Date().toISOString();
}

function command(action, sequence, payload = {}) {
  return {
    action,
    sequence: sequence + 1,
    issuedAt: now(),
    ...payload
  };
}

function votingCountdown() {
  const startedAt = Date.now();
  const durationSeconds = 10;

  return {
    durationSeconds,
    startedAt,
    endsAt: startedAt + (durationSeconds * 1000)
  };
}

function publicRound(round, index, totalRounds) {
  return {
    id: round.id,
    title: round.title,
    number: index + 1,
    total: totalRounds,
    video: round.video
  };
}

function operatorSnapshot(current, round) {
  return {
    ...(current.publicData?.operator || {}),
    correctAnswer: round?.correctAnswer || null
  };
}

function currentPrivateRound(gameState) {
  const index = gameState.publicData?.currentRoundIndex || 0;
  return gameState.privateData?.rounds?.[index] || null;
}

function finalMessageFor(score, finalMessages = {}) {
  return finalMessages[score] || "FIM DE JOGO. A CONTABILIDADE SOBREVIVEU.";
}

function recalculateScore(roundResults = []) {
  return roundResults.filter((round) => round.won).length;
}

function nextPublicData(current, patch = {}) {
  return {
    ...current.publicData,
    ...patch
  };
}

function moveToRound(current, index, { recovery = false } = {}) {
  const rounds = current.privateData.rounds || [];
  const clampedIndex = Math.max(0, Math.min(rounds.length - 1, index));
  const existingResult = (current.publicData.roundResults || []).find((result) => result.round === clampedIndex + 1);
  const state = existingResult ? VERDADE_OU_BOLO_STATES.roundResult : VERDADE_OU_BOLO_STATES.question;
  const videoSequence = current.publicData.videoCommand?.sequence || 0;

  return {
    ...current,
    phase: state,
    publicData: nextPublicData(current, {
      state,
      currentRoundIndex: clampedIndex,
      currentRound: publicRound(rounds[clampedIndex], clampedIndex, rounds.length),
      operator: operatorSnapshot(current, rounds[clampedIndex]),
      selectedAnswer: existingResult?.selected || null,
      revealedAnswer: existingResult?.correct || null,
      result: existingResult || null,
      revealArmed: false,
      voteCountdown: null,
      autoAdvanceCommand: null,
      recovery,
      videoCommand: command("reset", videoSequence)
    }),
    updatedAt: now()
  };
}

export function createVerdadeOuBoloGameData() {
  const config = getVerdadeOuBoloRuntimeConfig();
  const totalRounds = config.rounds.length;

  return {
    phase: VERDADE_OU_BOLO_STATES.question,
    score: { audience: 0 },
    publicData: {
      structuredGame: true,
      gameType: VERDADE_OU_BOLO_ID,
      title: config.title,
      state: VERDADE_OU_BOLO_STATES.question,
      totalRounds,
      currentRoundIndex: 0,
      currentRound: publicRound(config.rounds[0], 0, totalRounds),
      selectedAnswer: null,
      revealedAnswer: null,
      result: null,
      roundResults: [],
      score: 0,
      revealArmed: false,
      voteCountdown: null,
      autoAdvanceCommand: null,
      finalMessage: null,
      finishedPayload: null,
      videoCommand: command("reset", 0),
      audioCommand: command("stop", 0),
      sounds: config.sounds,
      operator: {
        correctAnswer: config.rounds[0]?.correctAnswer || null,
        videoDir: config.videoDir,
        discoveredVideos: config.discoveredVideos,
        configuredRounds: config.rounds.map((round) => ({
          id: round.id,
          file: round.video?.file || null,
          correctAnswer: round.correctAnswer || null
        }))
      }
    },
    privateData: {
      rounds: config.rounds,
      sounds: config.sounds,
      finalMessages: config.finalMessages,
      onGameFinishedEvent: null
    }
  };
}

export function isVerdadeOuBolo(gameState = {}) {
  return gameState?.id === VERDADE_OU_BOLO_ID || gameState?.publicData?.gameType === VERDADE_OU_BOLO_ID;
}

export function controlVerdadeOuBolo(current, action, payload = {}) {
  if (!isVerdadeOuBolo(current)) {
    return {
      gameState: current,
      applied: false,
      result: { type: "wrong_game" }
    };
  }

  const state = current.publicData?.state || current.phase || VERDADE_OU_BOLO_STATES.idle;
  const videoSequence = current.publicData.videoCommand?.sequence || 0;
  const audioSequence = current.publicData.audioCommand?.sequence || 0;
  const round = currentPrivateRound(current);
  const roundIndex = current.publicData.currentRoundIndex || 0;
  const totalRounds = current.privateData.rounds?.length || current.publicData.totalRounds || 4;

  if (action === "comment_complete") {
    if (![VERDADE_OU_BOLO_STATES.reveal, VERDADE_OU_BOLO_STATES.roundResult].includes(state) || !current.publicData.result) {
      return {
        gameState: current,
        applied: false,
        result: { type: "comment_complete_ignored", state }
      };
    }

    const firstAdvance = controlVerdadeOuBolo(current, "next");
    if (!firstAdvance.applied || firstAdvance.gameState.phase !== VERDADE_OU_BOLO_STATES.roundResult) {
      return firstAdvance;
    }

    const secondAdvance = controlVerdadeOuBolo(firstAdvance.gameState, "next");
    return secondAdvance.applied
      ? {
        ...secondAdvance,
        result: {
          ...secondAdvance.result,
          type: secondAdvance.gameState.phase === VERDADE_OU_BOLO_STATES.gameResult
            ? "comment_complete_game_result"
            : "comment_complete_next_round"
        }
      }
      : secondAdvance;
  }

  if (action === "intro") {
    return {
      applied: true,
      result: { type: "intro" },
      gameState: {
        ...current,
        phase: VERDADE_OU_BOLO_STATES.intro,
        publicData: nextPublicData(current, {
          state: VERDADE_OU_BOLO_STATES.intro,
          selectedAnswer: null,
          revealedAnswer: null,
          result: null,
          revealArmed: false,
          voteCountdown: null,
          autoAdvanceCommand: null,
          audioCommand: command("stop", audioSequence)
        }),
        updatedAt: now()
      }
    };
  }

  if (action === "start_round") {
    return {
      applied: true,
      result: { type: "start_round", round: roundIndex + 1 },
      gameState: moveToRound(current, roundIndex)
    };
  }

  if (action === "video_ready") {
    if (state !== VERDADE_OU_BOLO_STATES.question) {
      return {
        gameState: current,
        applied: false,
        result: { type: "video_ready_ignored", state }
      };
    }

    return {
      applied: true,
      result: { type: "vote_countdown_started", round: roundIndex + 1 },
      gameState: {
        ...current,
        phase: VERDADE_OU_BOLO_STATES.voting,
        publicData: nextPublicData(current, {
          state: VERDADE_OU_BOLO_STATES.voting,
          voteCountdown: votingCountdown()
        }),
        updatedAt: now()
      }
    };
  }

  if (action === "video_play" || action === "video_pause" || action === "video_restart") {
    const videoAction = action.replace("video_", "");

    if (![VERDADE_OU_BOLO_STATES.reveal, VERDADE_OU_BOLO_STATES.roundResult].includes(state)) {
      return {
        gameState: current,
        applied: false,
        result: { type: "video_blocked", reason: "answer_not_revealed", state }
      };
    }

    return {
      applied: true,
      result: { type: action, round: roundIndex + 1 },
      gameState: {
        ...current,
        publicData: nextPublicData(current, {
          videoCommand: command(videoAction, videoSequence)
        }),
        updatedAt: now()
      }
    };
  }

  if (action === "select_answer") {
    const selectedAnswer = normalizeAnswer(payload.answer);

    if (!VALID_ANSWERS.has(selectedAnswer) || ![
      VERDADE_OU_BOLO_STATES.question,
      VERDADE_OU_BOLO_STATES.answerLocked,
      VERDADE_OU_BOLO_STATES.voting
    ].includes(state)) {
      return {
        gameState: current,
        applied: false,
        result: { type: "answer_not_accepted", state, selectedAnswer }
      };
    }

    return {
      applied: true,
      result: { type: "answer_locked", selectedAnswer, round: roundIndex + 1 },
      gameState: {
        ...current,
        phase: state === VERDADE_OU_BOLO_STATES.voting ? VERDADE_OU_BOLO_STATES.voting : VERDADE_OU_BOLO_STATES.answerLocked,
        publicData: nextPublicData(current, {
          state: state === VERDADE_OU_BOLO_STATES.voting ? VERDADE_OU_BOLO_STATES.voting : VERDADE_OU_BOLO_STATES.answerLocked,
          selectedAnswer,
          revealedAnswer: null,
          result: null,
          revealArmed: false
        }),
        updatedAt: now()
      }
    };
  }

  function revealNow({ noVote = false } = {}) {
    const selected = current.publicData.selectedAnswer;
    const correct = normalizeAnswer(round?.correctAnswer);

    if ((!selected && !noVote) || !correct) {
      return {
        gameState: current,
        applied: false,
        result: { type: "cannot_reveal", reason: !selected ? "missing_selection" : "missing_correct_answer" }
      };
    }

    const previousResults = current.publicData.roundResults || [];
    const existingResult = previousResults.find((result) => result.round === roundIndex + 1);
    const won = noVote ? false : selected === correct;
    const roundResult = existingResult || {
      round: roundIndex + 1,
      selected: noVote ? null : selected,
      correct,
      won,
      noVote,
      revealedAt: now()
    };
    const roundResults = existingResult
      ? previousResults
      : [...previousResults, roundResult].sort((a, b) => a.round - b.round);
    const score = recalculateScore(roundResults);

    return {
      applied: true,
      result: { type: "reveal", ...roundResult, score },
      gameState: {
        ...current,
        phase: VERDADE_OU_BOLO_STATES.reveal,
        score: { audience: score },
        publicData: nextPublicData(current, {
          state: VERDADE_OU_BOLO_STATES.reveal,
          revealArmed: false,
          voteCountdown: null,
          autoAdvanceCommand: null,
          revealedAnswer: correct,
          result: roundResult,
          roundResults,
          score,
          audioCommand: command(won ? "win" : "lose", audioSequence, {
            src: won ? current.privateData.sounds?.win?.src : current.privateData.sounds?.lose?.src
          }),
          videoCommand: command("pause", videoSequence)
        }),
        updatedAt: now()
      }
    };
  }

  if (action === "reveal") {
    if (state === VERDADE_OU_BOLO_STATES.reveal || state === VERDADE_OU_BOLO_STATES.roundResult) {
      return {
        applied: true,
        result: { type: "already_revealed", round: roundIndex + 1 },
        gameState: {
          ...current,
          phase: VERDADE_OU_BOLO_STATES.roundResult,
          publicData: nextPublicData(current, {
            state: VERDADE_OU_BOLO_STATES.roundResult,
            voteCountdown: null,
            autoAdvanceCommand: null
          }),
          updatedAt: now()
        }
      };
    }

    if ([
      VERDADE_OU_BOLO_STATES.question,
      VERDADE_OU_BOLO_STATES.answerLocked,
      VERDADE_OU_BOLO_STATES.voting
    ].includes(state)) {
      return revealNow({ noVote: !current.publicData.selectedAnswer });
    }

    return {
      gameState: current,
      applied: false,
      result: { type: "cannot_reveal", reason: "invalid_state", state }
    };
  }

  if (action === "video_ended") {
    if (state !== VERDADE_OU_BOLO_STATES.reveal || !current.publicData.revealArmed) {
      return {
        gameState: current,
        applied: false,
        result: { type: "video_ended_ignored", state }
      };
    }

    return revealNow();
  }

  if (action === "vote_timeout") {
    if (state !== VERDADE_OU_BOLO_STATES.voting) {
      return {
        gameState: current,
        applied: false,
        result: { type: "vote_timeout_ignored", state }
      };
    }

    return revealNow({ noVote: !current.publicData.selectedAnswer });
  }

  if (action === "next") {
    if (state === VERDADE_OU_BOLO_STATES.intro) {
      return {
        applied: true,
        result: { type: "start_round", round: roundIndex + 1 },
        gameState: moveToRound(current, roundIndex)
      };
    }

    if (state === VERDADE_OU_BOLO_STATES.reveal && current.publicData.revealArmed) {
      return {
        gameState: current,
        applied: false,
        result: { type: "next_blocked", reason: "reveal_video_playing" }
      };
    }

    if (state === VERDADE_OU_BOLO_STATES.voting) {
      return {
        gameState: current,
        applied: false,
        result: { type: "next_blocked", reason: "vote_countdown_running" }
      };
    }

    if (state === VERDADE_OU_BOLO_STATES.reveal) {
      return {
        applied: true,
        result: { type: "round_result", round: roundIndex + 1 },
        gameState: {
          ...current,
          phase: VERDADE_OU_BOLO_STATES.roundResult,
          publicData: nextPublicData(current, {
            state: VERDADE_OU_BOLO_STATES.roundResult
          }),
          updatedAt: now()
        }
      };
    }

    if (state === VERDADE_OU_BOLO_STATES.roundResult) {
      if (roundIndex + 1 >= totalRounds) {
        const score = current.publicData.score || 0;
        const finalPayload = {
          game: VERDADE_OU_BOLO_ID,
          score,
          totalRounds,
          rounds: current.publicData.roundResults || []
        };

        return {
          applied: true,
          result: { type: "game_result", ...finalPayload },
          gameState: {
            ...current,
            phase: VERDADE_OU_BOLO_STATES.gameResult,
            publicData: nextPublicData(current, {
              state: VERDADE_OU_BOLO_STATES.gameResult,
              finalMessage: finalMessageFor(score, current.privateData.finalMessages),
              finishedPayload: finalPayload,
              revealArmed: false,
              voteCountdown: null,
              autoAdvanceCommand: null,
              audioCommand: command("stop", audioSequence),
              videoCommand: command("reset", videoSequence)
            }),
            privateData: {
              ...current.privateData,
              onGameFinishedEvent: finalPayload
            },
            updatedAt: now()
          }
        };
      }

      return {
        applied: true,
        result: { type: "next_round", round: roundIndex + 2 },
        gameState: moveToRound(current, roundIndex + 1)
      };
    }

    return {
      gameState: current,
      applied: false,
      result: { type: "next_blocked", state }
    };
  }

  if (action === "previous_round" || action === "next_round") {
    const delta = action === "previous_round" ? -1 : 1;
    const gameState = moveToRound(current, roundIndex + delta, { recovery: true });

    return {
      applied: gameState.publicData.currentRoundIndex !== roundIndex,
      result: { type: "recovery_round", round: gameState.publicData.currentRoundIndex + 1 },
      gameState
    };
  }

  if (action === "finish" || action === "cancel") {
    return {
      applied: true,
      result: {
        type: action === "finish" ? "finished" : "cancelled",
        payload: current.privateData.onGameFinishedEvent || current.publicData.finishedPayload || null
      },
      gameState: {
        ...current,
        active: false,
        phase: VERDADE_OU_BOLO_STATES.finished,
        publicData: nextPublicData(current, {
          state: VERDADE_OU_BOLO_STATES.finished,
          revealArmed: false,
          voteCountdown: null,
          autoAdvanceCommand: null,
          audioCommand: command("stop", audioSequence),
          videoCommand: command("reset", videoSequence)
        }),
        endedAt: now(),
        updatedAt: now(),
        cooldownTurnsRemaining: 0,
        lastStopSource: "operator"
      }
    };
  }

  return {
    gameState: current,
    applied: false,
    result: { type: "unknown_action", action }
  };
}
