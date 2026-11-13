import assert from "node:assert/strict";
import { localParticipantSequence, participantCenterInvitationIsComplete } from "../lib/scene-zero/participantFallback.js";
import { SCENE_ZERO_PARTICIPANT_WAITING_LINES } from "../data/scene-zero-participant-waiting.js";

const sequence = localParticipantSequence(" Participante de teste ", "Convite existente");
assert.equal(sequence.invite, "Convite existente");
assert.equal(sequence.announcement, "Participante de teste");
assert.deepEqual(sequence.comments, SCENE_ZERO_PARTICIPANT_WAITING_LINES.slice(0, 3));
assert(sequence.comments.every((line) => !line.includes("Participante de teste")));
assert.equal(sequence.centerInvitation, "Participante de teste. Venha ao centro da cena e fique de frente para mim, olhando para a tela.");
assert.equal(participantCenterInvitationIsComplete(sequence.centerInvitation, "Participante de teste"), true);
assert.equal(participantCenterInvitationIsComplete("Participante de teste, venha ao centro.", "Participante de teste"), false);
assert.equal(participantCenterInvitationIsComplete("Participante de teste, fique de frente para a tela.", "Participante de teste"), false);
assert.equal(participantCenterInvitationIsComplete(sequence.centerInvitation, "Outra pessoa"), false);
assert.equal(localParticipantSequence("", "Convite existente"), null);
console.log("Participant invitation preserves the selected name, center-stage call and facing-screen instruction");
