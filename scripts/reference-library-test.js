import assert from "node:assert/strict";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(pathToFileURL(path.resolve(repository, `${specifier.slice(2)}.js`)).href, context);
  return nextResolve(specifier, context);
} });
const { getReferenceLibrary, getReferenceById } = await import("../lib/referenceLibrary.js");
const { showMemoryArchive } = await import("../lib/showMemory.js");
const { getCollectiveResearch } = await import("../lib/collectiveMemory.js");
const library = await getReferenceLibrary();
const archive = await showMemoryArchive();
const collective = getCollectiveResearch();
assert.equal(new Set(library.items.map(item => item.id)).size, library.items.length, "IDs devem ser únicos");
assert.equal(library.stats.permanentMaps, 7);
assert.equal(library.stats.sections, archive.coverage.referenceSections.length);
assert.equal(library.stats.citations, archive.coverage.bibliography.length);
assert.equal(library.stats.chunks, archive.index.chunks.length);
assert.equal(library.stats.people, collective.people.length);
assert.equal(library.groups.reduce((sum, group) => sum + group.count, 0), library.items.length);
for (const item of library.items) {
  assert(item.title && item.description && item.evidence && item.sourcePath && item.statusLabel, item.id);
  assert(item.excerpt.length <= 500, `${item.id}: trecho deve ser curto`);
  assert(!item.sourceUrl || /^https?:\/\//.test(item.sourceUrl), `${item.id}: URL deve ser externa e explícita`);
  assert(!/^\//.test(item.sourcePath) && !/\.runtime|\.env|config\/|training-examples|scene-notes/.test(item.sourcePath), "procedência não deve revelar caminhos ou dados privados");
  for (const related of item.relatedIds) assert(library.items.some(candidate => candidate.id === related), `${item.id}: relação ausente ${related}`);
  if (item.status === "indexed") {
    const chunks = archive.index.chunks.filter(chunk => chunk.origin === item.sourcePath);
    assert.equal(item.chunkCount, chunks.length);
    assert(item.pageCount > 0 && /^[a-f0-9]{64}$/.test(item.sha256));
  }
  if (item.status === "cited") {
    assert.equal(item.chunkCount, 0, "bibliografia não deve ser apresentada como integral ingerida");
    assert.equal(item.pageCount, null);
    assert.match(item.description, /texto integral.*não está incorporado/);
  }
  if (item.group === "pessoas") {
    assert(item.biography?.length > 180 && item.biography?.length < 700, "cada pessoa precisa de uma biografia breve e autoral");
    assert(item.thing?.type && item.thing?.basis.includes("não um pertence real"), "objeto pessoal é associação curatorial");
    assert.equal(item.chunkCount, 0, "pesquisa de motivos não deve alegar indexação integral da obra");
    assert.equal(item.pageCount, null);
    assert(item.works.every(work => work.readStatus), "cada obra precisa declarar o alcance da consulta");
  }
}
for (const source of new Set(archive.documents.filter(document => document.kind === "current").map(document => document.origin))) {
  assert(library.items.some(item => item.sourcePath === source && item.status === "authored"), `fonte autoral ausente ${source}`);
}
assert.equal((await getReferenceById("E07")).status, "cited", "a obra Morel não deve aparecer como texto integral");
assert.equal((await getReferenceById("CP-05")).status, "dossier");
assert.equal((await getReferenceById("dramaturgia-texto")).pageCount, archive.coverage.pages);
for (const person of collective.people) {
  const item = library.items.find(item => item.id === `pessoa-${person.id}`);
  assert(item, `${person.name}: pessoa pesquisada deve constar no catálogo`);
  if (person.verifiedIdentity !== true) assert.notEqual(item.status, "influence", "identidade parcial não pode ser apresentada como influência incorporada");
}
assert.equal(await getReferenceById("../../.env.local"), null);
assert(!JSON.stringify(library).includes("PRIVATE_SENTINEL"));
console.log(JSON.stringify({ ok: true, ...library.stats, groups: library.groups.map(({ id, count }) => ({ id, count })) }, null, 2));
