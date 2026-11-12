"use client";
import { useEffect, useRef } from "react";
import { decodePointCloud } from "@/lib/post-demo/pointCloudFormat";
import { pointCloudVertexShader, pointCloudFragmentShader } from "@/lib/post-demo/pointCloudAnimation";
import { normalizePointCloudSettings } from "@/lib/post-demo/pointCloudSettings";
import { samplePointCloudMotion } from "@/lib/post-demo/pointCloudMotion";
import styles from "./PostDemo.module.css";

export default function PostDemoPointCloud({ reference, view, onError }) {
  const host = useRef(null), reportError = useRef(onError), live = useRef(null);
  reportError.current = onError;
  live.current = { settings: normalizePointCloudSettings(view?.settings), playback: view?.playback };
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
        const largestSide = Math.max(size.x, size.y, size.z, .000001), initial = live.current.settings;
        const life = new Float32Array(cloud.count * 4), minimum = geometry.boundingBox.min;
        for (let index = 0; index < cloud.count; index++) {
          const offset = index * 3, x = (cloud.positions[offset] - minimum.x) / Math.max(size.x, .000001);
          const y = (cloud.positions[offset + 1] - minimum.y) / Math.max(size.y, .000001);
          const z = (cloud.positions[offset + 2] - minimum.z) / Math.max(size.z, .000001);
          seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
          const random = (seed >>> 0) / 4294967296;
          const luminance = (cloud.colors[offset] * .2126 + cloud.colors[offset + 1] * .7152 + cloud.colors[offset + 2] * .0722) / 255;
          life.set([x * 18 + y * 13 + z * 9 + random * .6, y * .8 + (1 - z) * .2, random, .45 + .55 * (1 - luminance)], index * 4);
        }
        geometry.setAttribute("aLife", new THREE.BufferAttribute(life, 4));
        geometry.computeBoundingSphere(); geometry.boundingSphere.radius += largestSide * .008;
        material = new THREE.ShaderMaterial({ vertexColors: true, uniforms: {
          pointSize: { value: 1.2 }, fitDistance: { value: 2 }, uTime: { value: 0 },
          uPulsePhaseOffset: { value: 0 }, uMotionPhaseOffset: { value: 0 },
          uPulsePeriod: { value: initial.pulsePeriodSeconds }, uPulseIntensity: { value: initial.pulseIntensity },
          uPulseSize: { value: initial.pulseSize }, uHighlightIntensity: { value: initial.highlightIntensity },
          uLocalAmplitude: { value: largestSide * initial.localAmplitude }, uMotionSpeed: { value: initial.motionSpeed },
          uRowPhaseSpread: { value: initial.rowPhaseSpread }, uBrightness: { value: initial.brightness }, uRevealOpacity: { value: 0 }
        }, vertexShader: pointCloudVertexShader, fragmentShader: pointCloudFragmentShader });
        const points = new THREE.Points(geometry, material); scene.add(points);
        controls = new orbit.OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = .1;
        controls.minDistance = .055; controls.maxDistance = 30; controls.rotateSpeed = .45; controls.panSpeed = .65; controls.zoomSpeed = .7;
        controls.screenSpacePanning = true; controls.listenToKeyEvents(canvas);
        let fitDistance = 2, basePointSize = 1.2, interacting = false, introCancelled = false, lastManual = -Infinity;
        const resize = () => {
          const rect = element.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height);
          renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
          fitDistance = Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan(Math.PI / 8)) * 1.15 + size.z * .45;
          basePointSize = Math.max(.9, Math.min(2.1, height / 500)) * renderer.getPixelRatio();
        };
        resize(); observer = new ResizeObserver(resize); observer.observe(element);
        camera.position.set(0, 0, fitDistance * initial.endDistance);
        controls.update();
        const start = performance.now(), startedWall = performance.timeOrigin + start;
        let previous = start, frames = 0, lastMetrics = 0, playbackToken = null, firstPose = true, manualAnchor = null;
        let wasMotionEnabled = initial.motionEnabled, opacity = 0, visibleFraction = 0, introShift = null;
        controls.addEventListener("start", () => { interacting = true; introCancelled = true; lastManual = performance.now(); canvas.focus({ preventScroll: true }); });
        controls.addEventListener("end", () => { interacting = false; lastManual = performance.now(); });
        const desiredCamera = new THREE.Vector3(), desiredTarget = new THREE.Vector3(), manualDirection = new THREE.Vector3(), manualParallax = new THREE.Vector3();
        const dampUniform = (name, value, alpha) => {
          const difference = value - material.uniforms[name].value;
          material.uniforms[name].value = Math.abs(difference) < 1e-7 ? value : material.uniforms[name].value + difference * alpha;
        };
        const draw = now => {
          if (disposed) return;
          const elapsed = (now - start) / 1000, dt = Math.min(.05, (now - previous) / 1000); previous = now;
          material.uniforms.uTime.value = elapsed;
          const { settings, playback } = live.current, wallNow = performance.timeOrigin + now;
          const token = playback?.token || reference.id;
          if (token !== playbackToken) {
            playbackToken = token; introCancelled = interacting; introShift = null; lastManual = interacting ? now : -Infinity; manualAnchor = null;
            canvas.dataset.ready = "false"; delete canvas.dataset.firstFrameAt;
            if (settings.preset === "reveal-tour") { opacity = 0; visibleFraction = 0; }
          }
          const epoch = Date.parse(playback?.startedAt), motionTime = Math.max(0, (wallNow - (Number.isFinite(epoch) ? epoch : startedWall)) / 1000);
          if (introCancelled && settings.preset === "reveal-tour" && introShift === null) {
            introShift = Math.max(0, settings.startDarkSeconds + settings.revealSeconds - motionTime);
          }
          const pose = samplePointCloudMotion(settings, motionTime + (introShift || 0));
          const quiet = (now - lastManual) / 1000, manual = interacting || quiet < settings.resumeDelaySeconds;
          const alpha = 1 - Math.exp(-dt * 4), enabled = settings.shaderEnabled ? 1 : 0;
          material.uniforms.uPulsePhaseOffset.value += elapsed * Math.PI * 2 * (1 / material.uniforms.uPulsePeriod.value - 1 / settings.pulsePeriodSeconds);
          material.uniforms.uMotionPhaseOffset.value += elapsed * (material.uniforms.uMotionSpeed.value - settings.motionSpeed);
          material.uniforms.uPulsePeriod.value = settings.pulsePeriodSeconds;
          material.uniforms.uMotionSpeed.value = settings.motionSpeed;
          controls.minDistance = Math.min(.055, fitDistance * Math.min(settings.startDistance, settings.endDistance) * .5);
          dampUniform("fitDistance", fitDistance * settings.endDistance, alpha);
          dampUniform("pointSize", basePointSize * settings.pointSize, alpha);
          dampUniform("uPulseIntensity", settings.pulseIntensity * enabled, alpha);
          dampUniform("uPulseSize", settings.pulseSize * enabled, alpha);
          dampUniform("uHighlightIntensity", settings.highlightIntensity * enabled, alpha);
          dampUniform("uLocalAmplitude", largestSide * settings.localAmplitude * enabled, alpha);
          dampUniform("uRowPhaseSpread", settings.rowPhaseSpread, alpha);
          dampUniform("uBrightness", settings.brightness, alpha);

          desiredCamera.set(pose.camera[0] * largestSide, pose.camera[1] * largestSide, pose.camera[2] * fitDistance);
          desiredTarget.set(...pose.target).multiplyScalar(largestSide);
          let desiredYaw = pose.yaw;
          if (!settings.motionEnabled || wasMotionEnabled !== settings.motionEnabled) introCancelled = true;
          if (manualAnchor) {
            const anchorDistance = manualAnchor.camera.distanceTo(manualAnchor.target);
            manualDirection.copy(manualAnchor.camera).sub(manualAnchor.target).normalize();
            const distance = Math.max(controls.minDistance, Math.min(controls.maxDistance,
              anchorDistance * pose.camera[2] / Math.max(.000001, manualAnchor.pose.camera[2])));
            desiredTarget.copy(manualAnchor.target).add(new THREE.Vector3(...pose.target).sub(new THREE.Vector3(...manualAnchor.pose.target)).multiplyScalar(largestSide));
            desiredCamera.copy(desiredTarget).addScaledVector(manualDirection, distance);
            // Keep the automatic parallax perpendicular to the operator's viewing direction.
            // A close manual zoom must never let the next automatic approach cross its target.
            manualParallax.set(pose.camera[0] - manualAnchor.pose.camera[0] - pose.target[0] + manualAnchor.pose.target[0],
              pose.camera[1] - manualAnchor.pose.camera[1] - pose.target[1] + manualAnchor.pose.target[1], 0).multiplyScalar(largestSide);
            manualParallax.addScaledVector(manualDirection, -manualParallax.dot(manualDirection)).clampLength(0, distance * .35);
            desiredCamera.add(manualParallax);
            desiredYaw = manualAnchor.yaw + pose.yaw - manualAnchor.pose.yaw;
          }
          if (firstPose) {
            camera.position.copy(desiredCamera); controls.target.copy(desiredTarget); points.rotation.y = desiredYaw;
            opacity = pose.opacity; visibleFraction = pose.reveal; firstPose = false;
          } else if (!manual && settings.motionEnabled && settings.preset !== "still") {
            const resumeBlend = Number.isFinite(lastManual) ? Math.max(0, Math.min(1, (quiet - settings.resumeDelaySeconds) / 2)) : 1;
            camera.position.lerp(desiredCamera, alpha * resumeBlend); controls.target.lerp(desiredTarget, alpha * resumeBlend);
            const yawDelta = Math.atan2(Math.sin(desiredYaw - points.rotation.y), Math.cos(desiredYaw - points.rotation.y));
            points.rotation.y += yawDelta * alpha * resumeBlend;
          }
          controls.update();
          if (manual || !settings.motionEnabled || wasMotionEnabled !== settings.motionEnabled) {
            manualAnchor = { camera: camera.position.clone(), target: controls.target.clone(), yaw: points.rotation.y, pose };
          }
          wasMotionEnabled = settings.motionEnabled;
          const show = introCancelled || !settings.motionEnabled;
          opacity += ((show ? 1 : pose.opacity) - opacity) * alpha;
          visibleFraction += ((show ? 1 : pose.reveal) - visibleFraction) * alpha;
          material.uniforms.uRevealOpacity.value = opacity;
          geometry.setDrawRange(0, Math.max(0, Math.min(cloud.count, Math.floor(cloud.count * visibleFraction))));
          renderer.render(scene, camera); frames++;
          if (canvas.dataset.ready !== "true" && opacity > .01 && geometry.drawRange.count > 0) { canvas.dataset.firstFrameAt = String(performance.timeOrigin + performance.now()); canvas.dataset.ready = "true"; }
          if (now - lastMetrics > 180 || frames === 1) {
            lastMetrics = now; canvas.dataset.frames = String(frames); canvas.dataset.yaw = points.rotation.y.toFixed(4);
            canvas.dataset.distance = camera.position.distanceTo(controls.target).toFixed(4); canvas.dataset.pan = controls.target.toArray().map(value => value.toFixed(3)).join(",");
            canvas.dataset.distanceRatio = (camera.position.distanceTo(controls.target) / fitDistance).toFixed(5); canvas.dataset.fitDistance = fitDistance.toFixed(5);
            canvas.dataset.camera = camera.position.toArray().map(value => value.toFixed(3)).join(",");
            canvas.dataset.phase = manual ? "manual" : show || pose.phase === "still" ? "automatic" : pose.phase;
            canvas.dataset.preset = settings.preset; canvas.dataset.playbackToken = playbackToken;
            canvas.dataset.revealOpacity = opacity.toFixed(4); canvas.dataset.motionElapsed = motionTime.toFixed(3);
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
