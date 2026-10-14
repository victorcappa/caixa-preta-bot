import { SCENE_ZERO_PARTICIPANT_WAITING_LINES } from "../../data/scene-zero-participant-waiting.js";

export function localParticipantSequence(winnerName, invite) {
  const name = `${winnerName || ""}`.trim();
  if (!name) return null;
  return {
    invite,
    comments: SCENE_ZERO_PARTICIPANT_WAITING_LINES.slice(0, 3),
    announcement: name,
    // Preserve the existing local participant fallback copy.
    centerInvitation: `${name}. A pessoa escolhida continua escolhida. Venha ao centro.`
  };
}
