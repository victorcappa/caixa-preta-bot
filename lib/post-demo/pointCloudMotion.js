import { normalizePointCloudSettings } from "./pointCloudSettings.js";

const TAU = Math.PI * 2;
const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };

function neutral(settings, phase = "still") {
  return { camera: [0, 0, settings.endDistance], target: [0, 0, 0], yaw: 0, opacity: 1, reveal: 1, phase };
}

function journey(settings, elapsed, preset) {
  if (preset === "still") return neutral(settings);
  const result = neutral(settings, "automatic");
  const phase = TAU * ((elapsed % settings.tourSeconds) / settings.tourSeconds);
  const rotationPhase = TAU * ((elapsed % settings.rotationPeriodSeconds) / settings.rotationPeriodSeconds);
  // This ramp is applied once, never again at the boundaries of the repeating path.
  const ramp = smooth(elapsed / Math.min(4, settings.tourSeconds * .1));
  const tourDistance = settings.endDistance + (settings.startDistance - settings.endDistance) * (1 - Math.cos(phase)) / 2;
  const parallax = preset === "reveal-tour" ? clamp01(tourDistance / Math.max(settings.startDistance, settings.endDistance)) : 1;
  const amplitude = settings.travelAmplitude * ramp * parallax;
  const depthAmplitude = amplitude / .14;
  // A full turn accumulates its angle instead of wrapping back to zero each period.
  const yaw = settings.rotationDegrees === 360 ? TAU * elapsed / settings.rotationPeriodSeconds * ramp
    : settings.rotationDegrees * Math.PI / 180 * ramp * Math.sin(rotationPhase);
  const sine = Math.sin(phase), doubleSine = Math.sin(phase * 2), cosine = Math.cos(phase);

  if (preset === "rotate") {
    result.yaw = yaw;
  } else if (preset === "dolly") {
    result.camera[2] = settings.endDistance * (1 - .22 * depthAmplitude * sine);
  } else if (preset === "lateral") {
    result.camera = [amplitude * 1.2 * sine, amplitude * .12 * doubleSine,
      settings.endDistance * (1 + .04 * depthAmplitude * (1 - Math.cos(phase * 2)))];
    result.target = [amplitude * .65 * sine, amplitude * .04 * doubleSine, 0];
    result.yaw = yaw;
  } else if (preset === "rows") {
    result.camera = [amplitude * .12 * doubleSine, amplitude * .9 * sine,
      settings.endDistance * (1 - .16 * depthAmplitude * sine)];
    result.target = [amplitude * .08 * doubleSine, amplitude * .75 * sine, amplitude * .06 * (1 - cosine)];
    result.yaw = yaw;
  } else {
    // Front-facing parallax: move the camera and its focus by different amounts.
    result.camera = [amplitude * .75 * sine, amplitude * .24 * doubleSine,
      preset === "reveal-tour" ? tourDistance : settings.endDistance * (1 - .10 * depthAmplitude * sine)];
    result.target = [amplitude * .32 * sine, amplitude * .14 * doubleSine, preset === "reveal-tour" ? 0 : amplitude * .08 * (1 - cosine)];
    result.yaw = yaw;
  }
  return result;
}

// Pure camera sampling. X/Y and target coordinates scale with the cloud's largest side;
// camera Z scales with its fitted distance. The original point positions never change.
export function samplePointCloudMotion(value, elapsedSeconds) {
  const settings = normalizePointCloudSettings(value);
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  if (!settings.motionEnabled || settings.preset === "still") return neutral(settings);
  if (settings.preset !== "reveal-tour") return journey(settings, elapsed, settings.preset);

  const dark = settings.startDarkSeconds;
  if (elapsed < dark) {
    const amount = smooth(elapsed / dark);
    return { camera: [0, 0, settings.endDistance + (settings.startDistance - settings.endDistance) * amount],
      target: [0, 0, 0], yaw: 0, opacity: 0, reveal: .002, phase: "dark" };
  }

  const revealedAfter = dark + settings.revealSeconds;
  if (elapsed < revealedAfter) {
    const amount = smooth((elapsed - dark) / settings.revealSeconds);
    return { camera: [0, 0, settings.startDistance + (settings.endDistance - settings.startDistance) * amount],
      target: [0, 0, 0], yaw: 0, opacity: amount, reveal: .002 + .998 * amount, phase: "reveal" };
  }

  return journey(settings, elapsed - revealedAfter, "reveal-tour");
}
