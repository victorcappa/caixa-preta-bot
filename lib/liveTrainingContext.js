import { retrieveShowMemory } from "./showMemory.js";
import { buildTrainingContextBlock } from "./training.js";

export async function liveTrainingContext(state, parentId = null) {
  const channel = state.liveTraining;
  const parentIndex = parentId ? channel.messages.findIndex(message => message.id === parentId) : -1;
  const parent = channel.messages[parentIndex];
  const promptIndex = parent?.promptId ? channel.messages.findIndex(message => message.id === parent.promptId) : -1;
  const history = (parentIndex >= 0 ? [...channel.messages.slice(0, promptIndex >= 0 ? promptIndex + 1 : parentIndex), parent] : channel.messages)
    .filter(message => message.content && message.status === "complete");
  const latestInput = [...history].reverse().find(message => message.role === "user")?.content || "";
  const observations = (state.memories || []).filter(memory => !memory.expiresAt || Date.parse(memory.expiresAt) > Date.now());
  const query = `${latestInput}\n${history.slice(-4).map(message => message.content).join("\n")}`;
  const context = await retrieveShowMemory({ query, state });
  const feedback = channel.messages.filter(message => message.rating).slice(-12).map(message =>
    `${message.rating.toUpperCase()}: ${message.content}`).join("\n");
  return { knowledge: context.knowledge, repertoire: context.repertoire,
    history, latestInput, feedback,
    training: buildTrainingContextBlock({ mode: "live-training", userMessage: latestInput, conversation: history.slice(-12), memories: observations }),
    sources: context.sources };
}
