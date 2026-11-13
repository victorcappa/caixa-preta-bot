"use client";

import { useEffect, useRef, useState } from 'react';
import styles from './ReferenceArchive.module.css';

export default function ReferenceArchiveScene({ items, manifest, visibleIds, topic, selectedId, focusTarget, focusToken, onSelect, onObjectSelect, onTool, scope, cabinetPage, resetToken, originalMaterials, onMaterialChange, paused }) {
  const mount = useRef(null), api = useRef(null), latest = useRef({});
  latest.current = { onSelect, onObjectSelect, onTool, paused, selectedId, visibleIds, topic, scope, cabinetPage, originalMaterials };
  const [status, setStatus] = useState('loading'), [assets, setAssets] = useState({ loaded: [], loading: [], failed: [] }), [hover, setHover] = useState(null), [display, setDisplay] = useState({ ids: [], types: [] });
  const material = originalMaterials ? 'original' : 'hologram';
  useEffect(() => {
    let cancelled = false, instance;
    setStatus('loading');
    import('@/lib/createReferenceIsland').then(({ createReferenceIsland }) => {
      if (cancelled) return;
      return createReferenceIsland(mount.current, { items, manifest, getMotion: () => ({ paused: latest.current.paused }), onSelect: id => latest.current.onSelect(id), onObjectSelect: id => latest.current.onObjectSelect(id), onTool: id => latest.current.onTool(id), onHover: value => { if (!cancelled) setHover(value); }, onDisplay: value => { if (!cancelled) setDisplay(value); }, onAssets: value => { if (!cancelled) setAssets(value); }, onFailure: () => { if (!cancelled) setStatus('unavailable'); } });
    }).then(value => { if (!value) return; instance = value; if (cancelled) return value.destroy(); api.current = value; value.select(latest.current.selectedId); value.filter(latest.current.visibleIds, latest.current.topic, latest.current.scope, latest.current.cabinetPage); value.material(!latest.current.originalMaterials); setStatus('ready'); }).catch(() => { if (!cancelled) setStatus('unavailable'); });
    return () => { cancelled = true; api.current = null; instance?.destroy(); };
  }, [items, manifest]);
  useEffect(() => { api.current?.select(selectedId); }, [selectedId]);
  useEffect(() => { api.current?.filter(visibleIds, topic, scope, cabinetPage); }, [visibleIds, topic, scope, cabinetPage]);
  useEffect(() => {
    if (!focusTarget || status !== "ready") return;
    if (focusTarget.kind === 'model') api.current?.focusObject(focusTarget.id);
    else if (focusTarget.kind === 'tool') api.current?.focusTool(focusTarget.id);
    else api.current?.focusReference(focusTarget.id);
  }, [focusTarget, focusToken, status]);
  useEffect(() => { if (status === "ready") api.current?.material(!originalMaterials); }, [originalMaterials, status]);
  useEffect(() => { if (resetToken) api.current?.home(); }, [resetToken]);
  return <div className={styles.scene} data-reference-scene={status} data-island-loaded={assets.loaded.join(',')} data-island-failed={assets.failed.join(',')} data-cabinet-visible={display.ids.join(',')} data-cabinet-types={display.types.join(',')}>
    <div ref={mount} className={styles.canvasMount} />
    {status !== 'ready' && <div className={styles.sceneMessage}>{status === 'loading' ? <><span className={styles.loader} />Reconstruindo a ilha…</> : <>A ilha 3D está indisponível neste navegador.<small>Todos os materiais continuam acessíveis na lista e nos fragmentos abaixo.</small></>}</div>}
    <div className={styles.islandHud}><span>AS COISAS / USO FORA DO USO<br />{display.ids.length} COISAS ABERTAS · {assets.loaded.length} / {manifest.models.length} OBJETOS MATERIALIZADOS</span>{assets.loading.length > 0 && <small>Materializando {manifest.models.find(model => model.id === assets.loading[0])?.label}…</small>}{assets.failed.length > 0 && <small role="status">{assets.failed.length} objeto(s) indisponível(is). Selecione para tentar novamente.</small>}</div>
    {hover && <aside className={styles.thingHover} aria-live="polite"><strong>{hover.title}</strong><p>{hover.use}</p></aside>}
    <div className={styles.islandTools}><button aria-label="Voltar à vista da ilha" onClick={() => api.current?.home()}>↺ Vista da ilha</button><button aria-pressed={material === 'original'} onClick={onMaterialChange}>{material === 'hologram' ? 'Ver materiais originais' : 'Ver como holograma'}</button></div>
  </div>;
}
