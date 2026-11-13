"use client";

import { useEffect, useRef, useState } from 'react';
import styles from './ReferenceArchive.module.css';

export default function ReferenceArchiveScene({ items, manifest, visibleIds, topic, selectedId, objectId, focusToken, onSelect, onObjectSelect, paused }) {
  const mount = useRef(null), api = useRef(null), latest = useRef({ onSelect, onObjectSelect, paused, selectedId, visibleIds, topic });
  latest.current = { onSelect, onObjectSelect, paused, selectedId, visibleIds, topic };
  const [status, setStatus] = useState('loading'), [assets, setAssets] = useState({ loaded: [], loading: [], failed: [] }), [material, setMaterial] = useState('hologram');
  useEffect(() => {
    let cancelled = false, instance;
    setStatus('loading');
    import('@/lib/createReferenceIsland').then(({ createReferenceIsland }) => {
      if (cancelled) return;
      return createReferenceIsland(mount.current, { items, manifest, getMotion: () => ({ paused: latest.current.paused }), onSelect: id => latest.current.onSelect(id), onObjectSelect: id => latest.current.onObjectSelect(id), onAssets: value => { if (!cancelled) setAssets(value); }, onFailure: () => { if (!cancelled) setStatus('unavailable'); } });
    }).then(value => { if (!value) return; instance = value; if (cancelled) return value.destroy(); api.current = value; value.select(latest.current.selectedId); value.filter(latest.current.visibleIds, latest.current.topic); setStatus('ready'); }).catch(() => { if (!cancelled) setStatus('unavailable'); });
    return () => { cancelled = true; api.current = null; instance?.destroy(); };
  }, [items, manifest]);
  useEffect(() => { api.current?.select(selectedId); }, [selectedId]);
  useEffect(() => { api.current?.filter(visibleIds, topic); }, [visibleIds, topic]);
  useEffect(() => { if (objectId && status === "ready") api.current?.focusObject(objectId); }, [objectId, focusToken, status]);
  return <div className={styles.scene} data-reference-scene={status} data-island-loaded={assets.loaded.join(',')} data-island-failed={assets.failed.join(',')}>
    <div ref={mount} className={styles.canvasMount} />
    {status !== 'ready' && <div className={styles.sceneMessage}>{status === 'loading' ? <><span className={styles.loader} />Reconstruindo a ilha…</> : <>A ilha 3D está indisponível neste navegador.<small>Todos os materiais continuam acessíveis na lista e nos fragmentos abaixo.</small></>}</div>}
    <div className={styles.islandHud}><span>ILHA / MEMÓRIA VOLÁTIL<br />{assets.loaded.length} / {manifest.models.length} OBJETOS MATERIALIZADOS</span>{assets.loading.length > 0 && <small>Materializando {manifest.models.find(model => model.id === assets.loading[0])?.label}…</small>}{assets.failed.length > 0 && <small role="status">{assets.failed.length} objeto(s) indisponível(is). Selecione para tentar novamente.</small>}</div>
    <div className={styles.islandTools}><button aria-label="Voltar à vista da ilha" onClick={() => api.current?.home()}>↺ Vista da ilha</button><button aria-pressed={material === 'original'} onClick={() => { const next = material === 'hologram' ? 'original' : 'hologram'; setMaterial(next); api.current?.material(next === 'hologram'); }}>{material === 'hologram' ? 'Ver materiais originais' : 'Ver como holograma'}</button></div>
  </div>;
}
