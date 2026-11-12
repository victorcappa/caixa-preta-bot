import fs from "node:fs/promises";
import path from "node:path";
import { knowledgeFiles } from "./knowledge.js";
import { buildLocalIndex, rankLocalIndex } from "./knowledge-retrieval.js";
import { buildTrainingContextBlock } from "./training.js";
import { AUDIENCE_WARMUP_PROMPTS } from "../data/audience-warmup-prompts.js";
import { PLAY_UNLOCK_CONFIG } from "../data/scene-zero-unlock.js";
import * as suitcase from "./scene-zero/suitcaseGame.js";

let cache;
const files = [...knowledgeFiles.map(file => `knowledge/${file}`), "assets/tarot/CAIXA_PRETA_REFERENCIAS_TARO.md", "data/controller-cues.json"];

function cueTexts(value) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => key === "text" && typeof item === "string" ? [item]
    : item && typeof item === "object" ? cueTexts(item) : []);
}

async function corpus() {
  const stats = await Promise.all(files.map(file => fs.stat(path.join(process.cwd(), file))));
  const fingerprint = `${process.cwd()}:${stats.map(stat => `${stat.size}:${stat.mtimeMs}`).join(",")}`;
  if (cache?.fingerprint === fingerprint) return cache;
  const documents = await Promise.all(files.map(async file => {
    const raw = await fs.readFile(path.join(process.cwd(), file), "utf8");
    return { id: file, origin: file, text: file.endsWith(".json") ? cueTexts(JSON.parse(raw)).join("\n\n") : raw };
  }));
  documents.push({ id: "repertorio-cenico", origin: "Textos autorais das cenas e aquecimento", text: [
    ...AUDIENCE_WARMUP_PROMPTS.map(prompt => `${prompt.category}: ${prompt.text}\n${(prompt.steps || []).map(step => step.text).join("\n")}`),
    ...PLAY_UNLOCK_CONFIG.bootSteps.flatMap(step => step.lines),
    ...PLAY_UNLOCK_CONFIG.soundCheck.waitingComments.map(comment => comment.text),
    ...Object.entries(suitcase).filter(([key, value]) => typeof value === "string" && /INSTRUCTION|EXPLANATION/.test(key)).map(([, value]) => value)
  ].join("\n\n") });
  cache = { fingerprint, documents, index: buildLocalIndex(documents),
    canonical: documents.filter(document => document.id.startsWith("knowledge/")).map(document => `# ${document.id}\n${document.text}`).join("\n\n") };
  return cache;
}

export async function liveTrainingContext(state, parentId = null) {
  const archive = await corpus();
  const channel = state.liveTraining;
  const parentIndex = parentId ? channel.messages.findIndex(message => message.id === parentId) : -1;
  const parent = channel.messages[parentIndex];
  const promptIndex = parent?.promptId ? channel.messages.findIndex(message => message.id === parent.promptId) : -1;
  const history = (parentIndex >= 0 ? [...channel.messages.slice(0, promptIndex >= 0 ? promptIndex + 1 : parentIndex), parent] : channel.messages)
    .filter(message => message.content && message.status === "complete");
  const latestInput = [...history].reverse().find(message => message.role === "user")?.content || "";
  const observations = (state.memories || []).filter(memory => !memory.expiresAt || Date.parse(memory.expiresAt) > Date.now());
  const dynamicDocuments = [
    { id: "conversas-da-peca", origin: "Conversas reais desta apresentação", text: [...(state.conversation || []), ...(state.operatorPublic?.messages || []), ...channel.messages].filter(message => message.content && (!message.status || message.status === "complete")).map(message => `${message.role}: ${message.content}`).join("\n\n") },
    { id: "memorias-da-peca", origin: "Observações e processo da apresentação", text: observations.map(memory => memory.content).join("\n\n") },
    ...(state.tarot?.hallucination?.memories || []).filter(memory => memory.enabled !== false).map(memory => ({ id: `processo-${memory.id}`, origin: memory.title || "Memória de processo", text: memory.text || "" }))
  ];
  const query = `${latestInput}\n${history.slice(-4).map(message => message.content).join("\n")}`;
  const ranked = [...rankLocalIndex(archive.index, query), ...rankLocalIndex(buildLocalIndex(dynamicDocuments), query)]
    .sort((a, b) => b.score - a.score).filter(chunk => !chunk.documentId.startsWith("knowledge/"));
  const selected = [];
  let characters = 0;
  for (const chunk of ranked) {
    if (selected.length >= 16) break;
    if (characters + chunk.text.length > 22000) continue;
    selected.push(chunk);
    characters += chunk.text.length;
  }
  const feedback = channel.messages.filter(message => message.rating).slice(-12).map(message =>
    `${message.rating.toUpperCase()}: ${message.content}`).join("\n");
  return { knowledge: archive.canonical,
    repertoire: selected.map(chunk => `[${chunk.origin} / ${chunk.title}]\n${chunk.text}`).join("\n\n"),
    history, latestInput, feedback,
    training: buildTrainingContextBlock({ mode: "live-training", userMessage: latestInput, conversation: history.slice(-12), memories: observations }),
    sources: [...new Set([...knowledgeFiles.map(file => `knowledge/${file}`), ...selected.map(chunk => chunk.documentId)])] };
}
