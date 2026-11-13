import { referenceHologramGLSL } from './referenceHologram.js';

// Scenic objects for the island sky; they never participate in archive selection.
const palette = [0xffd84d, 0xff8b2d, 0xff3946, 0x4aee78, 0x428cff];
const colorStep = 6;
const vertexShader = `
  uniform float uTime;
  uniform float uHologram;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vLocal = position;
    vNormal = normalize(normalMatrix * normal);
    vec3 projected = position;
    float tear = pow(.5 + .5 * sin(position.y * 11. - uTime * .18), 64.);
    projected.x += tear * sin(uTime * 2.4) * .012 * uHologram;
    vec4 view = modelViewMatrix * vec4(projected, 1.);
    vView = -view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;

export function createReferenceSuns(THREE) {
  const object = new THREE.Group(); object.name = 'reference-suns';
  const colors = palette.map(value => new THREE.Color(value));
  const tones = colors.map(color => color.getHSL({}));
  const suns = [
    { name: 'sun-solido', radius: .95, period: 144, phase: -.85, height: 4.6, direction: 1, colorOffset: 0, hologram: false },
    { name: 'sun-holograma', radius: 1.05, period: 192, phase: 2.35, height: 5.1, direction: -1, colorOffset: 24, hologram: true }
  ].map(config => {
    const sun = new THREE.Group(); sun.name = config.name; sun.scale.setScalar(config.radius); object.add(sun);
    const color = new THREE.Color();
    const surface = new THREE.ShaderMaterial({
      toneMapped: false, transparent: config.hologram, depthWrite: !config.hologram,
      blending: THREE.NormalBlending,
      uniforms: { uColor: { value: color }, uTime: { value: 0 }, uHologram: { value: Number(config.hologram) } },
      vertexShader,
      fragmentShader: `
        varying vec3 vLocal;
        varying vec3 vNormal;
        varying vec3 vView;
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uHologram;
        ${referenceHologramGLSL}
        void main() {
          float facing = abs(dot(normalize(vNormal), normalize(vView)));
          float plasma = sin(vLocal.y * 19. + sin(vLocal.x * 12. + uTime * .35) * 2.5
            + sin(vLocal.z * 15. - uTime * .25) * 1.6) * .5 + .5;
          float rim = pow(1. - facing, 2.);
          vec3 rgb = uColor * (.68 + plasma * .28 + facing * .1);
          float alpha = 1.;
          if (uHologram > .5) {
            vec4 projection = referenceHologramFields(vLocal, uTime, 68.);
            rgb = uColor * (.71 + plasma * .12 + rim * .12 + projection.y * .05);
            alpha = (.25 + projection.x * .24 + rim * .34 + projection.y * .18)
              * (.97 + projection.z * .03 - projection.w * .45);
          }
          gl_FragColor = vec4(rgb, alpha);
          #include <colorspace_fragment>
        }
      `
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), surface); sun.add(globe);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.ShaderMaterial({
      toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: color }, uTime: { value: 0 }, uHologram: { value: Number(config.hologram) } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uHologram;
        void main() {
          vec2 p = (vUv - .5) * 2.;
          float r = length(p);
          float glow = exp(-r * r * 5.) * (1. - smoothstep(.6, 1., r));
          float rays = pow(abs(sin(atan(p.y, p.x) * 12. + uTime * .07)), 16.);
          float corona = rays * exp(-pow((r - .46) * 6., 2.));
          float alpha = glow * mix(.26, .12, uHologram) + corona * mix(.13, .035, uHologram);
          gl_FragColor = vec4(uColor, alpha);
          #include <colorspace_fragment>
        }
      `
    }));
    sun.add(halo);
    const light = new THREE.PointLight(0xffffff, 8, 18, 2); sun.add(light);
    return { ...config, sun, color, surface, globe, halo, light };
  });

  function update(time, camera, spaceScale = 1) {
    for (const sun of suns) {
      const angle = time / sun.period * Math.PI * 2 * sun.direction + sun.phase;
      sun.sun.position.set((-2.5 + Math.sin(angle) * 9.2) * spaceScale, (sun.height + Math.cos(angle * 2) * .6) * Math.sqrt(spaceScale), (-3 + Math.cos(angle) * 2.8 * sun.direction) * spaceScale);
      sun.sun.scale.setScalar(sun.radius * Math.sqrt(spaceScale));
      const phase = (time + sun.colorOffset) / colorStep;
      const index = Math.floor(phase) % colors.length;
      const blend = (1 - Math.cos((phase % 1) * Math.PI)) / 2;
      const from = tones[index], to = tones[(index + 1) % tones.length];
      const hueDelta = ((to.h - from.h + 1.5) % 1) - .5;
      sun.color.setHSL(from.h + hueDelta * blend, THREE.MathUtils.lerp(from.s, to.s, blend), THREE.MathUtils.lerp(from.l, to.l, blend));
      sun.surface.uniforms.uTime.value = time;
      sun.halo.material.uniforms.uTime.value = time;
      sun.globe.rotation.y = time * .08;
      if (camera) sun.halo.quaternion.copy(camera.quaternion);
      sun.light.color.copy(sun.color);
    }
  }
  update(0);
  return { object, update };
}
