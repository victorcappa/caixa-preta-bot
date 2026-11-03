"use client";

import { useEffect, useRef, useState } from 'react';
import { subscribePublicRealtime } from '@/lib/publicRealtime';
import { PUBLIC_MODULES, normalizePublicComposition, patchPublicComposition, publicModuleStyle } from '@/lib/publicComposition';
import styles from './PublicComposition.module.css';

export default function PublicCompositionControls() {
  const [composition, setComposition] = useState(() => normalizePublicComposition());
  const [selected, setSelected] = useState('main-status');
  const [status, setStatus] = useState('');
  const queued = useRef(null), running = useRef(false), timer = useRef(null), drag = useRef(null);
  const local = useRef(composition);
  useEffect(() => {
    const unsubscribe = subscribePublicRealtime(({ state }) => {
      if (state.operatorPublic && !queued.current && !running.current && !drag.current) {
        local.current = normalizePublicComposition(state.operatorPublic.composition);
        setComposition(local.current);
      }
    });
    return () => { unsubscribe(); clearTimeout(timer.current); };
  }, []);

  async function flush() {
    if (running.current || !queued.current) return;
    const patch = queued.current;
    queued.current = null;
    running.current = true;
    try {
      const response = await fetch('/api/operator-public', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'patch', composition: patch }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('sync');
      setStatus('Composição sincronizada.');
    } catch { setStatus('Alteração não confirmada. Verifique a conexão e tente novamente.'); }
    finally { running.current = false; if (queued.current) void flush(); }
  }
  function patch(value) {
    local.current = patchPublicComposition(local.current, value);
    setComposition(local.current);
    setStatus('Sincronizando…');
    queued.current = { ...queued.current, ...value, modules: { ...queued.current?.modules, ...value.modules } };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 80);
  }
  const definition = PUBLIC_MODULES[selected];
  const rect = composition.modules[selected] || definition;
  function updateRect(value) { patch({ modules: { [selected]: { ...rect, ...value } } }); }
  function startDrag(event, resize = false) {
    event.preventDefault(); event.stopPropagation();
    const bounds = event.currentTarget.closest('[data-composition-preview]').getBoundingClientRect();
    drag.current = { id: selected, startX: event.clientX, startY: event.clientY, bounds, rect: { ...rect }, resize };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event) {
    const d = drag.current;
    if (!d) return;
    const dx = (event.clientX - d.startX) / d.bounds.width * 100, dy = (event.clientY - d.startY) / d.bounds.height * 100;
    patch({ modules: { [d.id]: { ...d.rect, ...(d.resize ? { width: d.rect.width + dx, height: d.rect.height + dy } : { x: d.rect.x + dx, y: d.rect.y + dy }) } } });
  }
  function endDrag() { drag.current = null; void flush(); }
  return <details className={styles.editor}>
    <summary>COMPOSIÇÃO DA TELA PÚBLICA</summary>
    <p>Selecione um componente e arraste o retângulo; use o canto inferior para redimensionar. X, Y, largura e altura são percentuais da área pública correspondente. Os controles privados permanecem no lugar.</p>
    <div className={styles.fields}>
      <label>Cor dos textos do Operator público<input aria-label="Cor do texto público" type="color" value={composition.textColor} onChange={event => patch({ textColor: event.target.value })} /></label>
      <button type="button" onClick={() => patch({ textColor: '#ffffff' })}>BRANCO</button>
      <button type="button" onClick={() => patch({ textColor: '#00ff66' })}>VERDE</button>
    </div>
    <div className={styles.fields}>
      <label>Componente<select aria-label="Componente" value={selected} onChange={event => setSelected(event.target.value)}>{Object.entries(PUBLIC_MODULES).map(([id, value]) => <option key={id} value={id}>{value.surface === 'tarot' ? 'Tarot' : value.surface === 'operator' ? 'Dentro do Operator público' : value.surface === 'screen' ? 'Tela' : 'Principal'} · {value.label}</option>)}</select></label>
      {[['x', 'X'], ['y', 'Y'], ['width', 'Largura'], ['height', 'Altura']].map(([key, label]) => <label key={key}>{label} (%)<input aria-label={`${label} do componente`} type="number" min={key === 'x' || key === 'y' ? 0 : 10} max="100" step="0.5" value={Math.round(rect[key] * 10) / 10} onChange={event => { if (event.target.value !== '') updateRect({ [key]: Number(event.target.value) }); }} /></label>)}
      <button type="button" onClick={() => patch({ modules: { [selected]: null } })}>RESTAURAR COMPONENTE</button>
    </div>
    <div className={styles.canvas} data-composition-preview aria-label="Prévia esquemática da composição pública">
      {Object.entries(PUBLIC_MODULES).filter(([, value]) => value.surface === definition.surface).map(([id, value]) => <div key={id} className={styles.box} data-selected={selected === id} style={publicModuleStyle(composition.modules[id] || value)}
        onPointerDown={event => startDrag(event)} onPointerMove={move} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
        {value.label}{selected === id ? <button type="button" aria-label="Redimensionar componente na prévia" onPointerDown={event => startDrag(event, true)}>↘</button> : null}
      </div>)}
    </div>
    <p>Sem ajuste personalizado, cada módulo segue o layout padrão da cena. A prévia é esquemática; confira o resultado na janela de projeção. As escolhas são salvas nas preferências do operador.</p>
    <p role="status">{status}</p>
  </details>;
}
