import { showState } from "../showState.js";
import { readCatalog } from "../tarot/catalog.js";
import { postDemoContext, validatePostDemoTurn } from "./context.js";
import { generatePostDemoTurn } from "../openai.js";
import { POST_DEMO_CARD_LIMIT } from "./settings.js";

export async function runPostDemoTurn() {
  const controller = showState.postDemo;
  const job = controller?.begin();
  if (!job) return;
  try {
    const state = showState.privateSnapshot();
    const catalog = await readCatalog();
    if (new Set(catalog.filter(card => card.imageUrl).map(card => card.id)).size < POST_DEMO_CARD_LIMIT) throw new Error("POST_DEMO_DECK_INCOMPLETE");
    const context = await postDemoContext(state, catalog);
    job.controller.signal.throwIfAborted();
    const result = await generatePostDemoTurn({ state, context, signal: job.controller.signal });
    controller.finish(job, validatePostDemoTurn(result, context));
  } catch (error) {
    controller.fail(job, error?.code === "EXTERNAL_REQUEST_TIMEOUT" ? "A próxima carta demorou. Retome para tentar novamente." : "Não foi possível criar a próxima carta. Retome para tentar novamente.");
  }
}
