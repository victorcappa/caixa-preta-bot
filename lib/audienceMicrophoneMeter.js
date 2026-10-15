const workletLoads = new WeakMap();

function pollAnalyser(analyser, onSample) {
  const samples = new Float32Array(analyser.fftSize);
  let lastAt = performance.now();
  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    let energy = 0;
    for (const sample of samples) energy += sample * sample;
    const now = performance.now();
    onSample({ rms: Math.sqrt(energy / samples.length), elapsedMs: Math.min(100, now - lastAt) });
    lastAt = now;
  }, 50);
  return { mode: "analyser-timer", stop: () => window.clearInterval(timer) };
}

export async function startAudienceMicrophoneMeter({ context, source, analyser, onSample }) {
  if (!context.audioWorklet || !window.AudioWorkletNode) return pollAnalyser(analyser, onSample);
  let node;
  try {
    if (!workletLoads.has(context)) {
      const load = context.audioWorklet.addModule("/audio-worklets/audience-meter.js")
        .catch((error) => { workletLoads.delete(context); throw error; });
      workletLoads.set(context, load);
    }
    await workletLoads.get(context);
    node = new window.AudioWorkletNode(context, "caixa-preta-audience-meter", {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1]
    });
    node.port.onmessage = ({ data }) => onSample(data);
    source.connect(node);
    node.connect(context.destination);
    return { mode: "audio-worklet", stop: () => {
      node.port.onmessage = null;
      node.port.close();
      try { source.disconnect(node); } catch {}
      node.disconnect();
    } };
  } catch {
    node?.disconnect();
    if (node) {
      node.port.onmessage = null;
      node.port.close();
      try { source.disconnect(node); } catch {}
    }
    return pollAnalyser(analyser, onSample);
  }
}
