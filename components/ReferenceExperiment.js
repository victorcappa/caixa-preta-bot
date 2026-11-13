"use client";
import { useEffect, useRef, useState } from 'react';
import styles from './ReferenceArchive.module.css';

const NOTEBOOK = 'caixa-preta:reference-island-notebook:v1';
export default function ReferenceExperiment({ items, ids, onRemove }) {
  const [question, setQuestion] = useState(''), [busy, setBusy] = useState(false), [result, setResult] = useState(null), [error, setError] = useState(''), [notebook, setNotebook] = useState([]);
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { try { const saved = JSON.parse(sessionStorage.getItem(NOTEBOOK) || '[]'); if (Array.isArray(saved)) setNotebook(saved.slice(0, 8)); } catch {} }, []);
  useEffect(() => { pending.current?.abort(); setBusy(false); setResult(null); setError(''); }, [ids]);
  const materials = ids.map(id => items.find(item => item.id === id)).filter(Boolean);
  async function run(action) {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setResult(null);
    try { const response = await fetch('/api/reference-experiment', { signal: controller.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ids, question }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'O experimento não pôde ser concluído.'); if (!controller.signal.aborted && pending.current === controller) setResult(data); }
    catch (cause) { if (cause.name !== 'AbortError') setError(cause.message); } finally { if (pending.current === controller) setBusy(false); }
  }
  function keep() { const next = [result, ...notebook.filter(entry => entry.id !== result.id)].slice(0, 8); setNotebook(next); try { sessionStorage.setItem(NOTEBOOK, JSON.stringify(next)); } catch {} }
  return <section className={styles.laboratory} aria-label="Laboratório privado de associações">
    <div className={styles.laboratoryHeading}><div><span>LABORATÓRIO / SOMENTE NESTA ABA</span><h2>Dois vestígios.<br />Uma terceira coisa.</h2></div><p>Escolha dois materiais nas fichas. Explore o contexto ou gere uma improvisação privada da Caixa.</p></div>
    <div className={styles.experimentSlots}>{[0, 1].map(index => <div key={index}><span>0{index + 1}</span>{materials[index] ? <><strong>{materials[index].title}</strong><button aria-label={`Retirar ${materials[index].title} do cruzamento`} onClick={() => onRemove(materials[index].id)}>×</button></> : <p>Adicione um material pela ficha do acervo.</p>}</div>)}</div>
    <label className={styles.provocation}>Uma provocação, se quiser<textarea aria-label="Provocação para o cruzamento" maxLength={750} rows={2} value={question} onChange={event => setQuestion(event.target.value)} placeholder="O que uma máquina lembra quando seu corpo cai?" /></label>
    <div className={styles.experimentActions}><button disabled={ids.length !== 2 || busy} onClick={() => run('preview')}>Ver contexto das fontes</button><button disabled={ids.length !== 2 || busy} onClick={() => run('generate')}>{busy ? 'Preparando…' : 'Gerar improvisação privada ↗'}</button></div>
    {error && <p role="alert" className={styles.experimentError}>{error}</p>}
    {result && <div className={styles.experimentResult} data-reference-experiment={result.kind}>{result.text && <><span>EXPERIMENTO DE ASSOCIAÇÃO / FALA GERADA</span><p>{result.text}</p><button onClick={keep} disabled={notebook.some(entry => entry.id === result.id)}>{notebook.some(entry => entry.id === result.id) ? 'Guardado no caderno' : 'Guardar no caderno desta aba'}</button></>}<details open={result.kind === 'preview'}><summary>{result.kind === 'preview' ? 'Contexto disponível para o experimento' : 'Contexto enviado nesta geração'}</summary>{result.sources.map(source => <article key={source.id}><h3>{source.title}</h3><small>{source.status} · {source.sourcePath}</small>{source.segments.map((segment, index) => <p key={index}>{segment.page ? `Página PDF ${segment.page} · ` : ''}{segment.text}</p>)}</article>)}<small>Camadas permanentes também fornecidas: {result.fixedContext?.map(layer => `${layer.title} (${layer.sources.length} arquivos)`).join("; ")}.</small><small>{result.limits}</small></details></div>}
    {notebook.length > 0 && <details className={styles.notebook}><summary>Caderno desta aba · {notebook.length} fragmentos</summary>{notebook.map(entry => <article key={entry.id}><p>{entry.text}</p><small>{entry.sources.map(source => source.title).join(' + ')}</small></article>)}<button onClick={() => { setNotebook([]); try { sessionStorage.removeItem(NOTEBOOK); } catch {} }}>Esvaziar caderno desta aba</button></details>}
  </section>;
}
