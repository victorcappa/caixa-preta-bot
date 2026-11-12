"use client";
import { useEffect, useRef } from "react";
import { decodePointCloud } from "@/lib/post-demo/pointCloudFormat";
import styles from "./PostDemo.module.css";

export default function PostDemoPointCloud({ reference, onError }) {
  const host = useRef(null), reportError = useRef(onError);
  reportError.current = onError;
  useEffect(() => {
    const abort = new AbortController(), element = host.current;
    let disposed = false, renderer, geometry, material, controls, observer, frame;
    const cleanup = () => { cancelAnimationFrame(frame); observer?.disconnect(); controls?.dispose(); geometry?.dispose(); material?.dispose(); renderer?.dispose(); renderer?.domElement.remove(); };
    (async () => {
      try {
        const [bytes, THREE, orbit] = await Promise.all([
          fetch(reference.url, { cache: "no-store", signal: abort.signal }).then(response => { if (!response.ok) throw Error(); return response.arrayBuffer(); }),
          import("three"), import("three/examples/jsm/controls/OrbitControls.js")
        ]);
        if (disposed) return;
        const cloud = decodePointCloud(bytes);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0);
        const canvas = renderer.domElement;
        canvas.tabIndex = 0; canvas.setAttribute("aria-label", "Nuvem de pontos 3D da plateia");
        canvas.dataset.pointCount = String(cloud.count); element.appendChild(canvas);
        const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1, .01, 60);
        // Do the fixed color correction once, rather than three pow() calls per point per frame.
        const gamma = Uint8Array.from({ length: 256 }, (_, value) => Math.round(Math.pow(value / 255, .72) * 255));
        for (let index = 0; index < cloud.colors.length; index++) cloud.colors[index] = gamma[cloud.colors[index]];
        // Randomized draw order reveals sparse points without drawing/discarding the entire cloud.
        // Keep attributes contiguous so full-density frames retain sequential memory access.
        let seed = 0x6d2b79f5;
        for (let index = cloud.count - 1; index > 0; index--) {
          seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
          const other = (seed >>> 0) % (index + 1);
          for (let axis = 0; axis < 3; axis++) {
            const a = index * 3 + axis, b = other * 3 + axis, position = cloud.positions[a], color = cloud.colors[a];
            cloud.positions[a] = cloud.positions[b]; cloud.positions[b] = position; cloud.colors[a] = cloud.colors[b]; cloud.colors[b] = color;
          }
        }
        geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(cloud.positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(cloud.colors, 3, true)); geometry.computeBoundingBox();
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        material = new THREE.ShaderMaterial({ vertexColors: true, uniforms: { pointSize: { value: 1.2 }, fitDistance: { value: 2 } },
          vertexShader: `varying vec3 rgb; uniform float pointSize; uniform float fitDistance;
            void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;
            gl_PointSize=clamp(pointSize*fitDistance/max(-p.z,0.02),1.0,6.0);rgb=color;}`,
          fragmentShader: `varying vec3 rgb; void main(){vec2 delta=gl_PointCoord-vec2(0.5);float r=dot(delta,delta);if(r>0.25)discard;
            gl_FragColor=vec4(rgb*(1.0-0.55*smoothstep(0.09,0.26,r)),1.0);}` });
        const points = new THREE.Points(geometry, material); scene.add(points);
        controls = new orbit.OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = .1;
        controls.minDistance = .055; controls.maxDistance = 30; controls.rotateSpeed = .45; controls.panSpeed = .65; controls.zoomSpeed = .7;
        controls.screenSpacePanning = true; controls.listenToKeyEvents(canvas);
        let fitDistance = 2, interacting = false, introCancelled = false, lastManual = -Infinity, baseDistance = 2;
        const resize = () => {
          const rect = element.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height);
          renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
          fitDistance = Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan(Math.PI / 8)) * 1.15 + size.z * .45;
          material.uniforms.fitDistance.value = fitDistance;
          material.uniforms.pointSize.value = Math.max(.9, Math.min(2.1, height / 500)) * renderer.getPixelRatio();
        };
        resize(); observer = new ResizeObserver(resize); observer.observe(element);
        camera.position.set(0, 0, Math.max(.075, fitDistance * .07)); baseDistance = fitDistance;
        controls.update();
        const start = performance.now(); let previous = start, frames = 0, lastMetrics = 0;
        controls.addEventListener("start", () => { interacting = true; introCancelled = true; lastManual = performance.now(); canvas.focus({ preventScroll: true }); });
        controls.addEventListener("end", () => { interacting = false; lastManual = performance.now(); });
        const direction = new THREE.Vector3();
        const draw = now => {
          if (disposed) return;
          const elapsed = (now - start) / 1000, dt = Math.min(.05, (now - previous) / 1000); previous = now;
          const quiet = (now - lastManual) / 1000, blend = interacting ? 0 : Math.max(0, Math.min(1, (quiet - 1.8) / 2));
          if (!introCancelled && elapsed < 12) {
            const phase = elapsed / 12, ease = phase * phase * (3 - 2 * phase);
            camera.position.set(0, 0, fitDistance * (.07 + .93 * ease));
            geometry.setDrawRange(0, Math.max(1, Math.floor(cloud.count * (.002 + .998 * ease))));
          } else if (!interacting && quiet > 1.8) {
            const distance = (introCancelled ? baseDistance : fitDistance) * (1 + .03 * Math.sin(elapsed / 9));
            direction.copy(camera.position).sub(controls.target).normalize();
            const current = camera.position.distanceTo(controls.target), target = current + (distance - current) * (1 - Math.exp(-dt * blend));
            camera.position.copy(controls.target).addScaledVector(direction, target);
          }
          if (introCancelled || elapsed >= 12) geometry.setDrawRange(0, cloud.count);
          if (blend > 0) { points.rotation.y += (Math.sin(elapsed / 7) * .14 - points.rotation.y) * (1 - Math.exp(-dt * blend * 2)); }
          controls.update();
          if (introCancelled && (interacting || quiet < 1.8)) baseDistance = camera.position.distanceTo(controls.target);
          renderer.render(scene, camera); frames++;
          if (frames === 1) { canvas.dataset.firstFrameAt = String(performance.timeOrigin + performance.now()); canvas.dataset.ready = "true"; }
          if (now - lastMetrics > 180 || frames === 1) {
            lastMetrics = now; canvas.dataset.frames = String(frames); canvas.dataset.yaw = points.rotation.y.toFixed(4);
            canvas.dataset.distance = camera.position.distanceTo(controls.target).toFixed(4); canvas.dataset.pan = controls.target.toArray().map(value => value.toFixed(3)).join(",");
            canvas.dataset.camera = camera.position.toArray().map(value => value.toFixed(3)).join(","); canvas.dataset.phase = !introCancelled && elapsed < 12 ? "reveal" : interacting || quiet < 1.8 ? "manual" : "automatic";
          }
          frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
      } catch {
        if (!disposed && !abort.signal.aborted) { cleanup(); reportError.current?.("Não foi possível abrir a nuvem 3D neste navegador."); }
      }
    })();
    return () => { disposed = true; abort.abort(); cleanup(); };
  }, [reference.id, reference.url]);
  return <div ref={host} className={styles.pointCloud} aria-label="Ilha em nuvem de pontos" />;
}
