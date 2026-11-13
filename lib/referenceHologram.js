// Color-preserving projection effects shared by the terrain and holographic sun.
export const referenceHologramGLSL = `
  float referenceHologramHash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  vec4 referenceHologramFields(vec3 p, float time, float density) {
    float height = dot(p, vec3(.16, 1., .12));
    float phase = height * density - time * 1.05;
    float scan = pow(.5 + .5 * sin(phase), 4.);
    scan *= 1. - smoothstep(.8, 3., fwidth(phase));
    float sweep = pow(.5 + .5 * sin(height * 2.4 - time * .35), 28.);
    float grain = referenceHologramHash(floor(p * 60.) + floor(time * 10.));
    float dropout = smoothstep(.965, .995, referenceHologramHash(vec3(floor(height * 6.), floor(time * .7), 3.)));
    return vec4(scan, sweep, grain, dropout);
  }
`;

export function applyReferenceHologram(material, { density = 24, opacity = .92 } = {}) {
  const uniforms = { uReferenceHologramTime: { value: 0 }, uReferenceHologramDensity: { value: density } };
  material.transparent = true; material.opacity = opacity; material.depthWrite = false;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    const varyings = 'varying vec3 vReferenceHologramPosition; varying vec3 vReferenceHologramNormal; varying vec3 vReferenceHologramView;\n';
    shader.vertexShader = varyings + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vReferenceHologramPosition = position;
      vReferenceHologramNormal = normalize(normalMatrix * normal);`);
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvReferenceHologramView = -mvPosition.xyz;');
    shader.fragmentShader = varyings + 'uniform float uReferenceHologramTime; uniform float uReferenceHologramDensity;\n' + referenceHologramGLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec4 projection = referenceHologramFields(vReferenceHologramPosition, uReferenceHologramTime, uReferenceHologramDensity);
      float projectionRim = pow(1. - abs(dot(normalize(vReferenceHologramNormal), normalize(vReferenceHologramView))), 2.);
      outgoingLight *= (.82 + projection.x * .24 + projection.y * .35 + projectionRim * .22) * (1. - projection.w * .12);
      outgoingLight *= .985 + projection.z * .015;
      diffuseColor.a *= .76 + projection.x * .18 + projectionRim * .06 - projection.w * .22;
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'reference-hologram-v1';
  return { material, update(time) { uniforms.uReferenceHologramTime.value = time; } };
}
