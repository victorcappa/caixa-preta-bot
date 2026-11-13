import assert from "node:assert/strict";
import { selectPostDemoAudioSource } from "../lib/post-demo/audioSource.js";

const source = (id, currentPath = "/pos-demo", connected = true) => ({ id, currentPath, connected });
const select = (windows, activeProjectionWindowId = null) => selectPostDemoAudioSource({ windows, activeProjectionWindowId });

for (const value of [undefined, null, false, 4, "projection", [], {}, { windows: null }, { windows: [] }, { windows: 3 }]) {
  assert.equal(selectPostDemoAudioSource(value), null, "invalid projection shapes must not elect a source");
}
assert.equal(select({}), null);
assert.equal(select({ a: null, b: false, c: [], d: {}, e: source("e", "/pos-demo", false), f: source("f", "/") }), null);
assert.equal(select({ a: source("a", "/pos-demo", "true"), b: source("b", "/pos-demo", 1) }), null);

const windows = {
  private: source("private", "/pos-demo/controle"),
  z: source("projection-z"),
  a: source("projection-a"),
  unrelated: source("unrelated", "/treinamento"),
  stale: source("projection-0", "/pos-demo", false)
};
assert.deepEqual(select(windows, "private"), { id: "projection-a", controller: false }, "a public source wins over an active private source");
assert.deepEqual(select(windows, "projection-z"), { id: "projection-z", controller: false });
assert.deepEqual(select(windows, "unrelated"), { id: "projection-a", controller: false });
assert.deepEqual(select(windows, "projection-0"), { id: "projection-a", controller: false });
assert.deepEqual(select(Object.fromEntries(Object.entries(windows).reverse())), select(windows), "object insertion order must not change the election");
assert.deepEqual(select(windows, "z"), { id: "projection-z", controller: false }, "an active object key can identify a record with its own ID");

const privateOnly = {
  z: source("private-z", "/pos-demo/controle"),
  a: source("private-a", "/pos-demo/controle"),
  public: source("public", "/pos-demo", false)
};
assert.deepEqual(select(privateOnly), { id: "private-a", controller: true });
assert.deepEqual(select(privateOnly, "private-z"), { id: "private-z", controller: true });
assert.deepEqual(select(privateOnly, "public"), { id: "private-a", controller: true });

assert.deepEqual(select({ auto: { currentPath: "/pos-demo?projectionWindow=auto", connected: true } }), { id: "auto", controller: false });
assert.deepEqual(select({ auto: { id: "", currentPath: "/pos-demo/controle?projectionWindow=auto#painel", connected: true } }), { id: "auto", controller: true });
assert.deepEqual(select({ auto: { id: 5, currentPath: "/pos-demo#ilha", connected: true } }), { id: "auto", controller: false });
for (const currentPath of ["/pos-demo/", "/pos-demo/controle/extra", "/pos-demo-extra", "https://example.com/pos-demo", "//example.com/pos-demo", " /pos-demo", null, 4]) {
  assert.equal(select({ invalid: source("invalid", currentPath) }), null, "only the exact local post-demo routes may produce sound");
}

const duplicates = {
  first: source("shared"), second: source("shared", "/pos-demo?projectionWindow=shared"),
  private: source("shared", "/pos-demo/controle")
};
assert.deepEqual(select(duplicates, "shared"), { id: "shared", controller: false }, "source identity must distinguish the public/private roles even with a cloned ID");
assert.deepEqual(select(Object.fromEntries(Object.entries(duplicates).reverse()), "shared"), select(duplicates, "shared"));
duplicates.first.connected = false; duplicates.second.connected = false;
assert.deepEqual(select(duplicates, "shared"), { id: "shared", controller: true });

assert.deepEqual(select({ "projection-10": source("projection-10"), "projection-2": source("projection-2") }), { id: "projection-10", controller: false }, "the fallback election uses stable lexical IDs");
assert.deepEqual(select({ template: { id: "template", currentPath: "/pos-demo" }, auto: { currentPath: "/pos-demo/controle", connected: true } }), { id: "auto", controller: true }, "unconnected templates must not defeat registered windows with automatic IDs");
assert.equal(select({ "": { currentPath: "/pos-demo", connected: true } }), null);

const immutable = Object.freeze({ activeProjectionWindowId: "b", windows: Object.freeze({
  a: Object.freeze(source("a")), b: Object.freeze(source("b"))
}) });
const before = structuredClone(immutable);
assert.deepEqual(selectPostDemoAudioSource(immutable), { id: "b", controller: false });
assert.deepEqual(immutable, before, "electing a source must not mutate the projection snapshot");

console.log("POST DEMO AUDIO SOURCE PASS: public/private priority, active/stable IDs, automatic IDs, exact routes, duplicates, disconnection and immutable snapshots");
