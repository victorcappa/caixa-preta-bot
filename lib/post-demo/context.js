import { retrieveShowMemory, showMemoryArchive } from "../showMemory.js";
import { redactAudienceNames, hasAudienceName } from "./privacy.js";

export async function postDemoContext(state, cards) {
  const archive = await showMemoryArchive();
  const events = [];
  const previous = state.postDemo.rounds.filter(round => !hasAudienceName(round.content, round.usedNames)).slice(-8).map(({ card, content }) => ({ card: card.name, content }));
  const query = "Futuro da peça e possibilidades cênicas ainda não realizadas: ilha de Morel, cenas 7 a 15, duplos, corpo em pixel, técnica, máquinas, limites da representação, memória e existência.";
  // No session records, names, participant observations or old audience-derived training examples.
  const memory = await retrieveShowMemory({ state: { postDemo: { rounds: previous.map(round => ({ card: { name: round.card }, content: round.content })) }, memories: [], conversation: [] }, query });
  const known = cards.filter(card => card.imageUrl);
  const unused = known.filter(card => !state.postDemo.usedCardIds.includes(card.id));
  const eligible = unused;
  if (!eligible.length) throw new Error("As cartas disponíveis já foram apresentadas.");
  return { sources: memory.sources, knowledge: redactAudienceNames(memory.knowledge), repertoire: redactAudienceNames(memory.repertoire), events, previous, eligible,
    continuation: redactAudienceNames(archive.continuation.pages.map(page => `[Continuação atual, página ${page.number}]\n${page.text}`).join("\n\n")),
    pageCount: archive.continuation.pageCount,
  };
}

export function validatePostDemoTurn(result, context) {
  const card = context.eligible.find(card => card.id === result.cardId);
  const text = typeof result.text === "string" ? result.text.trim() : "";
  const question = typeof result.question === "string" ? result.question.trim() : "";
  const pages = result.sourcePages;
  const memoryIds = result.memoryIds || [];
  if (!card || !text || !question || !question.endsWith("?") || `${text} ${question}`.split(/\s+/).length > 220 || text.length > 5000 ||
      !Array.isArray(pages) || !pages.length || pages.some(page => !Number.isInteger(page) || page < 1 || page > context.pageCount) ||
      !Array.isArray(memoryIds) || memoryIds.some(id => !context.events.some(event => event.id === id)) ||
      hasAudienceName(`${text}\n${question}`) || (result.audienceNames?.length || 0) > 0) throw new Error("A resposta do pós-demo não corresponde às fontes e cartas disponíveis.");
  return { card: { id: card.id, number: card.number, name: card.name, imageUrl: card.imageUrl }, content: `${text}\n\n${question}`,
    trace: { sourcePages: pages, memoryIds, sources: context.sources } };
}
