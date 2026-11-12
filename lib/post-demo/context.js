import { getRegisteredAudienceNames } from "../participants.js";
import { retrieveShowMemory, showMemoryArchive } from "../showMemory.js";
import { buildTrainingContextBlock } from "../training.js";

export function postDemoEvents(state) {
  return [
    ...(state.memories || []).filter(memory => !memory.expiresAt || Date.parse(memory.expiresAt) > Date.now())
      .slice(-80).map((memory, index) => ({ id: `observation-${memory.id || index}`, kind: "registro do operador", text: memory.content })),
    ...[...(state.conversation || []), ...(state.operatorPublic?.messages || []), ...(state.liveTraining?.messages || [])]
      .filter(message => message.content && (!message.status || message.status === "complete")).slice(-60)
      .map((message, index) => ({ id: `conversation-${message.id || index}`, kind: message.role === "user" ? "fala registrada" : "fala anterior do bot, não comprova ação cumprida", text: message.content }))
  ].filter(event => event.text).map(event => ({ ...event, text: event.text.slice(0, 1800) }));
}

export async function postDemoContext(state, cards) {
  const archive = await showMemoryArchive();
  const events = postDemoEvents(state);
  const audience = getRegisteredAudienceNames();
  const previous = state.postDemo.rounds.slice(-8).map(({ card, content, usedNames }) => ({ card: card.name, content, usedNames }));
  const query = `Continuação futura da peça, ilha de Morel, cenas 7 a 15, memórias, aprendizado, corpo em pixel, espelhos, máquinas, técnica e plateia.\n${events.slice(-6).map(event => event.text).join("\n")}`;
  const memory = await retrieveShowMemory({ state, query });
  const known = cards.filter(card => card.imageUrl);
  const unused = known.filter(card => !state.postDemo.usedCardIds.includes(card.id));
  const eligible = unused;
  if (!eligible.length) throw new Error("As cartas disponíveis já foram apresentadas.");
  const usedNames = previous.flatMap(round => round.usedNames || []);
  return { ...memory, events, audience, previous, eligible,
    suggestedNames: [...audience].sort((a, b) => usedNames.filter(name => name === a).length - usedNames.filter(name => name === b).length).slice(0, 4),
    continuation: archive.continuation.pages.map(page => `[Continuação atual, página ${page.number}]\n${page.text}`).join("\n\n"),
    pageCount: archive.continuation.pageCount,
    training: buildTrainingContextBlock({ mode: "post-demo", userMessage: query, conversation: (state.conversation || []).slice(-10), memories: state.memories || [] }) };
}

export function validatePostDemoTurn(result, context) {
  const card = context.eligible.find(card => card.id === result.cardId);
  const text = typeof result.text === "string" ? result.text.trim() : "";
  const question = typeof result.question === "string" ? result.question.trim() : "";
  const pages = result.sourcePages;
  const memoryIds = result.memoryIds;
  const usedNames = result.audienceNames;
  if (!card || !text || !question || !question.endsWith("?") || `${text} ${question}`.split(/\s+/).length > 220 || text.length > 5000 ||
      !Array.isArray(pages) || !pages.length || pages.some(page => !Number.isInteger(page) || page < 1 || page > context.pageCount) ||
      !Array.isArray(memoryIds) || memoryIds.some(id => !context.events.some(event => event.id === id)) ||
      !Array.isArray(usedNames) || usedNames.some(name => !context.audience.includes(name))) throw new Error("A resposta do pós-demo não corresponde às fontes e cartas disponíveis.");
  return { card: { id: card.id, number: card.number, name: card.name, imageUrl: card.imageUrl }, content: `${text}\n\n${question}`,
    usedNames, roster: context.audience,
    trace: { sourcePages: pages, memoryIds, sources: context.sources } };
}
