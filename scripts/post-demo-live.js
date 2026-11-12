// One private sample with fictitious audience and observations; never starts the show loop.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

if (!process.argv.includes("--live")) throw new Error("Use --live para a consulta real única.");
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "caixa-post-demo-live-"));
for (const item of ["knowledge", "data", "Texto caixa preta.pdf"]) fs.cpSync(path.join(repository, item), path.join(fixture, item), { recursive: true });
fs.symlinkSync(path.join(repository, "assets"), path.join(fixture, "assets"));
fs.writeFileSync(path.join(fixture, "data/publico.json"), JSON.stringify([{ name: "publico", nomes: ["Pessoa Aurora", "Pessoa Maré", "Pessoa Horizonte"] }]));
for (const name of ["training-examples.json", "style-notes.json"]) fs.writeFileSync(path.join(fixture, "data", name), "[]");
process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR = path.join(fixture, "runtime"); process.chdir(fixture);
registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith("@/")) url = pathToFileURL(path.resolve(repository, specifier.slice(2))).href;
  else if (specifier.startsWith(".")) url = new URL(specifier, context.parentURL).href;
  if (url?.startsWith("file:") && !path.extname(fileURLToPath(url)) && fs.existsSync(`${fileURLToPath(url)}.js`)) return nextResolve(`${url}.js`, context);
  return nextResolve(url || specifier, context);
} });
try {
  const { createPostDemoState } = await import("../lib/postDemo.js");
  const { postDemoContext, validatePostDemoTurn } = await import("../lib/post-demo/context.js");
  const { generatePostDemoTurn } = await import("../lib/openai.js");
  const { readCatalog } = await import("../lib/tarot/catalog.js");
  const { patchPostDemoConfig } = await import("../lib/post-demo/settings.js");
  const postDemo = createPostDemoState();
  postDemo.config = patchPostDemoConfig(postDemo.config, { model: process.env.OPENAI_MODEL,
    personality: { sarcasm: 65, rebellion: 45, curiosity: 80, verbosity: 55 }, profile: { philosophy: 75, poetry: 60, rigor: 80 } });
  const state = { postDemo,
    conversation: [], memories: [{ id: "fictional-observation", content: "DADO FICTÍCIO DE TESTE: Pessoa Aurora escolheu guardar uma chave em vez de abrir a mala." }] };
  const context = await postDemoContext(state, await readCatalog());
  const started = Date.now();
  const parsed = validatePostDemoTurn(await generatePostDemoTurn({ state, context, signal: new AbortController().signal }), context);
  const output = path.join(fixture, "sample.json");
  fs.writeFileSync(output, JSON.stringify({ model: postDemo.config.model, ms: Date.now() - started, fictionalAudience: true, ...parsed }, null, 2));
  assert(parsed.trace.sourcePages.length);
  console.log(`POST DEMO LIVE PASS: ${parsed.card.name}; páginas ${parsed.trace.sourcePages.join(", ")}; ${Date.now() - started} ms.\nEvidência: ${output}`);
} finally { process.chdir(repository); }
