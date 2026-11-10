"use client";

import { useEffect, useRef, useState } from 'react';
import { subscribePublicRealtime } from '@/lib/publicRealtime';
import { PUBLIC_MODULES, PUBLIC_READABILITY_DEFAULTS, normalizePublicComposition, patchPublicComposition, publicModuleStyle } from '@/lib/publicComposition';
import styles from './PublicComposition.module.css';

export default function PublicCompositionControls({ initiallyOpen = false }) {
  const [composition, setComposition] = useState(() => normalizePublicComposition());
  const [selected, setSelected] = useState('main-status');
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
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
      const result = await response.json();
      if (!result.operatorPublic?.composition) throw new Error('ack');
      setFailed(false);
      setStatus('Composição sincronizada.');
    } catch {
      queued.current = mergePatch(patch, queued.current || {});
      setFailed(true);
      setStatus('Alteração não confirmada. Verifique a conexão e tente novamente.');
      running.current = false;
      return;
    }
    running.current = false;
    if (queued.current) void flush();
  }
  function mergePatch(base, next) {
    return { ...base, ...next, modules: { ...base?.modules, ...next.modules },
      textScales: { ...base?.textScales, ...next.textScales }, readability: { ...base?.readability, ...next.readability } };
  }
  function patch(value) {
    local.current = patchPublicComposition(local.current, value);
    setComposition(local.current);
    setStatus('Sincronizando…');
    queued.current = mergePatch(queued.current, value);
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
  const readability = composition.readability;
  return <details className={styles.editor} open={initiallyOpen || undefined}>
    <summary>COMPOSIÇÃO DA TELA PÚBLICA</summary>
    <div className={styles.fields}>
      <button type="button" aria-pressed={readability.enabled} onClick={() => patch({ textColor: '#ffffff', readability: { ...PUBLIC_READABILITY_DEFAULTS, enabled: true } })}>PERFIL TECIDO</button>
      <button type="button" onClick={() => patch({ textColor: '#00ff66', readability: { enabled: false } })}>VISUAL ORIGINAL</button>
    </div>
    <p>Perfil tecido: letras brancas, fonte sem serifa em negrito, 115% de tamanho e sem halo. A área principal se reorganiza ao lado do Operator sem encolher a tela inteira. Ajuste abaixo conforme a projeção.</p>
    <fieldset className={styles.fields}>
      <legend>Leitura da projeção</legend>
      <label><input type="checkbox" checked={readability.enabled} onChange={event => patch({ readability: { enabled: event.target.checked } })} />Ativar ajustes de leitura</label>
      <label>Fonte da projeção<select aria-label="Fonte da projeção" value={readability.font} disabled={!readability.enabled} onChange={event => patch({ readability: { font: event.target.value } })}>
        <option value="sans">Sem serifa (Arial)</option><option value="mono">Monoespaçada (Courier)</option><option value="scene">Fonte original da cena</option>
      </select></label>
      <label>Peso da fonte<select aria-label="Peso da fonte" value={readability.weight} disabled={!readability.enabled} onChange={event => patch({ readability: { weight: Number(event.target.value) } })}>
        <option value="400">Normal</option><option value="600">Seminegrito</option><option value="700">Negrito</option>
      </select></label>
      <label>Tamanho geral (%)<input aria-label="Tamanho geral do texto" type="number" min="75" max="150" step="5" value={Math.round(readability.scale * 100)} disabled={!readability.enabled} onChange={event => { if (event.target.value) patch({ readability: { scale: Number(event.target.value) / 100 } }); }} /></label>
      <label>Entrelinha<input aria-label="Entrelinha" type="number" min="1" max="1.6" step="0.05" value={readability.lineHeight} disabled={!readability.enabled} onChange={event => { if (event.target.value) patch({ readability: { lineHeight: Number(event.target.value) } }); }} /></label>
      <label><input type="checkbox" checked={readability.noGlow} disabled={!readability.enabled} onChange={event => patch({ readability: { noGlow: event.target.checked } })} />Remover halo dos textos</label>
    </fieldset>
    <p>Selecione um componente e arraste o retângulo; use o canto inferior para redimensionar. X, Y, largura e altura são percentuais da área pública correspondente. Os controles privados permanecem no lugar.</p>
    <div className={styles.fields}>
      <label>Cor do texto (bot e Tarô com leitura ativa)<input aria-label="Cor do texto público" type="color" value={composition.textColor} onChange={event => patch({ textColor: event.target.value })} /></label>
      <button type="button" onClick={() => patch({ textColor: '#ffffff' })}>BRANCO</button>
      <button type="button" onClick={() => patch({ textColor: '#00ff66' })}>VERDE</button>
    </div>
    <div className={styles.fields}>
      <label>Componente<select aria-label="Componente" value={selected} onChange={event => setSelected(event.target.value)}>{Object.entries(PUBLIC_MODULES).map(([id, value]) => <option key={id} value={id}>{value.surface === 'tarot' ? 'Tarot' : value.surface === 'operator' ? 'Dentro do Operator público' : value.surface === 'screen' ? 'Tela' : 'Principal'} · {value.label}</option>)}</select></label>
      {[['x', 'X'], ['y', 'Y'], ['width', 'Largura'], ['height', 'Altura']].map(([key, label]) => <label key={key}>{label} (%)<input aria-label={`${label} do componente`} type="number" min={key === 'x' || key === 'y' ? 0 : 10} max="100" step="0.5" value={Math.round(rect[key] * 10) / 10} onChange={event => { if (event.target.value !== '') updateRect({ [key]: Number(event.target.value) }); }} /></label>)}
      <label>Fonte do componente (%)<input aria-label="Tamanho do texto do componente" type="number" min="50" max="200" step="5" value={Math.round((composition.textScales[selected] || 1) * 100)} onChange={event => { if (event.target.value) patch({ textScales: { [selected]: Number(event.target.value) / 100 } }); }} /></label>
      <button type="button" onClick={() => patch({ modules: { [selected]: null }, textScales: { [selected]: null } })}>RESTAURAR COMPONENTE</button>
    </div>
    <div className={styles.canvas} data-composition-preview aria-label="Prévia esquemática da composição pública">
      {Object.entries(PUBLIC_MODULES).filter(([, value]) => value.surface === definition.surface).map(([id, value]) => <div key={id} className={styles.box} data-selected={selected === id} style={publicModuleStyle(composition.modules[id] || value)}
        onPointerDown={event => startDrag(event)} onPointerMove={move} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
        {value.label}{selected === id ? <button type="button" aria-label="Redimensionar componente na prévia" onPointerDown={event => startDrag(event, true)}>↘</button> : null}
      </div>)}
    </div>
    <p>Sem ajuste personalizado, cada módulo segue o layout padrão da cena. A prévia é esquemática; confira o resultado na janela de projeção. As escolhas são salvas nas preferências do operador.</p>
    <p role="status">{status}</p>
    {failed ? <button type="button" onClick={() => void flush()}>TENTAR SALVAR NOVAMENTE</button> : null}
  </details>;
}
