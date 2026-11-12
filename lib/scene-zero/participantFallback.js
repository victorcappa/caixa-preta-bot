import { SCENE_ZERO_PARTICIPANT_WAITING_LINES } from "../../data/scene-zero-participant-waiting.js";

export function participantCenterInvitationIsComplete(text, winnerName) {
  const normalize = (value) => `${value || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const invitation = normalize(text);
  const name = normalize(winnerName).trim();
  return Boolean(name && invitation.includes(name) && invitation.includes("centro")
    && invitation.includes("de frente") && invitation.includes("tela"));
}

export function localParticipantSequence(winnerName, invite) {
  const name = `${winnerName || ""}`.trim();
  if (!name) return null;
  return {
    invite,
    comments: SCENE_ZERO_PARTICIPANT_WAITING_LINES.slice(0, 3),
    announcement: name,
    centerInvitation: `${name}. Venha ao centro da cena e fique de frente para mim, olhando para a tela.`
  };
}
