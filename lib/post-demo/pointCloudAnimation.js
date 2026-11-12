// Projector calibration. Amplitude is a fraction of the original cloud's largest side.
// Zero pulse/size/highlight intensity or localAmplitude disables that effect.
export const POINT_CLOUD_ANIMATION = Object.freeze({
  pulsePeriodSeconds: 5,
  pulseIntensity: .18,
  pulseSize: .14,
  highlightIntensity: .20,
  localAmplitude: .0025,
  motionSpeed: .85, // radians per second; slower harmonics vary the three axes
  rowPhaseSpread: Math.PI * 1.65,
  rotationPeriodSeconds: 22,
  rotationAmplitude: .14
});

export const pointCloudVertexShader = `
  attribute vec4 aLife;
  varying vec3 rgb;
  uniform float pointSize;
  uniform float fitDistance;
  uniform float uTime;
  uniform float uPulsePeriod;
  uniform float uPulseIntensity;
  uniform float uPulseSize;
  uniform float uHighlightIntensity;
  uniform float uLocalAmplitude;
  uniform float uMotionSpeed;
  uniform float uRowPhaseSpread;
  void main() {
    float phase = uTime * 6.28318530718 / max(uPulsePeriod, 1.0) - aLife.y * uRowPhaseSpread;
    float pulse = sin(phase);
    float t = uTime * uMotionSpeed;
    vec3 wobble = vec3(sin(t + aLife.x), sin(t * .83 + aLife.x * 1.17), sin(t * .67 + aLife.x * .73 + 1.6));
    // The vector remains inside uLocalAmplitude, with extra protection in bright facial detail.
    vec3 displaced = position + wobble * (uLocalAmplitude * aLife.w * .57735026919);
    vec4 p = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * p;
    gl_PointSize = clamp(pointSize * fitDistance / max(-p.z, .02) * (1.0 + clamp(uPulseSize, 0.0, .3) * pulse), 1.0, 6.0);
    float headroom = 1.0 - max(max(color.r, color.g), color.b);
    float crest = max(pulse, 0.0);
    float accent = smoothstep(.86, .99, aLife.z) * crest * crest * crest;
    // Scalar RGB gain preserves hue; headroom and bounded strengths keep highlights below clipping.
    float gain = 1.0 + headroom * (clamp(uPulseIntensity, 0.0, .6) * pulse + clamp(uHighlightIntensity, 0.0, .35) * accent);
    rgb = color * gain;
  }
`;

export const pointCloudFragmentShader = `
  varying vec3 rgb;
  void main() {
    vec2 delta = gl_PointCoord - vec2(.5);
    float radiusSquared = dot(delta, delta);
    if (radiusSquared > .25) discard;
    gl_FragColor = vec4(rgb * (1.0 - .55 * smoothstep(.09, .26, radiusSquared)), 1.0);
  }
`;
