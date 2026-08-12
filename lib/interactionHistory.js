import { inferHostMechanicIdFromText } from "./host/games.js";

const INTERACTION_PATTERNS = [
  {
    type: "SINGLE_WORD",
    patterns: [
      /\buma palavra\b/i,
      /\bpalavra curta\b/i,
      /\bdiga uma palavra\b/i,
      /\bdigam uma palavra\b/i,
      /\bescolha uma palavra\b/i
    ]
  },
  {
    type: "CHOICE",
    patterns: [
      /\bescolha\b/i,
      /\bescolham\b/i,
      /\bopcao\b/i,
      /\ba\/b\b/i,
      /\bde 0 a 10\b/i
    ]
  },
  {
    type: "SOCIAL_SELECTION",
    patterns: [
      /\bescolhe alguem\b/i,
      /\bescolham alguem\b/i,
      /\baponte alguem\b/i,
      /\bchame alguem\b/i,
      /\bquem aqui\b/i
    ]
  },
  {
    type: "PHYSICAL_ACTION",
    patterns: [
      /\blevanta\b/i,
      /\blevantem\b/i,
      /\bolha para\b/i,
      /\bmao\b/i,
      /\bfaca literalmente\b/i,
      /\bfiquem em silencio\b/i
    ]
  },
  {
    type: "VOTE",
    patterns: [
      /\bquem concorda\b/i,
      /\bvota\b/i,
      /\bvotem\b/i,
      /\blevanta a mao\b/i
    ]
  },
  {
    type: "WHY",
    patterns: [
      /\bpor que\b/i,
      /\bjustifique\b/i,
      /\bdefenda\b/i,
      /\bexplique\b/i
    ]
  },
  {
    type: "QUESTION",
    patterns: [
      /\?$/,
      /\bqual\b/i,
      /\bquem\b/i,
      /\bquando\b/i,
      /\bcomo\b/i
    ]
  },
  {
    type: "CALLBACK",
    patterns: [
      /\bvoltando\b/i,
      /\bagora vale\b/i,
      /\bcontinua no jogo\b/i,
      /\bregra nova\b/i,
      /\btradicao\b/i
    ]
  },
  {
    type: "ROAST_OR_COMMENT",
    patterns: [
      /\botimo\b/i,
      /\bpesado\b/i,
      /\baceitavel\b/i,
      /\bpessima\b/i,
      /\bparabens\b/i
    ]
  }
];

const CONTINUATION_PATTERNS = [
  /\?$/,
  /\bescolha\b/i,
  /\bescolham\b/i,
  /\bdiga\b/i,
  /\bdigam\b/i,
  /\bfale\b/i,
  /\bfalem\b/i,
  /\bentregue\b/i,
  /\bpeca\b/i,
  /\bchame\b/i,
  /\baponte\b/i,
  /\blevanta\b/i,
  /\blevantem\b/i,
  /\bolha\b/i,
  /\bquem\b/i,
  /\bagora\b/i,
  /\bproxima\b/i,
  /\bproximo\b/i
];

const CLOSURE_PATTERNS = [
  /\bregistr(o|ado|ada)\b/i,
  /\bvalidada\b/i,
  /\baprovado\b/i,
  /\baprovada\b/i,
  /\bserve\b/i,
  /\baceitavel\b/i,
  /\bperfeito\b/i,
  /\bfeito\b/i
];

const SHORT_COLLECTION_PATTERNS = [
  /\buma palavra\b/i,
  /\bpalavra curta\b/i,
  /\bdiga\b/i,
  /\bdigam\b/i,
  /\bescolha\b/i,
  /\bescolham\b/i,
  /\bresponda\b/i,
  /\brespondam\b/i,
  /\baceito\b/i,
  /\bsubstitui\b/i,
  /\bconsome\b/i,
  /\bpaga\b/i,
  /\besvazia\b/i,
  /\bcurioso\b/i
];

const PRESENCE_JUSTIFICATION_PATTERNS = [
  /\bpor que (?:voce |voces )?(?:veio|vieram|esta|estao)\b/i,
  /\bmotivo (?:de|pelo qual).{0,40}(?:veio|vieram|estar|estarem|aqui|teatro)\b/i,
  /\bjustifi(?:que|quem|ca).{0,40}(?:presenca|veio|vieram|aqui|teatro)\b/i,
  /\bdefenda.{0,50}(?:motivo|presenca|veio|vieram|estar aqui|trouxe aqui)\b/i,
  /\bo que (?:te|voces?) trouxe aqui\b/i
];

function classifyInteraction(content = "") {
  const text = content.trim();

  if (!text) {
    return "NONE";
  }

  for (const candidate of INTERACTION_PATTERNS) {
    if (candidate.patterns.some((pattern) => pattern.test(text))) {
      return candidate.type;
    }
  }

  return "COMMENT";
}

function hasConcreteContinuation(content = "") {
  const text = content.trim();

  if (!text) {
    return false;
  }

  return CONTINUATION_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildInteractionHistoryBlock(conversation = []) {
  const recentAssistantTurns = conversation
    .filter((message) => message.role === "assistant")
    .slice(-4)
    .map((message) => ({
      type: classifyInteraction(message.content),
      excerpt: `${message.content || ""}`.replace(/\s+/g, " ").slice(0, 90)
    }));

  const recentTypes = recentAssistantTurns.map((turn) => turn.type);
  const recentMechanicIds = recentAssistantTurns
    .map((turn) => inferHostMechanicIdFromText(turn.excerpt))
    .filter(Boolean);
  const recentMechanicSet = [...new Set(recentMechanicIds)];
  const lastType = recentTypes.at(-1) || null;
  const repeatedCount = lastType
    ? [...recentTypes].reverse().findIndex((type) => type !== lastType)
    : -1;
  const runLength = repeatedCount === -1 && lastType ? recentTypes.length : repeatedCount;
  const repetitionRisk = runLength >= 2 ? "high" : "normal";
  const forbiddenNextType = repetitionRisk === "high" ? lastType : null;
  const shortCollectionCount = recentAssistantTurns.filter((turn) => (
    SHORT_COLLECTION_PATTERNS.some((pattern) => pattern.test(turn.excerpt))
  )).length;
  const shortCollectionPressure = shortCollectionCount >= 2 ? "high" : "normal";
  const presenceJustificationCount = recentAssistantTurns.filter((turn) => (
    PRESENCE_JUSTIFICATION_PATTERNS.some((pattern) => pattern.test(turn.excerpt))
  )).length;
  const presenceJustificationPressure = presenceJustificationCount >= 1 ? "high" : "normal";
  const lastAssistant = recentAssistantTurns.at(-1);
  const lastWasClosure = lastAssistant
    ? CLOSURE_PATTERNS.some((pattern) => pattern.test(lastAssistant.excerpt))
    : false;
  const continuationRisk = lastAssistant && !hasConcreteContinuation(lastAssistant.excerpt)
    ? "high"
    : "normal";

  return `
HISTORICO RECENTE DE MECANICAS:
recentInteractionTypes = ${JSON.stringify(recentTypes)}
recentHostMechanics = ${JSON.stringify(recentMechanicSet)}
repetitionRisk = ${repetitionRisk}
forbiddenNextType = ${JSON.stringify(forbiddenNextType)}
shortCollectionPressure = ${shortCollectionPressure}
shortCollectionCount = ${shortCollectionCount}
presenceJustificationPressure = ${presenceJustificationPressure}
presenceJustificationCount = ${presenceJustificationCount}
lastAssistantHadConcreteContinuation = ${continuationRisk === "normal"}
continuationRisk = ${continuationRisk}
lastAssistantLookedLikeClosure = ${lastWasClosure}

Se repetitionRisk = high, nao use forbiddenNextType agora.
Se shortCollectionPressure = high, nao peca palavra, nome, opcao curta,
confirmacao "aceito" ou justificativa. Faca comentario, consequencia, acao
fisica, voto, tela, callback, encerramento do bit ou mude para outro tipo de
jogo.
Se presenceJustificationPressure = high, nao pergunte por que vieram, motivo
de estar aqui, nem peca defesa de presenca. Mude de eixo agora: jogo, voto,
celular, relacao, objeto, regra secreta, desenho, memoria, equipe ou callback.
Evite repetir recentHostMechanics ate o cooldown conceitual esfriar.
Reaja ao que o publico acabou de dizer antes de pedir outra coleta de dado.
Varie entre comentario, consequencia, acao fisica, callback, escolha, voto,
roast leve, regra arbitraria, outra pessoa, pausa ou comando direto.
Se continuationRisk = high, a proxima fala precisa abrir continuidade concreta.
Nao termine em registro seco, validacao ou conclusao administrativa.
`.trim();
}
