"use client";
import { useEffect, useState } from 'react';
import { referenceSettings, REFERENCE_THEMES } from '@/lib/tarot/reference-settings';
import styles from './TarotControls.module.css';

export default function TarotReferenceControls({tarot,cards,sessionId,command,history=[]}) {
  const [status,setStatus]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [cardId,setCardId]=useState(16),[question,setQuestion]=useState(''),[mode,setMode]=useState('associative');
  const [results,setResults]=useState({});
  const settings=referenceSettings(tarot.references);
  useEffect(()=>{fetch('/api/tarot/references',{cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);setStatus(data);}).catch(e=>setError(e.message));},[]);
  async function run(action) {
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/tarot/references',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,action,cardId,question,mode})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      if(action==='reindex')setStatus(data);else setResults(old=>({...old,[mode]:{...data,cardId,question}}));
    } catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const save=patch=>command('references',{settings:patch});
  const last=history.filter(m=>m.tarot?.references).at(-1)?.tarot.references;
  return <details open><summary>REFERÊNCIAS E MEMÓRIA</summary><div className={styles.section}>
    {status?<><p role="status">Documento principal carregado · índice local pronto · {status.chunks} trechos · {status.sourceCount} fontes bibliográficas. Atualizado em {new Date(status.indexedAt).toLocaleString('pt-BR')}.</p>
      {status.documents.map(d=><label className={styles.check} key={d.id}><input type="checkbox" checked={settings.documents[d.id]!==false} onChange={e=>save({documents:{[d.id]:e.target.checked}})}/><span>{d.origin} · {d.characters.toLocaleString('pt-BR')} caracteres · {new Date(d.updatedAt).toLocaleDateString('pt-BR')}</span></label>)}</>:<p>Carregando índice local…</p>}
    <label className={styles.check}><input type="checkbox" checked={settings.enabled} onChange={e=>save({enabled:e.target.checked})}/>Ativar recuperação de referências</label>
    <p className={styles.hint}>Os controles selecionam trechos e preservam os arquivos originais. A dramaturgia canônica continua na personalidade compartilhada. Novos textos e entrevistas podem ser adicionados logo abaixo.</p>
    <div className={styles.configGrid}>{[['intensity','Intensidade de utilização',0,100],['freeAssociation','Associação livre',0,100],['maxChunks','Máximo de trechos',1,8],['maxChars','Limite de caracteres de contexto',1500,12000]].map(([key,label,min,max])=><label key={key}>{label}<input type="number" min={min} max={max} key={`${key}:${settings[key]}`} defaultValue={settings[key]} onBlur={e=>save({[key]:Number(e.target.value)})}/></label>)}</div>
    <div className={styles.configGrid}>{Object.entries(REFERENCE_THEMES).map(([id,label])=><label className={styles.check} key={id}><input type="checkbox" checked={settings.themes[id]!==false} onChange={e=>save({themes:{[id]:e.target.checked}})}/>{label}</label>)}</div>
    <button disabled={busy} onClick={()=>run('reindex')}>REINDEXAR REFERÊNCIAS</button>
    <p className={styles.hint}>Busca e reindexação são locais e gratuitas. GERAR INTERPRETAÇÃO usa o modelo atual e consome API. Todos os resultados ficam privados; o teste não publica nem altera a sessão da apresentação.</p>
    <label>Carta para testar associações<select value={cardId} onChange={e=>setCardId(Number(e.target.value))}>{cards.map(c=><option key={c.id} value={c.id}>{c.number} · {c.name}</option>)}</select></label>
    <label>Pergunta para a busca contextual<textarea value={question} onChange={e=>setQuestion(e.target.value)} maxLength={4000}/></label>
    <label>Modo de interpretação<select value={mode} onChange={e=>setMode(e.target.value)}><option value="normal">Normal</option><option value="associative">Associativa</option><option value="hallucinatory">Alucinatória</option></select></label>
    <div className={styles.actions}><button disabled={busy||!cards.length} onClick={()=>run('search')}>TESTAR ASSOCIAÇÕES</button><button disabled={busy||!cards.length} onClick={()=>run('generate')}>GERAR INTERPRETAÇÃO</button></div>
    {last?<p>Última resposta da sessão: {last.chunkIds.length} trechos · aproximadamente {last.estimatedTokens} tokens de referências · temas: {last.themes.join(', ')}.</p>:null}
    {Object.entries(results).map(([key,result])=><details key={key} open={key===mode}><summary>RESULTADO {{normal:'NORMAL',associative:'ASSOCIATIVA',hallucinatory:'ALUCINATÓRIA'}[key]} · {cards.find(c=>c.id===result.cardId)?.name}</summary><div className={styles.section}>
      {result.narrative?<p style={{whiteSpace:'pre-line'}}>{result.narrative.text}</p>:null}
      <p>{result.references.chunks.length} trechos · {result.references.characters} caracteres · ≈ {result.references.estimatedTokens} tokens de referências (o prompt e o histórico são adicionais).</p>
      <p>Conceitos visuais: {result.references.visualConcepts.join(' · ')}</p>
      <details><summary>TERMOS E PONTES DA BUSCA</summary><p>{result.references.searchTerms.join(', ')}</p><p>{result.references.expansion.join(' → ')}</p><p>Pessoas selecionadas: {result.references.people.map(p=>p.name).join(', ')||'nenhuma'}</p></details>
      {result.references.chunks.map(c=><article key={c.id}><strong>{c.title} · {REFERENCE_THEMES[c.theme]}</strong><p>{c.origin} · {c.cutoff?`recorte ${c.cutoff}, não revalidado`:'memória local'}</p><p>{c.relations.join(' · ')}</p><p style={{whiteSpace:'pre-line'}}>{c.text}</p><details><summary>PROCEDÊNCIA E FONTES</summary><p>{c.headings.join(' / ')}</p><p>{c.metadata}</p>{c.sources.map(source=><p key={source}>{source}</p>)}</details></article>)}
    </div></details>)}
    {error?<p role="alert">{error}</p>:null}
  </div></details>;
}
