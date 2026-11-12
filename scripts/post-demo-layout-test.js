import assert from "node:assert/strict";
import { DEFAULT_POST_DEMO_LAYOUT, POST_DEMO_LAYOUT_MODULES, normalizePostDemoLayout, resolvePostDemoLayout, patchPostDemoLayout } from "../lib/post-demo/layout.js";

const automatic = { card: null, text: null, cloud: null };
assert.deepEqual(POST_DEMO_LAYOUT_MODULES.map(({ id, label }) => [id, label]), [["card", "carta"], ["text", "texto"], ["cloud", "modelo 3D"]]);
for (const value of [undefined, null, false, 3, "layout", [], {}]) assert.deepEqual(normalizePostDemoLayout(value), automatic);
assert.deepEqual(resolvePostDemoLayout(), DEFAULT_POST_DEMO_LAYOUT);
assert.deepEqual(resolvePostDemoLayout(automatic, { hasCloud: false }).text, { x: 32, y: 0, width: 68, height: 100 });
assert.deepEqual(resolvePostDemoLayout(automatic, { hasCloud: false }).cloud, DEFAULT_POST_DEMO_LAYOUT.cloud);
assert.deepEqual(normalizePostDemoLayout({ text: { unknown: 10 }, hidden: { x: 4, y: 5, width: 20, height: 20 } }), automatic);

const explicit = { x: 12, y: 8, width: 35, height: 60 };
const custom = normalizePostDemoLayout({ text: { ...explicit, private: "discard" }, obsolete: "discard" });
assert.deepEqual(custom, { card: null, text: explicit, cloud: null });
assert.deepEqual(resolvePostDemoLayout(custom, { hasCloud: true }).text, explicit);
assert.deepEqual(resolvePostDemoLayout(custom, { hasCloud: false }).text, explicit, "a chegada/saída da nuvem não deve apagar o ajuste de texto");

for (const x of [-40, 0, 60, 120]) for (const y of [-10, 45, 200]) {
  for (const width of [-10, 0, 8, 35, 100, 180]) for (const height of [-4, 8, 32, 101]) {
    const rectangle = normalizePostDemoLayout({ cloud: { x, y, width, height } }).cloud;
    assert(Object.values(rectangle).every(Number.isFinite));
    assert(rectangle.width >= 8 && rectangle.height >= 8);
    assert(rectangle.x >= 0 && rectangle.y >= 0 && rectangle.x + rectangle.width <= 100 && rectangle.y + rectangle.height <= 100);
  }
}
assert.deepEqual(normalizePostDemoLayout({ card: { x: 90, y: -8, width: 180, height: 0 } }).card, { x: 0, y: 0, width: 100, height: 8 });
assert.deepEqual(normalizePostDemoLayout({ cloud: { x: NaN, width: Infinity, height: "40" } }), automatic);
assert.deepEqual(normalizePostDemoLayout({ cloud: { x: 5, height: 40 } }).cloud, { x: 5, y: 0, width: 28, height: 40 });

const current = { card: { x: 5, y: 4, width: 20, height: 50 }, text: explicit, cloud: { x: 70, y: 10, width: 20, height: 40 } };
const before = structuredClone(current);
const moved = patchPostDemoLayout(current, { cloud: { x: 65, ignored: 1 } });
assert.deepEqual(moved.cloud, { x: 65, y: 10, width: 20, height: 40 });
assert.deepEqual(moved.card, current.card); assert.deepEqual(moved.text, current.text);
assert.deepEqual(current, before, "a mesclagem não deve mutar os valores em uso");
assert.deepEqual(patchPostDemoLayout(automatic, { text: { width: 20 } }).text, { x: 30, y: 0, width: 20, height: 100 });
assert.deepEqual(patchPostDemoLayout(current, { text: null }), { ...before, text: null });
assert.deepEqual(resolvePostDemoLayout(patchPostDemoLayout(current, { text: null }), { hasCloud: false }).text, { x: 32, y: 0, width: 68, height: 100 });
assert.deepEqual(patchPostDemoLayout(current, null), automatic);
for (const patch of [undefined, false, 12, "reset", [], { missing: {} }, { card: undefined, cloud: { x: NaN, width: "90", junk: 1 } }]) {
  assert.deepEqual(patchPostDemoLayout(current, patch), before, "patch inválido deve preservar os ajustes existentes");
}
assert.deepEqual(patchPostDemoLayout(current, { cloud: { x: 99 } }).cloud, { x: 80, y: 10, width: 20, height: 40 });

const resolved = resolvePostDemoLayout(); resolved.card.width = 9;
assert.equal(DEFAULT_POST_DEMO_LAYOUT.card.width, 28, "retângulos resolvidos não podem mutar os padrões compartilhados");
const normalized = normalizePostDemoLayout(current); normalized.card.x = 7;
assert.deepEqual(current, before, "a normalização deve retornar novas referências");

console.log("POST DEMO LAYOUT PASS: automatic/cloudless defaults, persistent explicit overrides, bounded geometry, partial patches, reset and isolation");
