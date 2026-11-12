"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ReferenceArchive.module.css";

const INK = "#d6e4d0";
function plateTexture(THREE, item, large = false) {
  const canvas = document.createElement("canvas");
  const w = large ? 768 : 384, h = large ? 1024 : 512, scale = large ? 1 : .5;
  canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext("2d"); ctx.scale(scale, scale);
  ctx.fillStyle = "#0d1711"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#6d956d"; ctx.lineWidth = 2; ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.fillStyle = "#afc99e"; ctx.font = `${large ? 20 : 14}px monospace`;
  ctx.fillText("CAIXA PRETA / ACERVO", 48, 74);
  ctx.fillStyle = item.status === "cited" ? "#9aab96" : "#baf78b";
  ctx.fillRect(48, 116, 45, 6);
  ctx.fillStyle = INK; ctx.font = `${large ? 57 : 28}px Georgia`;
  const maxWidth = w - 96, lineHeight = large ? 68 : 35;
  let line = "", y = h * .30, lines = 0;
  for (const word of item.title.split(/\s+/)) {
    if (ctx.measureText(`${line} ${word}`).width > maxWidth && line) {
      ctx.fillText(line, 48, y); y += lineHeight; lines++; line = word;
      if (lines >= 6) { line = "…"; break; }
    } else line = `${line} ${word}`.trim();
  }
  ctx.fillText(line, 48, y);
  ctx.font = `${large ? 22 : 14}px monospace`; ctx.fillStyle = "#a1b59a";
  const author = (item.author || item.kind || "ARQUIVO LOCAL").slice(0, large ? 42 : 29);
  ctx.fillText(author, 48, h - 136);
  ctx.fillText(item.year ? `${item.year} / ${item.pageCount || ""}${item.pageCount ? " PÁGINAS" : ""}` : item.id.slice(0, 28), 48, h - 96);
  ctx.fillStyle = "#baf78b"; ctx.fillRect(48, h - 64, w - 96, 1);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  if (!large) { texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter; }
  return texture;
}

export default function ReferenceArchiveScene({ items, selectedId, onSelect, paused }) {
  const mount = useRef(null), api = useRef(null), latest = useRef({ selectedId, onSelect, paused });
  latest.current = { selectedId, onSelect, paused };
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    let cancelled = false, teardown;
    setStatus("loading");
    import("three").then(THREE => {
      if (cancelled || !mount.current) return;
      const host = mount.current;
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
      catch { setStatus("unavailable"); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x050907, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-label", "Arquivo tridimensional das referências");
      renderer.domElement.setAttribute("role", "img");
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x050907, .032);
      const camera = new THREE.PerspectiveCamera(39, 1, .1, 100);
      camera.position.set(0, 5.3, 12.8); camera.lookAt(0, .6, 0);
      scene.add(new THREE.AmbientLight(0xe0f5db, 2));
      const key = new THREE.DirectionalLight(0xd6f4d0, 4); key.position.set(4, 7, 5); scene.add(key);
      const red = new THREE.PointLight(0xe39b4b, 18, 12); red.position.set(-4, 1, 2); scene.add(red);
      const world = new THREE.Group(); scene.add(world);
      const grid = new THREE.GridHelper(24, 40, 0x315335, 0x14271b); grid.position.y = -1.55; scene.add(grid);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.8, .18, 2.9), new THREE.MeshStandardMaterial({ color: 0x17231b, metalness: .75, roughness: .35 }));
      plinth.position.set(0, -1.3, 0); world.add(plinth);
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(4.05, 4.1, 3.2)), new THREE.LineBasicMaterial({ color: 0x649264, transparent: true, opacity: .36 }));
      frame.position.y = .72; world.add(frame);
      const hero = new THREE.Group(); hero.position.set(0, .8, .6); hero.rotation.set(-.09, -.25, -.08); world.add(hero);
      const paper = new THREE.Mesh(new THREE.BoxGeometry(1.92, 2.68, .23), new THREE.MeshStandardMaterial({ color: 0xc6cbb6, roughness: .9 })); hero.add(paper);
      const coverMaterial = new THREE.MeshStandardMaterial({ roughness: .62, metalness: .1 });
      const cover = new THREE.Mesh(new THREE.BoxGeometry(2.04, 2.8, .065), [coverMaterial, coverMaterial, coverMaterial, coverMaterial, coverMaterial, coverMaterial]); cover.position.z = .16; hero.add(cover);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.04, 2.8, .065), new THREE.MeshStandardMaterial({ color: 0x13271a })); back.position.z = -.16; hero.add(back);
      const spine = new THREE.Mesh(new THREE.BoxGeometry(.1, 2.8, .34), new THREE.MeshStandardMaterial({ color: 0x43603b })); spine.position.x = -.98; hero.add(spine);
      const ring = new THREE.Group(); world.add(ring);
      const targets = [], materials = [];
      items.forEach((item, index) => {
        const angle = (index / items.length) * Math.PI * 2;
        const radius = 4.2 + (index % 3) * .42;
        const material = new THREE.MeshStandardMaterial({ map: plateTexture(THREE, item), color: 0xaab9a4, side: THREE.DoubleSide, roughness: .75 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(.65, .9, .035), material);
        mesh.position.set(Math.sin(angle) * radius, -.55 + (index % 5) * .37, Math.cos(angle) * radius - 1.1);
        mesh.lookAt(0, .5, -1.1); mesh.rotateY(Math.PI); mesh.rotation.z = (index % 3 - 1) * .09;
        mesh.userData.id = item.id; mesh.userData.baseY = mesh.position.y;
        ring.add(mesh); targets.push(mesh); materials.push(material);
        const points = [new THREE.Vector3(mesh.position.x, -1.23, mesh.position.z), new THREE.Vector3(mesh.position.x, mesh.position.y - .5, mesh.position.z)];
        world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x38593a, transparent: true, opacity: .3 })));
      });
      for (const radius of [3.7, 5.4]) {
        const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2);
        const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(curve.getPoints(120)), new THREE.LineBasicMaterial({ color: 0x385b3d, transparent: true, opacity: .5 }));
        line.rotation.x = -Math.PI / 2; line.position.set(0, -1.24, -1.1); world.add(line);
      }
      const dustPositions = new Float32Array(210 * 3);
      for (let i = 0; i < dustPositions.length; i++) dustPositions[i] = Math.sin(i * 71.83) * (i % 3 === 1 ? 4 : 8);
      const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
      const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xc8dfb6, size: .018, transparent: true, opacity: .55 })); scene.add(dust);
      const resize = () => { const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.position.z = width / height < 1 ? 17 : 12.8; camera.updateProjectionMatrix(); };
      const observer = new ResizeObserver(resize); observer.observe(host); resize();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      let down = null, drag = 0, rotation = 0, raf, visible = true, lastTime = 0;
      const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }); visibility.observe(host);
      const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
      const pick = event => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObjects(targets)[0]?.object;
      };
      const pointerDown = event => { down = event.clientX; drag = 0; renderer.domElement.setPointerCapture(event.pointerId); };
      const pointerMove = event => {
        if (down !== null) { const delta = event.clientX - down; drag += Math.abs(delta); rotation += delta * .006; down = event.clientX; }
        else renderer.domElement.style.cursor = pick(event) ? "pointer" : "grab";
      };
      const pointerUp = event => { if (down !== null && drag < 5) { const target = pick(event); if (target) latest.current.onSelect(target.userData.id); } down = null; };
      const pointerCancel = () => { down = null; };
      const contextLost = event => { event.preventDefault(); setStatus("unavailable"); };
      const canvas = renderer.domElement;
      canvas.addEventListener("pointerdown", pointerDown); canvas.addEventListener("pointermove", pointerMove); canvas.addEventListener("pointerup", pointerUp); canvas.addEventListener("pointercancel", pointerCancel); canvas.addEventListener("webglcontextlost", contextLost);
      let heroTexture, heroTextureId;
      api.current = { select(id) {
        const item = items.find(value => value.id === id) || items[0];
        if (heroTextureId !== item.id) {
          heroTexture?.dispose(); heroTexture = plateTexture(THREE, item, true); heroTextureId = item.id;
          coverMaterial.map = heroTexture; coverMaterial.needsUpdate = true;
        }
        targets.forEach((mesh, index) => { const active = mesh.userData.id === id; materials[index].color.set(active ? 0xffffff : 0x8a9f83); materials[index].emissive.set(active ? 0x244f17 : 0x000000); mesh.scale.setScalar(active ? 1.28 : 1); });
      } };
      api.current.select(latest.current.selectedId);
      const animate = time => {
        raf = requestAnimationFrame(animate);
        if (!visible || document.hidden) { lastTime = time; return; }
        const delta = Math.min((time - lastTime) / 1000, .05); lastTime = time;
        if (!reduced.matches && !latest.current.paused && down === null) rotation += delta * .035;
        world.rotation.y = rotation;
        hero.position.y = .8 + ((!reduced.matches && !latest.current.paused) ? Math.sin(time * .0006) * .09 : 0);
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(animate); setStatus("ready");
      teardown = () => {
        cancelAnimationFrame(raf); observer.disconnect(); visibility.disconnect(); api.current = null;
        canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointermove", pointerMove); canvas.removeEventListener("pointerup", pointerUp); canvas.removeEventListener("pointercancel", pointerCancel); canvas.removeEventListener("webglcontextlost", contextLost);
        const disposed = new Set(); scene.traverse(object => { object.geometry?.dispose(); const values = Array.isArray(object.material) ? object.material : [object.material]; values.filter(Boolean).forEach(material => { if (!disposed.has(material)) { material.map?.dispose(); material.dispose(); disposed.add(material); } }); });
        renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
      };
    }).catch(() => { if (!cancelled) setStatus("unavailable"); });
    return () => { cancelled = true; teardown?.(); };
  }, [items]);
  useEffect(() => { api.current?.select(selectedId); }, [selectedId]);

  return <div className={styles.scene} data-reference-scene={status}>
    <div ref={mount} className={styles.canvasMount} />
    {status !== "ready" && <div className={styles.sceneMessage}>{status === "loading" ? <><span className={styles.loader} />Abrindo a memória…</> : <>O arquivo 3D está indisponível neste navegador.<small>Todos os materiais continuam acessíveis na lista e nos fragmentos abaixo.</small></>}</div>}
    <span className={styles.sceneCoordinate}>MEM / {String(items.length).padStart(3, "0")}<br />X 00.00 / Y 00.00</span>
  </div>;
}
