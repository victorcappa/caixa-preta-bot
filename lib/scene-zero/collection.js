import { inferCountdownDurationFromText } from "../countdownText.js";

export const COLLECTION_ACTIONS = [
  "RAISE_HAND",
  "KEEP_HAND_RAISED",
  "LOWER_HAND",
  "CLAP",
  "CLAP_ONCE",
  "CLAP_COUNT",
  "CLAP_PATTERN",
  "STAND",
  "SIT",
  "POINT",
  "LOOK_AT",
  "CLOSE_EYES",
  "OPEN_EYES",
  "STEP_FORWARD",
  "STEP_BACK",
  "CHANGE_SEAT",
  "MAKE_SOUND",
  "SAY_ALOUD",
  "SAY_TOGETHER",
  "WHISPER",
  "REPEAT_PHRASE",
  "HUM",
  "COUNT",
  "CHOOSE_SIDE",
  "FREEZE",
  "JUMP",
  "JUMP_COUNT",
  "SILENCE",
  "VERBAL"
];

export const COLLECTION_TOPIC_REPERTOIRE = {
  sao_paulo: ["bairro, região e diferenças entre zonas", "capital ou fora", "tempo e meios de deslocamento", "metrô, CPTM, ônibus e baldeações", "Linhas Vermelha, Azul, Amarela e Verde", "trânsito, enchente e horário de pico", "atravessar a cidade e distância casa-trabalho", "moradia, aluguel e tamanho da casa", "Paulista, Centro, Minhocão, parques, feira, boteco, shopping e Virada Cultural", "delivery, padaria, estacionamento, segurança e vida noturna"],
  money_class: ["faixas variáveis de renda", "dívida e parcelamento", "aluguel ou imóvel", "carro e estacionamento", "preço aceitável", "algo abandonado por dinheiro"],
  work: ["CLT, PJ, freela, estudante ou desemprego", "presencial, remoto ou híbrido", "múltiplos empregos", "mensagem fora de horário", "fim de semana", "reuniões e função mal definida"],
  food: ["PF, marmita e quilo", "delivery", "cozinhar", "padaria e café", "cerveja e energético", "hábitos paulistanos e comida de madrugada"],
  habits: ["café, álcool, cigarro e maconha", "sono e ressaca", "virar a noite", "medicamentos cotidianos", "hábitos voluntários e coletivos"],
  flight_fear: ["medo e experiência de avião", "nunca ter voado", "turbulência e reação aos comissários", "demonstração e cartão de segurança", "corredor ou janela", "palmas no pouso", "risco versus passagem barata", "saída de emergência e confiança de sobrevivência"],
  digital: ["Instagram, TikTok e WhatsApp", "tempo de tela", "áudios e mensagens apagadas", "stalking e resposta tardia", "IA e recomendação algorítmica", "termos, cookies, localização e reconhecimento facial"],
  social: ["veio acompanhado", "mora sozinho ou divide casa", "confiança entre presentes", "emprestar dinheiro", "cuidar da mala", "seguir instrução humana ou da máquina"],
  obedience: ["velocidade de resposta", "resistência", "antecipação", "imitação coletiva", "obediência automática", "confusão produtiva"]
};

const ANSWER_TYPES = new Set(["binary", "range", "count", "choice", "verbal", "gesture", "silence", "qualitative"]);
const SENSITIVITY = new Set(["low", "medium", "high"]);
const SCOPES = new Set(["room", "subgroup", "individual"]);
const ACTIONS = new Set(COLLECTION_ACTIONS);
const HAND_ACTIONS = new Set(["RAISE_HAND", "KEEP_HAND_RAISED"]);
const HAND_TEXT = /\b(?:levante(?:m)?|mantenha(?:m)?)\s+(?:(?:a|as)\s+)?m[aã]os?\b/iu;

function clean(value, limit = 500) {
  return `${value || ""}`.trim().replace(/\s+/g, " ").slice(0, limit);
}

function parseJson(rawText = "") {
  const text = `${rawText || ""}`
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function parseCollectionIntervention(rawText = "") {
  const parsed = parseJson(rawText);
  const text = clean(parsed?.fala || parsed?.text, 1200);
  if (!parsed || !text) return null;

  const question = parsed.question && typeof parsed.question === "object" ? parsed.question : {};
  const inferredDuration = inferCountdownDurationFromText(text);
  const action = ACTIONS.has(question.action) ? question.action : "VERBAL";

  return {
    text,
    data: {
      topic: clean(question.topic, 80) || "uncategorized",
      action,
      expectedAnswerType: ANSWER_TYPES.has(question.expectedAnswerType) ? question.expectedAnswerType : "qualitative",
      result: null,
      estimatedCount: null,
      intensity: Math.min(5, Math.max(0, Math.round(Number(question.intensity) || 0))),
      sensitivity: SENSITIVITY.has(question.sensitivity) ? question.sensitivity : "low",
      locationContext: clean(question.locationContext, 180) || null,
      scope: SCOPES.has(question.scope) ? question.scope : "room",
      conditions: Array.isArray(question.conditions)
        ? question.conditions.map((condition) => clean(condition, 120)).filter(Boolean).slice(0, 5)
        : [],
      waitSeconds: inferredDuration || null
    }
  };
}

function recentCollectionActions(questions = []) {
  return questions
    .slice(-4)
    .map((question) => question?.action)
    .filter(Boolean);
}

export function shouldRejectRepeatedHandAction(intervention, questions = []) {
  const handWasUsedRecently = questions.slice(-4).some((question) => (
    HAND_ACTIONS.has(question?.action) || HAND_TEXT.test(`${question?.text || ""}`)
  ));
  if (!handWasUsedRecently) return false;
  return HAND_ACTIONS.has(intervention?.data?.action) || HAND_TEXT.test(`${intervention?.text || ""}`);
}

export function collectionRepertoireBlock(questions = []) {
  const recentActions = recentCollectionActions(questions);
  const handWasUsedRecently = questions.slice(-4).some((question) => (
    HAND_ACTIONS.has(question?.action) || HAND_TEXT.test(`${question?.text || ""}`)
  ));

  return [
    "REPERTÓRIO DE DIMENSÕES (assuntos, nunca perguntas prontas):",
    ...Object.entries(COLLECTION_TOPIC_REPERTOIRE).map(([topic, dimensions]) => `- ${topic}: ${dimensions.join("; ")}`),
    `AÇÕES SEGURAS DISPONÍVEIS: ${COLLECTION_ACTIONS.join(", ")}.`,
    "ROTAÇÃO OBRIGATÓRIA DE AÇÕES: levantar a mão é recurso raro, não resposta padrão. Use RAISE_HAND/KEEP_HAND_RAISED no máximo uma vez a cada cinco intervenções.",
    handWasUsedRecently
      ? "PROIBIDO NESTA INTERVENÇÃO: levantar ou manter a mão. Uma ação de mão levantada já apareceu nas quatro intervenções recentes. Escolha outra família e não escreva esse gesto na fala. LOWER_HAND continua permitido apenas para encerrar fisicamente uma instrução anterior."
      : "Mesmo sem mão levantada recente, prefira primeiro uma ação vocal, sonora, rítmica, espacial, gestual ou de silêncio.",
    `AÇÕES RECENTES: ${recentActions.length ? recentActions.join(" -> ") : "nenhuma"}. A próxima deve mudar de família.`,
    "REPERTÓRIO DE AÇÕES MAIS INTERESSANTES: peça um número exato de palmas, como três; crie um padrão curto de palmas; faça todos dizerem algo em voz alta ou juntos; peça uma resposta curta em coro; sussurro; repetição de frase; som ou imitação; cantarolar; contar; apontar; olhar para alguém ou para um lugar; escolher um lado; levantar/sentar; avançar/recuar; congelar; fechar os olhos; ou produzir silêncio por duração explícita.",
    "VARIE TAMBÉM A FORMA VOCAL: não transforme SAY_ALOUD ou VERBAL numa sequência de 'diga uma palavra'. Pode pedir número, nome, bairro, preço, frase curta, mentira, previsão, acusação leve, resposta simultânea ou respostas em ordem, conforme o assunto e sem expor intimidade.",
    "CHANGE_SEAT só pode ser escolhido quando o contexto do operador confirmar explicitamente que há espaço e segurança. Não peça corrida, empurrão, subida em objetos, contato físico obrigatório ou movimento perigoso.",
    "Em tema sensível, use adesão voluntária e resposta coletiva; nunca pressione um indivíduo a revelar substância, renda exata, saúde ou intimidade.",
    "Dinheiro deve usar faixas variáveis e respostas coletivas, nunca salário exato obrigatório.",
    "A forma corporal de responder também pode carregar o humor. Não trate pergunta e ação como blocos burocráticos separados.",
    "ESTRATÉGIA: comece normal para ensinar obediência; aumente gradualmente especificidade, localidade, comparação, comprometimento, burocracia e corporalidade.",
    "Alterne escala entre sala, subgrupo, indivíduo e sala. Não transforme tudo em entrevista individual.",
    "Use condicionamento quando houver base real, mas não dependa de manter mãos levantadas: uma resposta vocal, posição na sala, escolha de lado, sequência de palmas, olhar, silêncio ou som também pode criar segmentos. Cruze respostas anteriores e faça follow-up em interseções reais.",
    "Varie tópico e ação em relação às intervenções recentes. Trate obediência, resistência, demora, confusão e antecipação como dados da própria coleta.",
    "Pode aplicar falsa precisão e linguagem científica a uma amostra pequena, mas nunca invente número, resultado ou reação.",
    "Antes de criar a intervenção, considere silenciosamente: dados conhecidos, lacunas, repetição, follow-up, segmentos, contexto local, intensidade e disposição da sala em obedecer."
  ].join("\n");
}
