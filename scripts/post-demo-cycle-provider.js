// Isolated test transport: select only among the cards actually supplied to the provider.
import fs from "node:fs/promises";
const fixture = process.env.CAIXA_PRETA_POST_DEMO_CYCLE_FIXTURE;
if (fixture) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    if (!String(input?.url || input).startsWith("https://api.openai.com/")) return original(input, options);
    const request = JSON.parse(options.body), source = JSON.parse(request.input.at(-1).content);
    const config = JSON.parse(await fs.readFile(fixture, "utf8"));
    await fs.appendFile(fixture + ".requests.jsonl", JSON.stringify({ eligible: source.eligibleCards.map(card => card.id), previous: source.previousHypotheses.length }) + "\n");
    if (config.fail) return Response.json({ error: { message: "Simulated unavailable" } }, { status: 503 });
    const card = source.eligibleCards[0];
    const result = { cardId: card.id, text: `Eu guardaria a margem ${card.id} desta ilha.`, question: "Quem habitaria essa margem?",
      sourcePages: [12], memoryIds: [], audienceNames: [] };
    return Response.json({ id: "cycle-test", object: "response", status: "completed", output: [
      { type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(result), annotations: [] }] }
    ] });
  };
}
