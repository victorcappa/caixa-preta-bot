// Configuração ativa antes da troca temporária de 2026-09-10.
// Os componentes de karaokê, a BIOS corrompida e todos os assets permanecem no projeto.
export const LEGACY_SCENE_ZERO_SUITCASE_ORDER = [2, 3, 1];

export const LEGACY_SCENE_ZERO_SUITCASES = {
  1: { id: 1, label: "NOVA BIOS", game: "morel_bios" },
  2: { id: 2, label: "EVIDÊNCIAS", game: "gincana" },
  3: { id: 3, label: "OBJETO PELO CHEIRO", game: "gincana" }
};

export {
  SCENE_ZERO_EVIDENCIAS_AUDIO_FILE,
  SCENE_ZERO_EVIDENCIAS_CHALLENGE,
  SCENE_ZERO_EVIDENCIAS_DURATION_SECONDS,
  SCENE_ZERO_EVIDENCIAS_INTRO_SECONDS,
  SCENE_ZERO_EVIDENCIAS_LYRICS,
  SCENE_ZERO_EVIDENCIAS_PLAYBACK_RATE,
  SCENE_ZERO_GINCANAS as LEGACY_SCENE_ZERO_GINCANAS,
  SCENE_ZERO_SMELL_CHALLENGE
} from "../scene-zero-gincanas.js";
