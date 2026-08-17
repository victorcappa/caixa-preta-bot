export const DEFAULT_FADE_MS = 950;

export const scriptLines = [
  "1: QUANTAS MEDALHAS VOCÊ TEM?",
  "2: DE CORRIDA?",
  "1: É!",
  "2: OLHA, QUE EU FUI BEM, ACREDITO QUE DEU UMAS TRINTA.",
  "1: (RISOS). BRINCADEIRA, NÉ?",
  "2: E A DONA RÔ CORRIA TAMBÉM.",
  "1: ELA NÃO CORRE MAIS NÃO?",
  "2: AH, CORRE DEVAGAR. ELA NÃO GOSTA MUITO. ELA VAI SÓ POR... SE FOR UMA CORRIDA... TEM VÁRIAS CORRIDAS... OLHA QUE ELA ESCOLHEU SEIS HORAS DA MANHÃ PRA CORRER... CORRER SEIS HORAS DA MANHÃ?",
  "1: AHHHH! CORRE EM ÉPOCA DE CRUZEIRO, SÓ?",
  "[mostra algo no celular]",
  "2: CONHECE? JÁ FOI?",
  "1: NUNCA FUI!",
  "2: ISSO AQUI A GENTE CHEGOU EM UM PASSEIO NESSE ÔNIBUS, LÁ NO PARQUE DAS CATARATAS. A CIDADE DE... LÁ É CHEIO DE BICHOS. AQUELES... NÃO SEI SE QUATIS. AÍ OS QUATIS ARRANCARAM O SACO DA MÃO DELA E DESTRUÍRAM.",
  "1: CARACA...",
  "2: Aí EU FUI PEGAR A FOTO E TUNNN... OLHA AÍ. ACABARAM O QUE A GENTE TINHA NO SACO.",
  "[silêncio]",
  "1: A PESSOA DEPOIS DA D50 NÃO TEM COMO ELEVAR O NÍVEL NÃO?",
  "2: NÃO TEM. NÃO.",
  "[aparentemente mostra algo do celular]",
  "2: OLHA A MOTO!",
  "1: A FOTO DO CARRO QUE VOCÊ NÃO ME MOSTROU.",
  "2: ESSA EU IA TE MOSTRAR... ESSA AQUI!",
  "1: A FOTO DA BICICLETA?",
  "2: VAMO VER SE TÁ AQUI.",
  "[mostra a bicicleta e mostra a moto]",
  "2: MOTINHA BOA! OLHA AÍ. UMA BOA MOTO. QUER VER CARRO BOM, É ASSIM... CONHECE CARRO MELHOR DO QUE NÓS. QUER VER O CARRO?",
  "[Às 19h56min54s, ouve-se da cabine de comando um barulho como se um carro tivesse entrando de jeito em cima de um quebra-mola. O jato Legacy colide com o avião 1907 da Gol com 154 pessoas a bordo em uma região da floresta amazônica conhecida como BURACO NEGRO Uma sequência de alarmes começa a soar: STALL; STALL; STALL]",
  "1: AIII!",
  "2: O QUE ACONTECEU?",
  "1: EU NÃO SEI! AI MEU PAI!",
  "2: CALMA, CALMA.",
  "1: AI, QUE MERDA. Ô MEU DEUS!",
  "2: PERAÍ, CALMA!",
  "1: AI QUE MERDA!!",
  "2: CALMA, THIAGO! CALMA, THIAGO!",
  "1: AIII!"
];

export const subdivisionOptions = [
  { value: "line", label: "Falas inteiras" },
  { value: "sentence", label: "Frases" },
  { value: "pause", label: "Pausas" },
  { value: "short", label: "Blocos curtos" }
];

export function isStageDirection(text) {
  return /^\[.+\]$/.test(text.trim()) || /^\(.+\)$/.test(text.trim());
}

export function getHoldMs(text, isStage, options = {}) {
  const pace = options.pace ?? 1;
  const stageMultiplier = options.stageMultiplier ?? 1;

  if (isStage) {
    return Math.round(Math.min(16000, Math.max(5200, text.length * 58)) * pace * stageMultiplier);
  }

  return Math.round(Math.min(9000, Math.max(1900, text.length * 42)) * pace);
}

export function buildSegments(lines, subdivision = "line", timingOptions = {}) {
  return lines.flatMap((line, lineIndex) => {
    const stage = isStageDirection(line);
    const parts = stage ? [line] : splitLine(line, subdivision);

    return parts.map((text, partIndex) => ({
      id: `${lineIndex}-${partIndex}`,
      text,
      sourceLine: line,
      sourceIndex: lineIndex,
      partIndex,
      stage,
      holdMs: getHoldMs(text, stage, timingOptions)
    }));
  });
}

function splitLine(line, subdivision) {
  if (subdivision === "sentence") {
    return splitBySentence(line);
  }

  if (subdivision === "pause") {
    return splitByPause(line);
  }

  if (subdivision === "short") {
    return splitByLength(line, 78);
  }

  return [line];
}

function splitBySentence(line) {
  const speaker = getSpeakerPrefix(line);
  const body = speaker ? line.slice(speaker.length).trim() : line;
  const parts = body.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [body];

  return parts.map((part, index) => joinSpeaker(speaker, part.trim(), index));
}

function splitByPause(line) {
  const speaker = getSpeakerPrefix(line);
  const body = speaker ? line.slice(speaker.length).trim() : line;
  const parts = body
    .split(/(\.\.\.|[.!?]+)/)
    .reduce((acc, part) => {
      const previous = acc[acc.length - 1];

      if (/^(\.\.\.|[.!?]+)$/.test(part) && previous) {
        acc[acc.length - 1] = `${previous}${part}`;
        return acc;
      }

      if (part.trim()) {
        acc.push(part.trim());
      }

      return acc;
    }, []);

  return parts.map((part, index) => joinSpeaker(speaker, part, index));
}

function splitByLength(line, maxLength) {
  const speaker = getSpeakerPrefix(line);
  const body = speaker ? line.slice(speaker.length).trim() : line;
  const words = body.split(/\s+/);
  const parts = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      parts.push(current);
      current = word;
      return;
    }

    current = next;
  });

  if (current) {
    parts.push(current);
  }

  return parts.map((part, index) => joinSpeaker(speaker, part, index));
}

function getSpeakerPrefix(line) {
  const match = line.match(/^\d:\s*/);
  return match ? match[0] : "";
}

function joinSpeaker(speaker, text, index) {
  return index === 0 ? `${speaker}${text}` : text;
}
