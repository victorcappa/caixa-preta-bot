export function isSceneZeroSuitcaseResultMessage(message) {
  return /^scene-zero-(gincana|hangman)-(result|retry)(:|$)/.test(message?.source || "");
}

export function sceneZeroSuitcaseResultSounds(sceneZero) {
  if (sceneZero?.stage !== "suitcases") return [];
  const game = sceneZero.suitcaseGame || {};
  const selection = game.suitcaseSelectionSequence || 0;
  const preDrawHangman = game.choice?.targetSuitcase === 1
    && game.choice.status?.startsWith("challenge");
  const sounds = [];
  const gincana = game.gincana;
  if (game.currentSuitcase === 2 && !preDrawHangman
    && ["completed", "failed"].includes(gincana?.result) && gincana.timer?.completedAt) {
    sounds.push({
      key: `gincana:${selection}:${gincana.timer.sequence}:${gincana.timer.completedAt}:${gincana.result}`,
      effect: gincana.result === "completed" ? "success" : "error"
    });
  }

  const hangman = game.hangman;
  if ((game.currentSuitcase === 1 || preDrawHangman)
    && ["won", "lost", "retry_wait"].includes(hangman?.status)) {
    const won = hangman.status === "won";
    // A loss is published as retry_wait; announcing -> ready is still the same loss.
    const attempt = hangman.status === "retry_wait"
      ? `retry:${hangman.retry?.count}:${hangman.timer?.sequence}`
      : `${hangman.sequence}:${hangman.timer?.completedAt}`;
    sounds.push({
      key: `hangman:${hangman.activity?.id}:${hangman.wordId}:${attempt}:${won ? "won" : "lost"}`,
      effect: won ? "success" : "error"
    });
  }

  if (game.currentSuitcase === 3 && game.status === "finished" && game.endedAt) {
    sounds.push({ key: `final:${selection}:${game.endedAt}`, effect: "success" });
  }
  return sounds;
}
