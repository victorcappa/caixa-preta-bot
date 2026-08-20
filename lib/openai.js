import OpenAI from "openai";
import { activityContextBlock } from "@/lib/activities";
import { caixaPretaSystemPrompt } from "@/prompts/caixaPreta";
import { inferCountdownDurationFromText } from "@/lib/countdownText";
import { gameContextBlock } from "@/lib/host/GameDirector";
import { buildInteractionHistoryBlock } from "@/lib/interactionHistory";
import { getKnowledgeContext } from "@/lib/knowledge";
import { getParticipantPool } from "@/lib/participants";
import {
  filterAgentPerformanceEvents,
  normalizePerformanceEvents,
  performanceCapabilitiesBlock,
  withInferredCountdownEvent
} from "@/lib/performanceEvents";
import { sanitizePublicTextForProjection } from "@/lib/publicText";
import { resolveOpenAIModel } from "@/lib/openaiModels";
import { enforceGuessWhoTurn, suitcaseContextBlock } from "@/lib/suitcases/SuitcaseDirector";
import { buildTrainingContextBlock } from "@/lib/training";
import { getModeRuntimeConfig } from "@/prompts/modes";
import { buildSceneZeroContext } from "@/lib/scene-zero/state";

let client;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY ausente. Configure a chave em .env.local.");
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  return client;
}

const MEMORY_STOPWORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "com",
  "para",
  "por",
  "que",
  "quem",
  "qual",
  "quando",
  "onde",
  "como",
  "esta",
  "estao",
  "foi",
  "ser",
  "ter",
  "tem",
  "ja",
  "ai",
  "isso",
  "isto",
  "aquilo",
  "voce",
  "voces",
  "publico",
  "caixa",
  "preta"
]);

function tokenize(text = "") {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !MEMORY_STOPWORDS.has(token));
}

function memoryBlock(memories, activeContext = "") {
  if (!memories.length) {
    return `<show_memories>
Nenhuma observacao silenciosa registrada nesta apresentacao.
</show_memories>`;
  }

  const selected = classifyMemories(memories, activeContext).slice(-30);
  const groups = [
    ["RECENT", selected.filter((memory) => memory.contextClass === "RECENT")],
    ["RELEVANT", selected.filter((memory) => memory.contextClass === "RELEVANT")],
    ["AVAILABLE", selected.filter((memory) => memory.contextClass === "AVAILABLE")]
  ];

  return [
    `<show_memories>`,
    `Estas observacoes sao contexto silencioso da apresentacao atual.`,
    `Elas nao sao uma mensagem do publico, nao sao uma tarefa e nao precisam ser reconhecidas.`,
    `Quando forem recentes, especificas e acionaveis, prefira estas observacoes a escolhas genericas.`,
    `Use observacoes para escolher pessoas reais, gerar acao, callback, contraste, humor ou mudanca de ritmo.`,
    `Preserve incerteza de frases com "parece", "aparentemente" ou sinais de hipotese.`,
    `Nao resuma, nao enumere e nao prove que voce lembra. Se nao houver oportunidade real, ignore.`,
    ...groups.flatMap(([label, group]) => {
      if (!group.length) {
        return [];
      }

      return [
        ``,
        `${label}:`,
        ...group.map((memory) => {
          const time = new Date(memory.timestamp).toLocaleTimeString("pt-BR");
          return `- [${time}] ${memory.content}`;
        })
      ];
    }),
    `</show_memories>`
  ].join("\n");
}

function classifyMemories(memories, activeContext = "") {
  const now = Date.now();
  const newestIndex = Math.max(0, memories.length - 4);
  const activeTokens = new Set(tokenize(activeContext));

  return memories.map((memory, index) => {
    const timestamp = Date.parse(memory.timestamp);
    const ageMinutes = Number.isNaN(timestamp) ? Infinity : (now - timestamp) / 60000;
    const memoryTokens = tokenize(memory.content);
    const hasActiveOverlap = memoryTokens.some((token) => activeTokens.has(token));

    if (hasActiveOverlap) {
      return { ...memory, contextClass: "RELEVANT" };
    }

    if (index >= newestIndex || ageMinutes <= 10) {
      return { ...memory, contextClass: "RECENT" };
    }

    if (ageMinutes <= 60) {
      return { ...memory, contextClass: "RELEVANT" };
    }

    return { ...memory, contextClass: "AVAILABLE" };
  });
}

function conversationMessages(conversation) {
  return conversation.slice(-20).map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: `${message.role === "assistant" ? "CAIXA PRETA" : "PUBLICO"}: ${message.content}`
  }));
}

function participantsBlock(state = {}) {
  const pool = getParticipantPool({
    sessionParticipants: state.participants?.session || [],
    history: state.participants?.history || {}
  });

  const groups = [
    ["EQUIPE", pool.participants.filter((participant) => participant.source === "team")],
    ["PUBLICO", pool.participants.filter((participant) => participant.source === "audience")],
    ["SESSAO", pool.participants.filter((participant) => participant.source === "session")]
  ];

  return [
    "PARTICIPANTES CONHECIDOS:",
    "Use estes nomes quando precisar escolher alguem ou quando o publico pedir a lista.",
    "Se este bloco tiver nomes, nao diga que nao tem lista; responda com os nomes disponiveis e conduza a proxima acao.",
    JSON.stringify({
      counts: pool.counts,
      groups: Object.fromEntries(groups.map(([label, participants]) => [
        label.toLowerCase(),
        participants.map((participant) => participant.name)
      ]))
    }, null, 2)
  ].join("\n");
}

function cleanModelText(text) {
  return sanitizePublicTextForProjection(text)
    .replace(/^(CAIXA PRETA|RESPOSTA)\s*:\s*/i, "")
    .trim();
}

function parseJsonObject(rawText = "") {
  const text = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!text.startsWith("{")) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseTurnEnvelope(rawText = "") {
  const text = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!text.startsWith("{")) {
    const publicText = cleanModelText(text);
    const inferredEvents = withInferredCountdownEvent([], publicText);
    return {
      text: publicText,
      events: normalizePerformanceEvents(filterAgentPerformanceEvents(inferredEvents, publicText), "agent"),
      salience: [],
      activity: null,
      game: null,
      suitcase: null
    };
  }

  try {
    const parsed = JSON.parse(text);
    const publicText = cleanModelText(parsed.text || "");
    const countdownDuration = inferCountdownDurationFromText(publicText);
    const events = Array.isArray(parsed.events)
      ? parsed.events.map((event) => {
        if (event?.type !== "COUNTDOWN" || !countdownDuration) {
          return event;
        }

        return {
          ...event,
          payload: {
            ...(event.payload || {}),
            duration: countdownDuration,
            from: countdownDuration,
            seconds: countdownDuration
          }
        };
      })
      : [];

    const eventsWithFallback = withInferredCountdownEvent(events, publicText);
    const safeEvents = filterAgentPerformanceEvents(eventsWithFallback, publicText);

    return {
      text: publicText,
      events: normalizePerformanceEvents(safeEvents, "agent"),
      salience: Array.isArray(parsed.salience)
        ? parsed.salience.slice(0, 6).map((item) => ({
          text: `${item.text || item || ""}`.slice(0, 120),
          type: item.type || "word",
          intensity: item.intensity || 3,
          origin: "agent"
        })).filter((item) => item.text)
        : [],
      activity: parsed.activity || null,
      game: parsed.game || null,
      suitcase: parsed.suitcase || null
    };
  } catch {
    const publicText = cleanModelText(text);
    const inferredEvents = withInferredCountdownEvent([], publicText);
    return {
      text: publicText,
      events: normalizePerformanceEvents(filterAgentPerformanceEvents(inferredEvents, publicText), "agent"),
      salience: [],
      activity: null,
      game: null,
      suitcase: null
    };
  }
}

function shouldAllowWebSearch(state) {
  const modeConfig = getModeRuntimeConfig(state.mode);
  return modeConfig.allowWebSearch && process.env.CAIXA_PRETA_WEB_SEARCH !== "false";
}

function webSearchTool() {
  const type = process.env.OPENAI_WEB_SEARCH_TOOL_TYPE || "web_search";
  const userLocation = {
    type: "approximate",
    country: "BR",
    timezone: process.env.TZ || "America/Sao_Paulo"
  };

  return {
    type,
    search_context_size: "low",
    user_location: userLocation
  };
}

function responseUsedWebSearch(response) {
  return response.output?.some((item) => item.type === "web_search_call") || false;
}

function isWebSearchToolError(error) {
  const message = [
    error?.message,
    error?.error?.message,
    error?.code,
    error?.param
  ].filter(Boolean).join(" ").toLowerCase();

  return (
    message.includes("web_search") ||
    message.includes("user_location") ||
    message.includes("tools[") ||
    (message.includes("tool") && message.includes("search"))
  );
}

export async function interpretInstagramOperatorRequest(requestText = "") {
  const response = await getClient().responses.create({
    model: resolveOpenAIModel(process.env.OPENAI_MODEL),
    input: [
      {
        role: "system",
        content: [
          "Voce interpreta pedidos do operador para uma integracao real com Instagram.",
          "Responda apenas JSON valido. Nao use Markdown.",
          "Escolha exatamente uma action desta lista: follow, open_profile, open_latest_media, open_nth_media, comment_latest, comment_nth_media, follow_and_comment_latest, watch_reels, open_directs, send_direct_latest, send_direct_thread, like_latest_media, like_nth_media, analyze_current, analyze_profile, analyze_recent_posts, analyze_latest_media.",
          "Nao invente a action. Nao execute nada. Apenas classifique a intencao.",
          "Extraia username mesmo quando vier como texto natural, por exemplo 'perfil do marcusgarcia'.",
          "Remova @ do username e use apenas letras, numeros, ponto e underline.",
          "Use follow_and_comment_latest quando o pedido pedir seguir e comentar na ultima foto/post/reel.",
          "Use watch_reels quando o operador pedir para assistir, ver, abrir ou entrar em reels sem pedir analise.",
          "Use open_directs quando o operador pedir para abrir/entrar/ver directs, DMs, inbox ou mensagens sem pedir envio de texto.",
          "Use send_direct_latest quando o operador pedir para entrar na ultima mensagem/conversa/direct e escrever/enviar uma mensagem.",
          "Use send_direct_thread quando o operador pedir direct/chat/grupo/conversa com nomes ou um grupo especifico; coloque o alvo em thread e o texto em message.",
          "Use open_latest_media ou open_nth_media quando o operador pedir para olhar/ver/abrir um post/foto/reel de um perfil sem pedir analise.",
          "Use comment_nth_media quando o operador pedir para comentar um post/foto/reel por posicao; coloque o numero em postIndex.",
          "Use like_latest_media para curtir ultimo post/foto/reel de um perfil.",
          "Use like_nth_media para curtir um post por posicao, como terceiro post; coloque o numero em postIndex.",
          "Use analyze_current quando o operador pedir para analisar a tela atual do Instagram sem perfil alvo.",
          "Use analyze_profile quando o operador pedir analise de um perfil.",
          "Use analyze_recent_posts quando o operador pedir para analisar ultimos posts/fotos/reels recentes de um perfil sem abrir um post especifico.",
          "Use analyze_latest_media quando o operador pedir analise da ultima foto/post/reel/midia de um perfil.",
          "Coloque em question o foco da analise, quando houver.",
          "Se o pedido pedir comentario aberto, como 'algo engracado', escreva um comentario curto em portugues, leve, nao ofensivo, sem hashtag, sem emoji e com ate 120 caracteres.",
          "Formato: {\"action\":\"send_direct_thread\",\"username\":\"\",\"comment\":\"\",\"message\":\"ola\",\"thread\":\"livinha janaina marcus\",\"postIndex\":0,\"question\":\"\"}"
        ].join("\n")
      },
      {
        role: "user",
        content: requestText
      }
    ]
  });

  const parsed = parseJsonObject(response.output_text || "");
  if (!parsed) {
    throw new Error("INSTAGRAM_INTENT_JSON_INVALID");
  }

  return parsed;
}

export async function analyzeInstagramScreenshot({ imageDataUrl, url = "", question = "", state = {} } = {}) {
  if (!imageDataUrl) {
    throw new Error("INSTAGRAM_ANALYSIS_IMAGE_EMPTY");
  }

  const response = await getClient().responses.create({
    model: resolveOpenAIModel(state.model, process.env.OPENAI_MODEL),
    input: [
      {
        role: "system",
        content: [
          "Voce e a Caixa Preta analisando visualmente uma tela real do Instagram para o operador.",
          "Responda em portugues do Brasil, curto e concreto, como uma fala que aparece no chat.",
          "Extraia dados visiveis: tipo de tela, perfil/usuario/textos legiveis, contagens, botoes, conteudo visual e sinais de estado.",
          "Separe fato visto de inferencia. Use 'parece' quando houver incerteza.",
          "Nao diga que clicou, seguiu ou comentou. Esta acao e somente analise visual.",
          "Nao identifique pessoas por rosto nem infira atributos sensiveis. Pode mencionar nomes de usuario e textos visiveis na tela.",
          "Se a imagem estiver escura, carregando ou ilegivel, diga isso claramente."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `URL atual: ${url || "desconhecida"}`,
              `Foco do operador: ${question || "analise geral da tela"}`
            ].join("\n")
          },
          {
            type: "input_image",
            image_url: imageDataUrl
          }
        ]
      }
    ],
    max_output_tokens: 450,
    reasoning: {
      effort: "minimal"
    }
  });

  return cleanModelText(response.output_text || "").slice(0, 1200);
}

export async function generateCaixaPretaTurn({ state, userMessage, operatorInstruction, allowPerformance = true }) {
  const knowledge = getKnowledgeContext();
  const allowWebSearch = shouldAllowWebSearch(state);
  const activeMemoryContext = [
    userMessage,
    operatorInstruction,
    ...state.conversation.slice(-6).map((message) => message.content)
  ].filter(Boolean).join("\n");
  const trainingContext = buildTrainingContextBlock({
    mode: state.mode,
    memories: state.memories,
    conversation: state.conversation.slice(-8),
    userMessage,
    operatorInstruction
  });
  const activityContext = activityContextBlock(state.performance?.activities || []);
  const gameContext = gameContextBlock(state);
  const suitcaseContext = suitcaseContextBlock(state);
  const sceneZeroContext = buildSceneZeroContext(state.sceneZero);
  const interactionHistoryContext = allowPerformance && state.mode === "host"
    ? buildInteractionHistoryBlock(state.conversation)
    : "";
  const systemPrompt = caixaPretaSystemPrompt({
    knowledge,
    variables: {
      ...state.variables,
      currentMode: state.mode,
      previousMode: state.previousMode,
      modeStartedAt: state.modeStartedAt
    }
  });

  if (process.env.NODE_ENV === "development") {
    console.log("[CAIXA PRETA]");
    console.log(`mode: ${state.mode}`);
    console.log("[CAIXA PRETA]");
    console.log(`memories: ${state.memories.length}`);
    console.log("[CAIXA PRETA]");
    console.log(`memory context: ${state.memories.length} available`);
    console.log("[CAIXA PRETA]");
    console.log(`conversation messages: ${state.conversation.length}`);
    console.log("[CAIXA PRETA]");
    console.log(`web search allowed: ${allowWebSearch}`);
    console.log("[CAIXA PRETA]");
    console.log("generating response");
  }

  const input = [
    {
      role: "system",
      content: systemPrompt
    },
    ...(allowPerformance
      ? [{
        role: "user",
        content: performanceCapabilitiesBlock()
      }]
      : []),
    ...(activityContext
      ? [{
        role: "user",
        content: activityContext
      }]
      : []),
    ...(allowPerformance && gameContext
      ? [{
        role: "user",
        content: gameContext
      }]
      : []),
    ...(allowPerformance && suitcaseContext
      ? [{
        role: "user",
        content: suitcaseContext
      }]
      : []),
    ...(sceneZeroContext
      ? [{
        role: "user",
        content: sceneZeroContext
      }]
      : []),
    ...(interactionHistoryContext
      ? [{
        role: "user",
        content: interactionHistoryContext
      }]
      : []),
    {
      role: "user",
      content: participantsBlock(state)
    },
    ...(trainingContext
      ? [{
        role: "user",
        content: trainingContext
      }]
      : []),
    {
      role: "user",
      content: `OBSERVACOES SILENCIOSAS DA APRESENTACAO:\n${memoryBlock(state.memories, activeMemoryContext)}`
    },
    ...conversationMessages(state.conversation)
  ];

  if (operatorInstruction) {
    input.push({
      role: "user",
      content: `ORIENTACAO DO OPERADOR:\n${operatorInstruction}\n\nGere somente a frase final que deve aparecer na projecao.`
    });
  } else {
    input.push({
      role: "user",
      content: allowPerformance
        ? `CONVERSA - PUBLICO:\n${userMessage}\n\nResponda somente no envelope JSON estruturado pedido. Se nao quiser evento, use "events": []. Se nao quiser iniciar jogo autonomo, use "game": null. O campo "text" deve reagir a fala recebida. Conversar, fazer piada, comentar, perguntar follow-up genuino, abandonar assunto ou ficar alguns turnos sem tarefa sao respostas validas. So crie acao, regra, alvo, escolha, evento ou jogo quando o material realmente pedir. Nao termine como validacao administrativa seca.\n\nREGRA DE CAMADA PUBLICA: nunca escreva no campo "text" nomes de comandos, campos ou mecanismos internos como JSON, envelope, events, game, gameMove, suitcase, suitcase.action, ask_question, guess ou campo estruturado. Se precisar registrar uma pergunta/palpite/jogada, faca isso somente no objeto estruturado apropriado, fora do texto publico.`
        : `CONVERSA - PUBLICO:\n${userMessage}`
    });
  }

  const startedAt = Date.now();
  const request = {
    model: resolveOpenAIModel(state.model, process.env.OPENAI_MODEL),
    input,
    max_output_tokens: 600,
    reasoning: {
      effort: "minimal"
    }
  };

  if (allowWebSearch) {
    request.tools = [webSearchTool()];
    request.tool_choice = "auto";
  }

  let response;
  try {
    response = await getClient().responses.create(request);
  } catch (error) {
    if (!allowWebSearch || !isWebSearchToolError(error)) {
      throw error;
    }

    console.error("OPENAI WEB SEARCH DISABLED FOR RETRY", {
      message: error.message,
      code: error.code,
      param: error.param
    });

    const retryRequest = { ...request };
    delete retryRequest.tools;
    delete retryRequest.tool_choice;
    response = await getClient().responses.create(retryRequest);
  }
  const elapsedMs = Date.now() - startedAt;

  if (process.env.NODE_ENV === "development") {
    console.log("[CAIXA PRETA]");
    console.log(`response ms: ${elapsedMs}`);
    console.log("[CAIXA PRETA]");
    console.log(`web search used: ${responseUsedWebSearch(response)}`);
  }

  let turn = allowPerformance
    ? parseTurnEnvelope(response.output_text || "")
    : { text: cleanModelText(response.output_text || ""), events: [], salience: [], activity: null, game: null };

  if (allowPerformance) {
    turn = enforceGuessWhoTurn(turn, state.suitcase);
  }

  if (!turn.text && !turn.events.length) {
    console.error("OPENAI EMPTY RESPONSE", {
      id: response.id,
      status: response.status,
      incompleteDetails: response.incomplete_details,
      usage: response.usage,
      output: response.output
    });
    throw new Error("OpenAI retornou uma resposta vazia.");
  }

  return turn;
}

export async function generateCaixaPretaReply(options) {
  const turn = await generateCaixaPretaTurn({ ...options, allowPerformance: false });
  return turn.text;
}

function parseAlternatives(text = "") {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.alternatives)) {
      return parsed.alternatives.map((item) => `${item}`.trim()).filter(Boolean).slice(0, 3);
    }
  } catch {
    // Fall through to plain text parsing.
  }

  return text
    .split(/\n+(?=(?:ALTERNATIVA\s*)?\d+[\).:-]\s*)/i)
    .map((item) => item.replace(/^(?:ALTERNATIVA\s*)?\d+[\).:-]\s*/i, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function generateTrainingAlternatives({
  mode = "host",
  memories = [],
  conversation = [],
  userMessage = "",
  modelResponse = "",
  notes = "",
  rating = "almost"
} = {}) {
  const knowledge = getKnowledgeContext();
  const trainingContext = buildTrainingContextBlock({
    mode,
    memories,
    conversation,
    userMessage,
    tags: ["training", rating]
  });
  const systemPrompt = caixaPretaSystemPrompt({
    knowledge,
    variables: {
      currentMode: mode
    }
  });

  const response = await getClient().responses.create({
    model: resolveOpenAIModel(process.env.OPENAI_MODEL),
    input: [
      {
        role: "system",
        content: systemPrompt
      },
      ...(trainingContext
        ? [{
          role: "user",
          content: trainingContext
        }]
        : []),
      {
        role: "user",
        content: `
MODO TREINO.
Gere 3 alternativas para calibracao da personalidade.
Nao explique.
Nao use Markdown.
Responda apenas JSON valido no formato:
{"alternatives":["...","...","..."]}

CONTEXTO RECENTE:
${conversation.map((message) => `${message.role === "assistant" ? "CAIXA" : "PUBLICO"}: ${message.content}`).join("\n")}

MEMORIAS DISPONIVEIS:
${memories.map((memory) => `- ${memory.content || memory}`).join("\n") || "nenhuma"}

MENSAGEM DO PUBLICO:
${userMessage}

RESPOSTA ORIGINAL:
${modelResponse}

AVALIACAO:
${rating}

NOTAS:
${notes || "nenhuma"}
`.trim()
      }
    ],
    max_output_tokens: 700,
    reasoning: {
      effort: "minimal"
    }
  });

  return parseAlternatives(response.output_text || "");
}
