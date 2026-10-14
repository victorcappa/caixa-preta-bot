import assert from "node:assert/strict";
import { localParticipantSequence } from "../lib/scene-zero/participantFallback.js";
import { SCENE_ZERO_PARTICIPANT_WAITING_LINES } from "../data/scene-zero-participant-waiting.js";

const sequence = localParticipantSequence(" Participante de teste ", "Convite existente");
assert.equal(sequence.invite, "Convite existente");
assert.equal(sequence.announcement, "Participante de teste");
assert.deepEqual(sequence.comments, SCENE_ZERO_PARTICIPANT_WAITING_LINES.slice(0, 3));
assert(sequence.comments.every((line) => !line.includes("Participante de teste")));
assert.equal(sequence.centerInvitation, "Participante de teste. A pessoa escolhida continua escolhida. Venha ao centro.");
assert.equal(localParticipantSequence("", "Convite existente"), null);
console.log("Participant fallback preserves the selected name and existing local copy");
