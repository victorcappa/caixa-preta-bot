// Test-only transport preload, never imported by the application.
import fs from "node:fs/promises";
import { InstagramController } from "../lib/instagram/InstagramController.js";
const fixture = process.env.CAIXA_PRETA_OPERATOR_MOCK;
if (fixture) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    if (!String(input?.url || input).startsWith("https://api.openai.com/")) return originalFetch(input, options);
    const config = JSON.parse(await fs.readFile(fixture, "utf8"));
    if (config.activity === "instagram" && !globalThis.__operatorTestInstagram) {
      const store = globalThis.__caixaPretaShowState;
      const instagram = new InstagramController({ reporter: (value) => store.updateInstagram(value) });
      instagram.status = "NAVIGATING";
      instagram.page = { url: () => "https://www.instagram.com/test-fixture/", viewportSize: () => ({ width: 430, height: 760 }) };
      instagram.context = { close: async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        // Deliberately hostile late callbacks after the private return command.
        instagram.updateStatus("NAVIGATING", "late reporter");
        store.updateInstagram({ ...instagram.getStatus(), status: "NAVIGATING", embeddedPanelVisible: true });
        store.controlSceneZero("instagram-session-error", { error: "late session error" }, { source: "system" });
      } };
      globalThis.__operatorTestInstagram = instagram;
      globalThis.__caixaPretaInstagramController = instagram;
      store.updateInstagram({ ...instagram.getStatus(), embedded: true, embeddedPanelVisible: true });
      store.controlSceneZero("instagram-start");
    }
    const request = JSON.parse(options.body);
    await fs.writeFile(`${fixture}.request.json`, JSON.stringify(request));
    if (config.mode === "failure") return new Response(JSON.stringify({ error: { message: "Simulated unavailable" } }), { status: 503 });
    if (!request.stream) return Response.json({ id: "mock", object: "response", status: "completed", output: [
      { type: "message", role: "assistant", content: [{ type: "output_text", text: config.principalText || "CENA PRINCIPAL CONTINUA", annotations: [] }] }
    ] });
    const encoder = new TextEncoder();
    const signal = options.signal || input?.signal;
    return new Response(new ReadableStream({
      async start(controller) {
        const event = (value) => controller.enqueue(encoder.encode(`event: ${value.type}\ndata: ${JSON.stringify(value)}\n\n`));
        try {
          for (const delta of config.chunks || ["ESTOU ", "AQUI ", "ENQUANTO ", "A CENA CONTINUA."]) {
            await new Promise((resolve) => setTimeout(resolve, config.delay || 200));
            signal?.throwIfAborted();
            event({ type: "response.output_text.delta", delta });
          }
          event(config.mode === "partial-failure" ? { type: "response.failed" } : { type: "response.completed", response: { status: "completed" } });
          controller.close();
        } catch (error) { controller.error(error); }
      }
    }), { headers: { "content-type": "text/event-stream" } });
  };
}
