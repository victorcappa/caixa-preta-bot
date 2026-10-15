/* global AudioWorkletProcessor, registerProcessor, sampleRate */

// Audio render clock, independent of visibility and requestAnimationFrame.
class AudienceMeterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.energy = 0;
    this.samples = 0;
    this.frames = 0;
  }

  process(inputs, outputs) {
    const channels = inputs[0] || [];
    const frames = channels[0]?.length || outputs[0]?.[0]?.length || 0;
    for (const channel of channels) {
      for (const sample of channel) this.energy += sample * sample;
      this.samples += channel.length;
    }
    this.frames += frames;
    if (this.frames >= sampleRate * 0.05) {
      this.port.postMessage({
        rms: this.samples ? Math.sqrt(this.energy / this.samples) : 0,
        elapsedMs: (this.frames / sampleRate) * 1000
      });
      this.energy = 0;
      this.samples = 0;
      this.frames = 0;
    }
    // Outputs remain zero: the microphone must never play back into the room.
    return true;
  }
}

registerProcessor("caixa-preta-audience-meter", AudienceMeterProcessor);
