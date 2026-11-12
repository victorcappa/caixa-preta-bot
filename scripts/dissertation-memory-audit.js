import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(pathToFileURL(path.resolve(repository, `${specifier.slice(2)}.js`)).href, context);
  return nextResolve(specifier, context);
} });
const { showMemoryArchive, retrieveShowMemory, DISSERTATION_PDF, DISSERTATION_TRANSCRIPT } = await import("../lib/showMemory.js");
const sha = value => createHash("sha256").update(value).digest("hex");
const archive = await showMemoryArchive();
const transcript = JSON.parse(fs.readFileSync(DISSERTATION_TRANSCRIPT, "utf8"));
assert.equal(transcript.pageCount, 182);
assert.equal(transcript.sha256, sha(fs.readFileSync(DISSERTATION_PDF)));
assert.equal(transcript.textSha256, sha(transcript.pages.map(page => page.text).join("\f")));
assert.equal(archive.coverage.dissertationPages, transcript.pageCount);
assert.equal(transcript.metadata.author, "Marcus Vinícius de Melo Garcia");
assert.equal(transcript.metadata.year, 2025);
assert.match(transcript.pages[2].text, /desde que citada a fonte/);
const normalized = value => value.replace(/\s+/g, "");
for (const page of transcript.pages) {
  const chunks = archive.index.chunks.filter(chunk => chunk.origin === DISSERTATION_PDF && chunk.page === page.number);
  assert(chunks.length, `página ${page.number} deve estar disponível`);
  assert.equal(normalized(chunks.map(chunk => chunk.text).join("")), normalized(page.text), `conteúdo integral da página ${page.number}`);
  assert(chunks.every(chunk => chunk.kind === "dissertation" && chunk.scene === null));
}
for (const query of [
  "Marcus Vinícius Garcia Labirinto de Labirintos",
  "T.GIRLS objeto que quebra continuidade erros",
  "requisição presença exaustão pessoa técnica",
  "pensamento mágico reticulação hiperespecialização",
  "DEEPER Janaína Leite instalação",
  "Re-member Leandra Espírito Santo Arduíno"
]) {
  const result = await retrieveShowMemory({ query, maxCharacters: 12000, maxChunks: 8 });
  assert(result.selected.some(chunk => chunk.origin === DISSERTATION_PDF), `${query}: recuperar texto da dissertação`);
  assert(result.repertoire.length <= 12000);
  const chunk = result.selected.find(chunk => chunk.origin === DISSERTATION_PDF);
  assert.match(chunk.excerpt, /Marcus Vinícius de Melo Garcia \(2025\), página PDF \d+/);
}
const filtered = await retrieveShowMemory({ query: "Marcus Garcia Labirinto T.GIRLS", includeReferences: false });
assert(!filtered.selected.some(chunk => chunk.origin === DISSERTATION_PDF));

// Copy only source allowlists to verify integrity failures without touching the active show.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "caixa-dissertation-audit-"));
for (const source of archive.coverage.sources.filter(source => source.bytes !== undefined)) {
  const target = path.join(fixture, source.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(repository, source.path), target);
}
try {
  process.chdir(fixture);
  await showMemoryArchive();
  const damaged = structuredClone(transcript);
  damaged.pages[7].text = "texto parcial";
  fs.writeFileSync(DISSERTATION_TRANSCRIPT, JSON.stringify(damaged));
  await assert.rejects(showMemoryArchive(), /desatualizado\/incompleto/);
  fs.writeFileSync(DISSERTATION_TRANSCRIPT, JSON.stringify(transcript));
  fs.appendFileSync(DISSERTATION_PDF, "\nchanged-source\n");
  await assert.rejects(showMemoryArchive(), /desatualizado\/incompleto/);
} finally {
  process.chdir(repository);
  fs.rmSync(fixture, { recursive: true, force: true });
}
console.log("DISSERTATION MEMORY PASS: 182 páginas integrais, hashes PDF/texto, autoria/páginas, 6 consultas temáticas, filtro do Tarô e rejeição de fonte alterada; sem chamadas ao modelo.");
