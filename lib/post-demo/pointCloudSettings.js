import { POINT_CLOUD_ANIMATION } from "./pointCloudAnimation.js";

export const POINT_CLOUD_PRESETS = [
  { id: "reveal-tour", label: "Revelar e passear", description: "Entra no escuro, revela a plateia e começa um passeio contínuo." },
  { id: "tour", label: "Passeio panorâmico", description: "Percorre o espaço com deslocamento, profundidade e pequenas mudanças de ângulo." },
  { id: "rows", label: "Entre as fileiras", description: "Sobe e desce pelas fileiras, aproximando e afastando a câmera." },
  { id: "lateral", label: "Travessia lateral", description: "Passeia de um lado ao outro da plateia." },
  { id: "rotate", label: "Só rotacionar", description: "Mantém a câmera no centro e gira a nuvem lateralmente." },
  { id: "dolly", label: "Aproximar e afastar", description: "Varia apenas a distância da câmera." },
  { id: "still", label: "Câmera parada", description: "Mantém o enquadramento parado; a respiração do shader continua." }
];

export const POINT_CLOUD_FIELDS = [
  { id: "startDarkSeconds", group: "motion", label: "Tempo no escuro", min: 0, max: 10, step: .1, default: 2, unit: "s" },
  { id: "revealSeconds", group: "motion", label: "Tempo de revelação", min: 2, max: 90, step: 1, default: 18, unit: "s" },
  { id: "startDistance", group: "motion", label: "Distância inicial", min: .02, max: .25, step: .01, default: .05, unit: "×" },
  { id: "endDistance", group: "motion", label: "Distância final / zoom-out", min: .35, max: 1.8, step: .01, default: .8, unit: "×" },
  { id: "tourSeconds", group: "motion", label: "Duração do passeio", min: 8, max: 180, step: 1, default: 48, unit: "s" },
  { id: "travelAmplitude", group: "motion", label: "Amplitude do passeio", min: 0, max: .35, step: .01, default: .14, percent: true },
  { id: "rotationPeriodSeconds", group: "motion", label: "Duração do giro", min: 6, max: 120, step: 1, default: POINT_CLOUD_ANIMATION.rotationPeriodSeconds, unit: "s" },
  { id: "rotationDegrees", group: "motion", label: "Amplitude do giro", min: 0, max: 20, step: .5, default: 8, unit: "°" },
  { id: "resumeDelaySeconds", group: "motion", label: "Espera após navegação manual", min: 0, max: 15, step: .5, default: 2, unit: "s" },
  { id: "pulsePeriodSeconds", group: "shader", label: "Período do pulso", min: 1, max: 20, step: .5, default: POINT_CLOUD_ANIMATION.pulsePeriodSeconds, unit: "s" },
  { id: "pulseIntensity", group: "shader", label: "Intensidade da luz", min: 0, max: .6, step: .01, default: POINT_CLOUD_ANIMATION.pulseIntensity, percent: true },
  { id: "pulseSize", group: "shader", label: "Pulso do tamanho dos pontos", min: 0, max: .3, step: .01, default: POINT_CLOUD_ANIMATION.pulseSize, percent: true },
  { id: "highlightIntensity", group: "shader", label: "Realces no pico", min: 0, max: .35, step: .01, default: POINT_CLOUD_ANIMATION.highlightIntensity, percent: true },
  { id: "localAmplitude", group: "shader", label: "Oscilação local", min: 0, max: .008, step: .0001, default: POINT_CLOUD_ANIMATION.localAmplitude, percent: true },
  { id: "motionSpeed", group: "shader", label: "Velocidade da oscilação", min: 0, max: 3, step: .05, default: POINT_CLOUD_ANIMATION.motionSpeed, unit: "×" },
  { id: "rowPhaseSpread", group: "shader", label: "Defasagem entre fileiras", min: 0, max: Math.PI * 2, step: .1, default: POINT_CLOUD_ANIMATION.rowPhaseSpread, cyclePercent: true },
  { id: "pointSize", group: "shader", label: "Tamanho dos pontos", min: .4, max: 1.8, step: .05, default: 1, unit: "×" },
  { id: "brightness", group: "shader", label: "Brilho da foto", min: .5, max: 1.4, step: .05, default: 1, unit: "×" }
];

export function normalizePointCloudSettings(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    preset: POINT_CLOUD_PRESETS.some(preset => preset.id === source.preset) ? source.preset : "reveal-tour",
    motionEnabled: typeof source.motionEnabled === "boolean" ? source.motionEnabled : true,
    shaderEnabled: typeof source.shaderEnabled === "boolean" ? source.shaderEnabled : true,
    ...Object.fromEntries(POINT_CLOUD_FIELDS.map(field => [field.id, Number.isFinite(source[field.id]) ? Math.max(field.min, Math.min(field.max, source[field.id])) : field.default]))
  };
}
