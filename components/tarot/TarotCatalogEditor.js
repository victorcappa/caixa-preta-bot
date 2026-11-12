"use client";
import { useRef, useState } from "react";
import { regionPoints } from "@/lib/tarot/geometry";
import styles from "./TarotControls.module.css";

export default function TarotCatalogEditor({ card, sessionId, onSaved }) {
  const [draft, setDraft] = useState(card);
  const [aliases, setAliases] = useState(card.aliases.join(", "));
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [polygon, setPolygon] = useState([]);
  const [size, setSize] = useState([960, 1280]);
  const start = useRef(null), svgRef = useRef(null);
  const element = draft.elements[selected];
  const patchElement = (patch) => setDraft((current) => ({ ...current, elements: current.elements.map((e, i) => i === selected ? { ...e, ...patch } : e) }));
  function point(event) {
    const rect = svgRef.current.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))];
  }
  function down(event) {
    if (!element) return;
    const p = point(event);
    if (element.shape === "polygon") { setPolygon((old) => [...old, p].slice(0, 24)); return; }
    start.current = p; event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event) {
    if (!start.current || !element) return;
    const p = point(event), a = start.current;
    patchElement({ region: [Math.min(a[0],p[0]), Math.min(a[1],p[1]), Math.max(.002,Math.abs(a[0]-p[0])), Math.max(.002,Math.abs(a[1]-p[1]))], validated: false });
  }
  function finishPolygon() {
    if (polygon.length < 3) return;
    const xs=polygon.map((p)=>p[0]),ys=polygon.map((p)=>p[1]);
    patchElement({ points: polygon, region: [Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)], validated: false });
    setPolygon([]);
  }
  async function save() {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/tarot/catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, id: card.id, patch: { ...draft, aliases: aliases.split(",").map((s)=>s.trim()).filter(Boolean) } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setDraft(result.card); onSaved(result.card); setMessage("Carta e âncoras salvas localmente.");
    } catch { setMessage("Não foi possível salvar a carta."); } finally { setPending(false); }
  }
  return <div className={styles.editor}>
    <div className={styles.anchorImage} style={{ aspectRatio: `${size[0]}/${size[1]}` }}>
      {draft.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */
        <img src={draft.imageUrl} alt={`Referência de ${draft.name}`} onLoad={(e)=>setSize([e.currentTarget.naturalWidth,e.currentTarget.naturalHeight])} /> : <p>Imagem ainda não cadastrada.</p>}
      <svg ref={svgRef} viewBox="0 0 1 1" preserveAspectRatio="none" onPointerDown={down} onPointerMove={move} onPointerUp={()=>{start.current=null;}} onPointerCancel={()=>{start.current=null;}}>
        {draft.elements.filter((e)=>e.region).map((e)=><polygon key={e.id} data-selected={e.id===element?.id} points={(e.shape==="polygon" && e.points ? e.points : regionPoints(e.region,e.shape)).map((p)=>p.join(",")).join(" ")} />)}
        {polygon.length ? <polyline points={polygon.map((p)=>p.join(",")).join(" ")} /> : null}
      </svg>
    </div>
    <div className={styles.editorFields}>
      <label>Nome<input value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})} /></label>
      <label>Nomes alternativos (vírgula)<input value={aliases} onChange={(e)=>setAliases(e.target.value)} /></label>
      <label>O que existe nesta ilustração<textarea value={draft.description} onChange={(e)=>setDraft({...draft,description:e.target.value})} /></label>
      <label>Relações visuais<textarea value={draft.relations} onChange={(e)=>setDraft({...draft,relations:e.target.value})} /></label>
      <label>Contexto simbólico<textarea value={draft.symbolism} onChange={(e)=>setDraft({...draft,symbolism:e.target.value})} /></label>
      <label>Fala de contingência (reprodução local)<textarea value={draft.contingency} onChange={(e)=>setDraft({...draft,contingency:e.target.value})} /></label>
      <div className={styles.actions}><button type="button" onClick={()=>{
        setSelected(draft.elements.length);setDraft({...draft,elements:[...draft.elements,{id:crypto.randomUUID(),name:"Novo elemento",description:"",category:"objeto",region:null,shape:"box",validated:false,origin:"operator"}]});
      }}>ADICIONAR ELEMENTO</button></div>
      {draft.elements.length ? <label>Elemento<select aria-label="Elemento" value={selected} onChange={(e)=>{setSelected(Number(e.target.value));setPolygon([]);}}>{draft.elements.map((e,i)=><option key={e.id} value={i}>{e.name}{e.validated?" · validado":""}</option>)}</select></label> : null}
      {element ? <div className={styles.anchorFields}>
        <label>Nome do elemento<input value={element.name} onChange={(e)=>patchElement({name:e.target.value})} /></label>
        <label>Descrição<input value={element.description} onChange={(e)=>patchElement({description:e.target.value})} /></label>
        <label>Anotação<select value={element.shape} onChange={(e)=>{patchElement({shape:e.target.value,validated:false});setPolygon([]);}}><option value="box">Retângulo</option><option value="circle">Círculo</option><option value="underline">Sublinhado</option><option value="polygon">Polígono</option></select></label>
        <p className={styles.hint}>{element.shape==="polygon"?"Clique nos vértices sobre a imagem e conclua o polígono.":"Arraste sobre a imagem para definir a região. Ajuste posição e tamanho abaixo."}</p>
        {element.shape==="polygon" ? <button type="button" disabled={polygon.length<3} onClick={finishPolygon}>CONCLUIR POLÍGONO</button> : null}
        <div className={styles.coordinates}>{["X","Y","Largura","Altura"].map((label,i)=><label key={label}>{label}<input type="number" min="0" max="1" step="0.005" value={element.region?.[i] ?? 0} onChange={(e)=>{const region=[...(element.region||[0,0,.1,.1])];region[i]=Number(e.target.value);patchElement({region,validated:false});}} /></label>)}</div>
        <label className={styles.check}><input type="checkbox" checked={element.validated} disabled={!element.region} onChange={(e)=>patchElement({validated:e.target.checked,origin:"operator"})} />Âncora revisada sobre esta fotografia</label>
        <button type="button" onClick={()=>{setDraft({...draft,elements:draft.elements.filter((_,i)=>i!==selected)});setSelected(0);}}>REMOVER ELEMENTO</button>
      </div> : null}
      <button type="button" disabled={pending} onClick={save}>SALVAR CARTA E ÂNCORAS</button>
      {message ? <p role="status">{message}</p> : null}
    </div>
  </div>;
}
