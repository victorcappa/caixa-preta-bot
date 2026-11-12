import assert from "node:assert/strict";
import { buildPostDemoOpening } from "../lib/post-demo/opening.js";

const prefix = "Inicio uma nova rodada de treinamento.";
const empty = buildPostDemoOpening();
for (const state of [undefined, null, false, 12, "state", {}, { conversation: "INVALID", memories: { content: "INVALID" } }]) {
  const result = buildPostDemoOpening(state);
  assert.equal(result, empty); assert(result.startsWith(prefix));
  assert(result.length >= 200 && result.length <= 350);
}
assert.match(empty, /A próxima etapa ainda está aberta/);
assert(!/\d+ (?:registros?|notas?)/.test(empty), "o estado vazio não deve inventar contagens");
assert(!empty.includes("?"));

const now = Date.now(), sessionStart = new Date(now - 60000).toISOString(), validTime = new Date(now - 10000).toISOString();
const oldTime = new Date(now - 120000).toISOString(), expired = new Date(now - 1000).toISOString(), future = new Date(now + 60000).toISOString();
const sentinel = "PARTICIPANT_PRIVATE_NAME /Users/private-photo.jpg API_SECRET_SENTINEL";
const record = (id, patch = {}) => ({ id, role: "assistant", content: sentinel, timestamp: validTime, ...patch });
const fixture = {
  reliability: { sessionId: "SESSION_PRIVATE_SENTINEL" }, sceneZero: { sessionStartedAt: sessionStart, stage: "PRIVATE_STAGE" },
  participants: { session: [{ name: "PARTICIPANT_PRIVATE_NAME" }] },
  conversation: [record("main-user", { role: "user" }), record("main-bot"), record("main-bot"), record("blank", { content: " \n\t\u200b" }),
    record("not-text", { content: 123 }), record("bad-role", { role: "system" }), record("old", { timestamp: oldTime }), record("invalid-time", { timestamp: "INVALID" }),
    record("future", { timestamp: future }), record("other-session", { sessionId: "OTHER_PRIVATE_SESSION" }), null, sentinel],
  operatorPublic: { messages: [record("operator-user", { role: "user", status: "complete", timestamp: undefined }),
    record("operator-fallback", { status: "fallback", timestamp: undefined }), record("main-bot"), record("stream", { status: "streaming" }), record("failed", { status: "failed" })] },
  liveTraining: { messages: [record("training-complete", { status: "complete", timestamp: undefined }), record("training-alt", { status: "complete", kind: "alternative", timestamp: undefined }),
    record("cancelled", { status: "cancelled" }), record("pending", { status: "pending" })] },
  memories: [record("note-1"), record("note-1"), record("note-2", { timestamp: undefined, createdAt: validTime, expiresAt: future }),
    record("empty-note", { content: "" }), record("old-note", { timestamp: oldTime }), record("expired-note", { expiresAt: expired }),
    record("invalid-expiry", { expiresAt: "INVALID" }), record("future-note", { timestamp: future }), record("other-note", { sessionId: "OTHER_PRIVATE_SESSION" })],
  postDemo: { rounds: [{ content: sentinel }] }, config: { secret: "API_SECRET_SENTINEL" }, pointCloud: { sourceName: "private-photo.jpg" }
};
const before = structuredClone(fixture), result = buildPostDemoOpening(fixture);
assert(result.startsWith(prefix)); assert.match(result, /Reúno 6 registros textuais e 2 notas desta apresentação/);
assert(result.length >= 200 && result.length <= 350); assert(!result.includes("?"));
for (const hidden of [sentinel, "PARTICIPANT_PRIVATE_NAME", "API_SECRET_SENTINEL", "SESSION_PRIVATE_SENTINEL", "OTHER_PRIVATE_SESSION", "private-photo.jpg", "/Users/", "PRIVATE_STAGE", "main-bot", validTime]) assert(!result.includes(hidden));
assert.deepEqual(fixture, before, "a abertura não deve modificar o histórico nem a sessão");

const singleMessage = buildPostDemoOpening({ conversation: [{ role: "user", content: "Dados reais privados." }] });
assert.match(singleMessage, /Reúno 1 registro textual desta apresentação\./);
assert(!singleMessage.includes("notas"));
assert(singleMessage.length >= 200 && singleMessage.length <= 350);
const singleNote = buildPostDemoOpening({ memories: [{ content: "Uma nota real sem timestamp legado." }] });
assert.match(singleNote, /Reúno 1 nota desta apresentação\./);
assert(!singleNote.includes("registros textuais"));
assert(singleNote.length >= 200 && singleNote.length <= 350);
assert.equal(buildPostDemoOpening({ memories: [{ content: "INVÁLIDA", expiresAt: 0 }] }), empty);
assert.equal(buildPostDemoOpening({ conversation: [{ role: "assistant", content: "INVÁLIDO", status: "" }] }), empty);
assert.match(buildPostDemoOpening({ conversation: [record("bad-first", { status: "streaming" }), record("bad-first", { status: "complete" })] }), /1 registro textual/);

console.log("POST DEMO OPENING PASS: real valid session counts, pluralization, empty-state honesty, timestamps/expiry, no free text or identities and no mutation");
