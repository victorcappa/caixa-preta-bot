import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(pathToFileURL(path.resolve(root, `${specifier.slice(2)}.js`)).href, context);
  try { return nextResolve(specifier, context); } catch (error) {
    if (specifier.startsWith(".") && !path.extname(specifier)) return nextResolve(`${specifier}.js`, context);
    throw error;
  }
} });
const { getCollectiveResearch, getCollectiveInfluenceContext, COLLECTIVE_RESEARCH_FILES } = await import("../lib/collectiveMemory.js");
const { buildSystemPrompt } = await import("../prompts/buildSystemPrompt.js");
const { people, sources } = getCollectiveResearch();
assert.equal(people.length, 35, "A ficha da criação, elenco/equipe e rede de pesquisa cobre 35 pessoas únicas");
assert.equal(new Set(people.map(person => person.id)).size, people.length);
assert(sources.every(source => /^[a-f\d]{64}$/.test(source.sha256)));
for (const person of people) {
  assert(person.verifiedIdentity === true || person.limitations?.length, `${person.name}: incerteza de identidade deve ser explícita`);
  assert(person.sources.some(source => /^https?:\/\//.test(source.url)), `${person.name}: procedência pública`);
  if (person.verifiedIdentity) assert(person.motifs.length > 0, `${person.name}: influência editorial explícita`);
  else assert.equal(person.motifs.length, 0, `${person.name}: identidade incerta não gera influência atribuída`);
  for (const work of [...(person.academicWorks || []), ...(person.artisticWorks || []), ...(person.researchWorks || [])]) {
    assert(work.title && work.summary && /^https?:\/\//.test(work.url), `${person.name}: obra sem evidência`);
  }
}
const influence = getCollectiveInfluenceContext();
for (const person of people.filter(person => person.verifiedIdentity)) {
  assert(influence.includes(person.motifs[0].slice(0, 240)), `${person.name}: matriz disponível mesmo sem consulta pelo nome`);
  assert(!influence.includes(person.name), `${person.name}: biografia não deve entrar na camada silenciosa`);
}
assert(!/https?:\/\/|sourcePath|identityEvidence/.test(influence));
assert.match(influence, /Não recite currículos/);
assert.match(influence, /Somente diante de pedido explícito/);
for (const currentMode of ["host", "chat", "tarot", "live-training"]) {
  const system = buildSystemPrompt({ knowledge: "DADO-CANÔNICO", variables: { currentMode } });
  assert(system.includes(influence), `${currentMode}: mesma influência compartilhada`);
  assert(system.includes("DADO-CANÔNICO"));
}

// A disposable fixture proves edits invalidate the cache and private files are
// outside the explicit research allowlist. Never alter the active presentation.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "caixa-collective-audit-"));
for (const file of COLLECTIVE_RESEARCH_FILES) { const target = path.join(fixture, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, file), target); }
fs.mkdirSync(path.join(fixture, "data"));
fs.writeFileSync(path.join(fixture, "data", "publico.json"), "PRIVATE_AUDIENCE_SENTINEL");
fs.writeFileSync(path.join(fixture, "data", "training-examples.json"), "PRIVATE_TRAINING_SENTINEL");
const prior = process.cwd();
try {
  process.chdir(fixture);
  const document = JSON.parse(fs.readFileSync(COLLECTIVE_RESEARCH_FILES[0], "utf8"));
  document.people[0].motifs[0] = "CACHE_UPDATED_SILENT_MOTIF";
  fs.writeFileSync(COLLECTIVE_RESEARCH_FILES[0], JSON.stringify(document));
  assert(getCollectiveInfluenceContext().includes("CACHE_UPDATED_SILENT_MOTIF"));
  assert(!JSON.stringify(getCollectiveResearch()).includes("PRIVATE_AUDIENCE_SENTINEL"));
  assert(!getCollectiveInfluenceContext().includes("PRIVATE_TRAINING_SENTINEL"));
} finally { process.chdir(prior); fs.rmSync(fixture, { recursive: true, force: true }); }
console.log(JSON.stringify({ ok: true, people: people.length, sources: sources.length, influenceCharacters: influence.length, providerCalled: false }, null, 2));
