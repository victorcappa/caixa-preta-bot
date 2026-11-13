import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith('@/')) url = pathToFileURL(path.resolve(root, specifier.slice(2))).href;
  else if (specifier.startsWith('.')) url = new URL(specifier, context.parentURL).href;
  if (url?.startsWith('file:') && !path.extname(fileURLToPath(url)) && fs.existsSync(`${fileURLToPath(url)}.js`)) return nextResolve(`${url}.js`, context);
  return nextResolve(url || specifier, context);
} });
const { getReferenceLibrary } = await import('../lib/referenceLibrary.js');
const { islandTopics, islandTrails, referenceRelations, islandReferencePosition } = await import('../lib/referenceIsland.js');
const { referenceExperimentContext, generateReferenceExperiment } = await import('../lib/referenceExperiment.js');
const { POST } = await import('../app/api/reference-experiment/route.js');
const { cabinetTools, cabinetPage, referenceThing } = await import('../lib/referenceThings.js');
const { createReferenceThing } = await import('../lib/createReferenceThing.js');
const THREE = await import('three');
const library = await getReferenceLibrary();
assert.equal(library.island.models.length, 14);
assert.equal(new Set(library.island.models.map(model => model.id)).size, 14);
assert.equal(cabinetTools.length, 8);
assert.equal(new Set(cabinetTools.map(tool => tool.action)).size, 8, 'Each functional object has a distinct use');
const people = library.items.filter(item => item.group === 'pessoas');
assert.equal(people.length, 35);
for (const person of people) {
  assert(person.biography && person.biography.length > 180 && person.biography.length < 700, `${person.title}: brief authored biography`);
  assert(person.objectType && person.thing.type === person.objectType);
  assert(person.objectReason?.length > 80 && person.thing.playLink === person.objectReason, `${person.title}: the object has an individual dramaturgical reason`);
  assert.notEqual(person.objectType, 'mirror', 'The generic mirror must not stand in for people without a specific association.');
  assert(person.sources.length > 0, `${person.title}: factual provenance stays accessible`);
}
for (const type of new Set([...cabinetTools.map(tool => tool.type), ...people.map(person => person.objectType)])) {
  const object = createReferenceThing(THREE, type, { size: 1.5 });
  const box = new THREE.Box3().setFromObject(object), size = box.getSize(new THREE.Vector3());
  assert(Math.abs(Math.max(size.x, size.y, size.z) - 1.5) < .001, `${type}: tangible prop has a normalized selectable volume`);
  let meshes = 0; object.traverse(part => { if (part.isMesh) meshes++; assert(!part.isSprite && !part.isPoints, 'Things must be geometry, not luminous point markers'); });
  assert(meshes > 1, `${type}: an identifiable assembled object`);
  object.traverse(part => { part.geometry?.dispose(); [].concat(part.material || []).forEach(material => material.dispose()); });
}
const page = cabinetPage(library.items, people.map(person => person.id), people[0].id, 1);
assert(page.items.length <= 13 && page.count === 3, '35 people are explored as readable groups of tangible things');
assert.equal(referenceThing(people[0]).basis.includes('não um pertence real'), true);
const morel = library.items.find(item => item.id === 'CP-05');
assert.equal(morel.thing.type, 'triptychMirror');
assert(morel.sources.some(source => source.url.includes('ieturolenses.org')));
const mirror = createReferenceThing(THREE, morel.thing.type);
let panels = 0; mirror.traverse(node => { if (node.userData.mirrorPanel) panels++; });
assert.equal(panels, 3, 'The Morel mirror has three physical panels.');
mirror.traverse(node => { node.geometry?.dispose(); [].concat(node.material || []).forEach(material => material.dispose()); });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const model of library.island.models) {
  const file = path.resolve(root, model.storagePath || `public${model.url}`);
  const bytes = fs.readFileSync(file);
  if (model.id === 'pieta') {
    assert.equal(hash(bytes), model.fileSha256);
    const decoded = zlib.gunzipSync(bytes);
    assert.equal(hash(decoded), model.sha256);
    assert.equal(model.triangles, model.sourceTriangles);
    assert.equal(model.sourcePolygons, 950347);
    assert.equal(model.source, '../pieta1.blend');
    assert.equal(model.initial, false, 'Heavy original must remain on-demand');
  } else {
    assert.equal(hash(bytes), model.sha256);
    if (fs.existsSync(path.resolve(root, model.source))) assert.equal(hash(fs.readFileSync(path.resolve(root, model.source))), model.sha256, `${model.id}: exact source copy`);
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  }
  const item = library.items.find(item => item.modelId === model.id);
  assert.equal(item.status, 'scenic'); assert.equal(item.chunkCount, 0); assert.equal(hash(bytes), item.sha256, 'Catalogue hash describes the actual stored source file');
  assert(islandTopics.some(topic => topic.id === model.topic));
}
for (const trail of islandTrails) for (const step of trail.steps) assert(library.island.models.some(model => model.id === step.object));
for (const [index, item] of library.items.entries()) {
  assert(islandReferencePosition(item, index).every(Number.isFinite));
  for (const relation of referenceRelations(item, library.items)) {
    const other = library.items.find(candidate => candidate.id === relation.id);
    assert(other);
    if (relation.type === 'documented') assert(item.relatedIds.includes(other.id) || other.relatedIds.includes(item.id));
    else { assert(relation.shared.length); assert.match(relation.reason, /Leitura curatorial/); }
  }
}
const context = await referenceExperimentContext({ ids: ['marcus-garcia-labirinto', 'pessoa-luzia-huttenmoser'], question: 'corpo e comando' });
assert.equal(context.sources.length, 2); assert(context.sources[0].segments.every(segment => segment.page > 0));
assert.equal(context.fixedContext[0].sources.length, 7); assert.equal(context.fixedContext[1].sources.length, 3);
assert(!JSON.stringify(context).includes('training-examples.json'));
let calls = 0;
const result = await generateReferenceExperiment(context, { generate: async input => { calls++; assert(input[0].content.includes('Não explique o cruzamento')); assert(input[1].content.includes(context.context)); return { status: 'completed', output_text: 'A máquina guardou o comando. O corpo guardou o impacto. Agora os dois disputam qual deles estava no controle.' }; } });
assert.equal(calls, 1); assert.equal(result.kind, 'generated'); assert(!('context' in result) && !('baseKnowledge' in result));
assert.deepEqual(result.sources, context.sources);
await assert.rejects(() => referenceExperimentContext({ ids: ['../../.env.local', 'objeto-piloto'] }));
await assert.rejects(() => referenceExperimentContext({ ids: ['objeto-piloto', 'objeto-piloto'] }));
await assert.rejects(() => generateReferenceExperiment(context, { generate: async () => ({ status: 'incomplete', output_text: 'parcial' }) }));
const post = body => POST(new Request('http://localhost/api/reference-experiment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const preview = await post({ action: 'preview', ids: ['CP-05', 'objeto-piloto'] });
assert(preview.ok); const trace = await preview.json(); assert.equal(trace.kind, 'preview'); assert.equal(trace.sources.length, 2); assert(!('baseKnowledge' in trace));
assert.equal((await POST(new Request('http://localhost/api/reference-experiment', { method: 'POST', headers: { origin: 'http://127.0.0.1', host: '127.0.0.1' }, body: JSON.stringify({ action: 'preview', ids: ['CP-05', 'objeto-piloto'] }) }))).status, 200, 'Next internal hostname may differ from the public Host');
assert.equal((await post({ action: 'unknown', ids: [] })).status, 400);
assert.equal((await POST(new Request('http://localhost/api/reference-experiment', { method: 'POST', headers: { origin: 'https://elsewhere.invalid' }, body: '{}' }))).status, 403);
console.log(JSON.stringify({ ok: true, models: library.island.models.length, records: library.items.length, trails: islandTrails.length, sourceCopiesExact: true, pietaGeometryPreserved: true, experimentProvider: 'mock only' }, null, 2));
