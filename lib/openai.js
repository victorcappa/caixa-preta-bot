import OpenAI from "openai";
import { activityContextBlock } from "@/lib/activities";
import { caixaPretaSystemPrompt } from "@/prompts/caixaPreta";
import { inferCountdownDurationFromText } from "@/lib/countdownText";
import { buildInteractionHistoryBlock } from "@/lib/interactionHistory";
import { getKnowledgeContext } from "@/lib/knowledge";
import {
  normalizePerformanceEvents,
  performanceCapabilitiesBlock
} from "@/lib/performanceEvents";
import { resolveOpenAIModel } from "@/lib/openaiModels";
import { buildTrainingContextBlock } from "@/lib/training";
import { getModeRuntimeConfig } from "@/prompts/modes";

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

function cleanModelText(text) {
  return text
    .replace(/^(CAIXA PRETA|RESPOSTA)\s*:\s*/i, "")
    .trim();
}

function parseTurnEnvelope(rawText = "") {
  const text = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!text.startsWith("{")) {
    return {
      text: cleanModelText(text),
      events: [],
      salience: [],
      activity: null
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

    return {
      text: publicText,
      events: normalizePerformanceEvents(events, "agent"),
      salience: Array.isArray(parsed.salience)
        ? parsed.salience.slice(0, 6).map((item) => ({
          text: `${item.text || item || ""}`.slice(0, 120),
          type: item.type || "word",
          intensity: item.intensity || 3,
          origin: "agent"
        })).filter((item) => item.text)
        : [],
      activity: parsed.activity || null
    };
  } catch {
    return {
      text: cleanModelText(text),
      events: [],
      salience: [],
      activity: null
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
    ...(interactionHistoryContext
      ? [{
        role: "user",
        content: interactionHistoryContext
      }]
      : []),
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
        ? `CONVERSA - PUBLICO:\n${userMessage}\n\nResponda somente no envelope JSON estruturado pedido. Se nao quiser evento, use "events": []. O campo "text" deve reagir a fala recebida e, salvo encerramento real do operador, deixar continuidade concreta: nova acao, regra, alvo, escolha, pausa temporal ou consequencia. Nao termine como validacao administrativa seca.`
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

  const turn = allowPerformance
    ? parseTurnEnvelope(response.output_text || "")
    : { text: cleanModelText(response.output_text || ""), events: [], salience: [], activity: null };

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
