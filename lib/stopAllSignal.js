const globalKey = "__caixaPretaStopAllSignal";

function createStopAllSignal() {
  return {
    version: 0,
    stoppedAt: null
  };
}

const signal = globalThis[globalKey] || createStopAllSignal();
globalThis[globalKey] = signal;

export function getStopAllVersion() {
  return signal.version;
}

export function markStopAll() {
  signal.version += 1;
  signal.stoppedAt = new Date().toISOString();
  return { ...signal };
}
