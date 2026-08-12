const NUMBER_WORDS = new Map([
  ["tres", 3],
  ["quatro", 4],
  ["cinco", 5],
  ["seis", 6],
  ["sete", 7],
  ["oito", 8],
  ["nove", 9],
  ["dez", 10],
  ["onze", 11],
  ["doze", 12],
  ["treze", 13],
  ["quatorze", 14],
  ["catorze", 14],
  ["quinze", 15],
  ["dezesseis", 16],
  ["dezessete", 17],
  ["dezoito", 18],
  ["dezenove", 19],
  ["vinte", 20],
  ["trinta", 30],
  ["quarenta", 40],
  ["cinquenta", 50],
  ["sessenta", 60]
]);

function normalizeText(text = "") {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function clampCountdown(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.min(60, Math.max(3, number));
}

export function inferCountdownDurationsFromText(text = "") {
  const normalized = normalizeText(text);
  const matches = [];
  const digitPattern = /\b([3-9]|[1-5][0-9]|60)\s*(?:segundo|segundos|s)\b/g;

  for (const match of normalized.matchAll(digitPattern)) {
    matches.push({
      index: match.index,
      duration: clampCountdown(match[1])
    });
  }

  for (const [word, value] of NUMBER_WORDS) {
    const pattern = new RegExp(`\\b${word}\\s+(?:segundo|segundos)\\b`, "g");
    for (const match of normalized.matchAll(pattern)) {
      matches.push({
        index: match.index,
        duration: clampCountdown(value)
      });
    }
  }

  return matches
    .filter((match) => match.duration)
    .sort((a, b) => a.index - b.index)
    .map((match) => match.duration);
}

export function inferCountdownDurationFromText(text = "") {
  const durations = inferCountdownDurationsFromText(text);

  if (!durations.length) {
    return null;
  }

  return durations[durations.length - 1];
}
