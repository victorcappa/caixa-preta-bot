import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(pathToFileURL(path.resolve(repository, `${specifier.slice(2)}.js`)).href, context);
  return nextResolve(specifier, context);
} });
const { showMemoryArchive, retrieveShowMemory, boundedMemoryDocuments, getShowKnowledgeContext } = await import("../lib/showMemory.js");
const archive = await showMemoryArchive();
const transcript = JSON.parse(fs.readFileSync("knowledge/sources/texto-caixa-preta.json", "utf8"));
assert.equal(archive.coverage.pages, 34);
assert.deepEqual(archive.coverage.scenes, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.deepEqual(archive.coverage.referenceSections.map(section => section.id), Array.from({ length: 59 }, (_, i) => `CP-${String(i + 1).padStart(2, "0")}`));
assert.equal(archive.coverage.bibliography.length, 63);
const normalized = value => value.replace(/\s+/g, "");
for (const page of transcript.pages) {
  const indexed = archive.index.chunks.filter(chunk => chunk.origin === transcript.source && chunk.page === page.number).map(chunk => chunk.text).join("");
  assert.equal(normalized(indexed), normalized(page.text), `texto completo da página ${page.number} deve estar indexado, inclusive anotações`);
}
const longText = "linha extensa ".repeat(5000);
const bounded = boundedMemoryDocuments([{ id: "long", text: longText }]);
assert.equal(bounded.map(part => part.text).join(""), longText);
assert(bounded.every(part => part.text.length <= 1501));

const checks = [];
for (let scene = 0; scene <= 9; scene++) {
  const context = await retrieveShowMemory({ query: `O que acontece na cena ${scene}?` });
  assert(context.selected.some(chunk => chunk.origin === transcript.source && chunk.scene === scene), `Cena ${scene}: recuperar fonte integral, não somente resumo`);
  assert(context.selected[0].scene === scene);
  assert(context.repertoire.length <= 24000);
  checks.push(`Cena ${scene}: fonte e página recuperadas`);
}
const multipleScenes = await retrieveShowMemory({ query: "O que se propõe nas cenas 8 e 9?" });
assert(multipleScenes.selected.some(chunk => chunk.scene === 8) && multipleScenes.selected.some(chunk => chunk.scene === 9));
const sceneList = await retrieveShowMemory({ query: "Dê uma frase concreta para cada cena: 1 aeroporto; 2 queda e corpo; 4 piloto e observadora; 5 mão; 7 caixas pretas e ensaio. Quero reconhecer a matéria específica de cada uma." });
for (const scene of [1, 2, 4, 5, 7]) assert(sceneList.selected.some(chunk => chunk.scene === scene), `lista comentada deve recuperar Cena ${scene}`);
assert(sceneList.selected.some(chunk => chunk.scene === 5 && /borracha/i.test(chunk.text)), "Cena 5 deve trazer o dispositivo de Elisa, sem se limitar à mão do piloto");
for (const section of archive.coverage.referenceSections) {
  const context = await retrieveShowMemory({ query: `Desenvolva ${section.id}` });
  assert(context.selected.some(chunk => chunk.sectionId === section.id), `${section.id} deve ser acessível por ID`);
  assert(context.knowledge.includes(section.title));
}
for (const [query, expected] of [
  ["Morel ilha reprodução", /Morel/i], ["fonógrafo Edison futuro", /fon[oó]grafo|Edison/i],
  ["Jonathan acromatopsia pintor", /Jonathan|acromatopsia/i], ["mão borracha pertencimento", /borracha/i],
  ["milagre bicicleta asa", /bicicleta|milagre/i], ["ensaio rehearsal aeroporto", /rehearsal|ensaio/i],
  ["Mẽbêngôkre Kayapó Amazônia", /Kayap[oó]|Amaz[oô]nia|Mẽbêngôkre/i],
  ["algoritmos bets tecnocracia", /algoritm|bets|tecnocracia/i]
]) {
  const context = await retrieveShowMemory({ query });
  assert.match(context.repertoire, expected, query);
  checks.push(`Tema: ${query}`);
}
const current = await getShowKnowledgeContext({ query: "Qual a ordem atual das malas?" });
assert(current.includes("Mala 2 → Mala 1 → Mala 3"));
assert(current.includes("versões antigas"));
assert(archive.documents.some(document => document.id === "malas-ordem-atual" && document.text.includes("2 → 1 → 3")));
const privateSentinel = "PRIVATE_SENTINEL_IN_SCENE_NOTES";
const dynamic = await retrieveShowMemory({ query: "obsidiana carambola nebulosa", state: {
  sceneZero: { notes: privateSentinel }, notes: privateSentinel,
  memories: [{ content: "obsidiana observação viva" }, { content: "obsidiana EXPIRED_SENTINEL", expiresAt: "2020-01-01" }],
  conversation: [{ role: "user", content: "carambola conversa verdadeira" }],
  tarot: { hallucination: { memories: [{ id: "active", title: "Processo", text: "nebulosa memória de processo" }, { id: "disabled", text: "nebulosa DISABLED_SENTINEL", enabled: false }] } }
} });
assert(dynamic.repertoire.includes("observação viva") && dynamic.repertoire.includes("conversa verdadeira") && dynamic.repertoire.includes("memória de processo"));
assert(!JSON.stringify(dynamic).includes(privateSentinel));
assert(!dynamic.repertoire.includes("EXPIRED_SENTINEL") && !dynamic.repertoire.includes("DISABLED_SENTINEL"));
const filtered = await retrieveShowMemory({ query: "CP-50 Banco Master", includeReferences: false });
assert(!filtered.selected.some(chunk => chunk.origin.startsWith("assets/tarot/")), "Tarô mantém seu próprio filtro de referências");

// Exercise invalidation and fail-closed behavior in a disposable copy, never the active show.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "caixa-memory-audit-"));
for (const item of ["knowledge", "data", "Texto caixa preta.pdf", "assets/tarot/CAIXA_PRETA_REFERENCIAS_TARO.md", "assets/sampler-forca-g/manifest.json"]) {
  fs.mkdirSync(path.dirname(path.join(fixture, item)), { recursive: true });
  fs.cpSync(path.join(repository, item), path.join(fixture, item), { recursive: true });
}
try {
  process.chdir(fixture);
  await showMemoryArchive();
  fs.appendFileSync("knowledge/show-map.md", "\nCANONICAL_UPDATE_SENTINEL\n");
  assert((await showMemoryArchive()).knowledge.includes("CANONICAL_UPDATE_SENTINEL"), "editar a base invalida cache sem reiniciar");
  fs.appendFileSync("data/controller-cues.json", "\n");
  assert((await showMemoryArchive()).coverage.sources.find(source => source.path === "data/controller-cues.json").sha256 !== archive.coverage.sources.find(source => source.path === "data/controller-cues.json").sha256);
  const damaged = structuredClone(transcript); damaged.pages[0].text = "perda acidental de texto";
  fs.writeFileSync("knowledge/sources/texto-caixa-preta.json", JSON.stringify(damaged));
  await assert.rejects(showMemoryArchive(), /desatualizado\/incompleto/);
  fs.writeFileSync("knowledge/sources/texto-caixa-preta.json", JSON.stringify(transcript));
  fs.appendFileSync("Texto caixa preta.pdf", "\nchanged-source\n");
  await assert.rejects(showMemoryArchive(), /desatualizado\/incompleto/);
  fs.unlinkSync("Texto caixa preta.pdf");
  await assert.rejects(showMemoryArchive(), /ENOENT/);
} finally { process.chdir(repository); }
const output = path.join(fixture, "coverage.json");
fs.writeFileSync(output, JSON.stringify({ ...archive.coverage, retrievalChecks: checks, referencesTested: 59, validation: "local retrieval; no model calls" }, null, 2));
console.log(`SHOW MEMORY PASS: 34 páginas integrais, 10 cenas, 59 seções, 63 fontes, ${archive.coverage.chunks} trechos; temas, processo, privacidade e cache/hash.\nRelatório: ${output}`);
