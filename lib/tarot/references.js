import fs from 'node:fs/promises';
import path from 'node:path';
import { knowledgeFiles } from '../knowledge.js';
import { buildLocalIndex, rankLocalIndex, digest, fold, terms } from '../knowledge-retrieval.js';
import { referenceSettings, REFERENCE_THEMES } from './reference-settings.js';
import { evaluate } from './hallucination.js';
import { faceLibrary } from './face-store.js';

export const MAIN_REFERENCE = 'assets/tarot/CAIXA_PRETA_REFERENCIAS_TARO.md';
const VERSION = 3;
let cached;
let indexQueue=Promise.resolve();
const dynamicCache = new Map();
const sectionThemes = {1:'dramaturgia',2:'dramaturgia',3:'morte',4:'dramaturgia',5:'morel',6:'morte',7:'automatos',8:'percepcao',9:'dramaturgia',10:'morel',11:'filosofia',12:'memes',13:'percepcao',14:'bets',15:'politica',16:'politica',17:'politica',18:'politica',19:'bets',20:'bigtech',21:'bigtech',22:'filosofia',23:'politica',24:'politica',25:'politica'};
const bridges = [
  ['queda ruptura torre estrutura colapso','falha acidente instabilidade desintegração'],
  ['roda louco risco acaso sorte','probabilidade aposta bets fé ritual'],
  ['morte corpo fragmento','decomposição pixels memória imagem eternidade Morel'],
  ['imperador trono autoridade','poder Estado tecnocracia controle instituições'],
  ['lua ilusão espelho rosto','percepção pareidolia simulação deepfake'],
  ['diabo corrente desejo dinheiro','dependência dívida consumo materialismo'],
  ['mago mão instrumento','autômato máquina técnica gesto'],
  ['estrela água temperança','cuidado equilíbrio matéria transformação'],
  ['sol criança jardim','vida corpo presença tempo'],
  ['eremita lanterna sacerdotisa livro','arquivo segredo memória conhecimento']
];
const themeFor = c => c.theme || sectionThemes[Number(c.sectionId?.slice(3))] || (c.documentId.startsWith('knowledge/')?'dramaturgia':'filosofia');

export function referenceIndex(options={}) {
  const task=indexQueue.then(()=>loadReferenceIndex(options));indexQueue=task.catch(()=>{});return task;
}
async function loadReferenceIndex({force=false}={}) {
  const operation = async () => {
    const files = [MAIN_REFERENCE,...knowledgeFiles.map(f=>'knowledge/'+f)];
    const stats = await Promise.all(files.map(async f=>({file:f,stat:await fs.stat(path.join(process.cwd(),f))})));
    const fingerprint = digest(JSON.stringify([VERSION,stats.map(({file,stat})=>[file,stat.size,stat.mtimeMs])]));
    if (!force && cached?.fingerprint===fingerprint) return cached;
    const cachePath = path.join(process.cwd(),'.runtime/tarot-reference-index.json');
    if (!force) {
      try { const saved=JSON.parse(await fs.readFile(cachePath,'utf8')); if(saved.fingerprint===fingerprint){cached=saved;return cached;} }
      catch(e){if(e.code!=='ENOENT' && !(e instanceof SyntaxError))throw e;}
    }
    const documents = await Promise.all(stats.map(async({file,stat})=>({id:file,origin:file,title:path.basename(file),updatedAt:stat.mtime.toISOString(),
      text:await fs.readFile(path.join(process.cwd(),file),'utf8'),kind:file===MAIN_REFERENCE?'reference':'canonical'})));
    for(const document of documents)if(document.id===MAIN_REFERENCE)document.cutoff=document.text.match(/data_de_corte_para_noticias:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1] || null;
    const index=buildLocalIndex(documents);
    index.chunks.forEach(c=>{c.theme=themeFor(c);});
    cached={...index,fingerprint,indexedAt:new Date().toISOString(),documents:documents.map(({text,...d})=>({...d,characters:text.length}))};
    await fs.mkdir(path.dirname(cachePath),{recursive:true});
    const temp=cachePath+'.tmp';await fs.writeFile(temp,JSON.stringify(cached));await fs.rename(temp,cachePath);
    return cached;
  };
  return operation();
}
function localDynamicIndex(documents) {
  const key=digest(JSON.stringify(documents));
  if(!dynamicCache.has(key)) {if(dynamicCache.size>=6)dynamicCache.delete(dynamicCache.keys().next().value);dynamicCache.set(key,buildLocalIndex(documents));}
  return dynamicCache.get(key);
}
export async function referenceStatus(options) {
  const index=await referenceIndex(options);
  return {loaded:true,indexedAt:index.indexedAt,fingerprint:index.fingerprint,chunks:index.chunks.length,
    themes:REFERENCE_THEMES,documents:index.documents,sourceCount:new Set(index.chunks.flatMap(c=>c.sources)).size};
}
export function associationMode(tarot, mode) {
  if (['normal','associative','hallucinatory'].includes(mode)) return mode;
  const levels=tarot.hallucination?evaluate(tarot.hallucination).levels:{};
  return Math.max(levels.association||0,levels.confusion||0,levels.contradiction||0)>.15?'hallucinatory':'associative';
}
export async function retrieveTarotReferences({state,cards=[],question='',mode,library}={}) {
  const settings=referenceSettings(state.tarot.references), index=await referenceIndex();
  mode=associationMode(state.tarot,mode);
  const visualConcepts=cards.flatMap(c=>[c.name,c.description,...(c.concepts||[]),...(c.elements||[]).map(e=>`${e.name} ${e.description||''}`)]).filter(Boolean);
  const primary=visualConcepts.join(' ')+' '+question;
  const expansion=mode==='normal'?[]:bridges.filter(([seed])=>terms(seed).some(t=>terms(primary).includes(t))).map(([,related])=>related).slice(0,mode==='hallucinatory'?Math.ceil(settings.freeAssociation/15):Math.ceil(settings.freeAssociation/25));
  const history=state.conversation.filter(m=>m.content).slice(-6);
  const faces=(library||await faceLibrary()).faces.filter(f=>f.selected!==false);
  const personNames=faces.map(f=>f.name),personIds=faces.map(f=>f.id);
  const query=[primary,...expansion,...personNames,history.map(m=>m.content).join(' ').slice(-1600)].join(' ');
  const docs=(state.tarot.hallucination?.memories||[]).filter(m=>m.enabled!==false).map(m=>({id:'memory/'+m.id,origin:'Memória textual / '+m.title,title:m.title,text:m.text,kind:'operator',theme:'pessoas',personIds:m.personIds||[]}));
  for(const m of (state.memories||[]).filter(m=>!m.expiresAt || Date.parse(m.expiresAt)>Date.now()).slice(-30))docs.push({id:'show-memory/'+m.id,origin:'Memória da sessão',title:'Observação do espetáculo',text:m.content||'',theme:'pessoas',kind:'session'});
  const dynamic=localDynamicIndex(docs);
  const recent=history.filter(m=>m.tarot?.references).map(m=>m.tarot.references);
  const priorIds=new Set(recent.flatMap(m=>m.chunkIds)),priorThemes=recent.flatMap(m=>m.spokenThemes?.length?m.spokenThemes:m.themes);
  const dynamicRanked=rankLocalIndex(dynamic,query);
  for(const c of dynamic.chunks)if(c.personIds.some(id=>personIds.includes(id))&&!dynamicRanked.some(r=>r.id===c.id))dynamicRanked.push({...c,score:.01});
  const focusedQuery=cards.map(c=>[c.name,...(c.concepts||[])].join(' ')).join(' ');
  const focusScores=new Map([...rankLocalIndex(index,focusedQuery),...rankLocalIndex(dynamic,focusedQuery)].map(c=>[c.id,c.score]));
  const questionScores=new Map([...rankLocalIndex(index,question),...rankLocalIndex(dynamic,question)].map(c=>[c.id,c.score]));
  const ranked=[...rankLocalIndex(index,query),...dynamicRanked];
  const linkedIds=new Set(ranked.slice().sort((a,b)=>b.score-a.score).slice(0,3).flatMap(c=>[...c.metadata.matchAll(/CP-\d+/g)].map(m=>m[0])));
  const candidates=ranked.map(c=>{
    c.theme=themeFor(c);
    const cardMatch=cards.some(card=>fold(c.metadata).includes(fold(card.name)))?1.5:0;
    const personMatch=c.personIds.some(id=>personIds.includes(id))?8:personNames.some(n=>fold(c.text).includes(fold(n)))?2:0;
    const penalty=mode==='hallucinatory'?.88:.28;
    return {...c,score:(c.score*.4+(focusScores.get(c.id)||0)*1.5+cardMatch+personMatch+(questionScores.get(c.id)||0)*2+(mode!=='normal'&&linkedIds.has(c.sectionId)?settings.freeAssociation/100:0))*(c.kind==='canonical'?.45:1)*(/^\*\*(Perguntas|Imagens-gatilho)/.test(c.text)?.65:1)*(priorIds.has(c.id)?penalty:1)*(priorThemes.includes(c.theme)&&mode!=='hallucinatory'?.7:1),
      relations:[...(linkedIds.has(c.sectionId)?['Conexão editorial entre núcleos']:[]),...(cardMatch?['Arcano associado no documento']:[]),...(personMatch?['Pessoa selecionada / documento relacionado']:[]),...expansion.filter(e=>terms(e).some(t=>terms(c.text).includes(t))), 'Correspondências: '+[...new Set(terms(primary))].filter(t=>terms(c.text).includes(t)).slice(0,10).join(', ')]};
  }).filter(c=>settings.enabled && settings.intensity>0 && settings.themes[c.theme]!==false && settings.documents[c.documentId]!==false && (c.documentId!==MAIN_REFERENCE || (c.sectionId?.startsWith('CP-')&&c.sectionId!=='CP-25')));
  const selected=[],themeCount={},sectionCount={};let serialized=[];
  const count=Math.max(1,Math.ceil(settings.maxChunks*settings.intensity/100));
  while(candidates.length && selected.length<count){
    candidates.sort((a,b)=>b.score/(1+(themeCount[b.theme]||0)*.8+(sectionCount[b.sectionId||b.documentId]||0))-a.score/(1+(themeCount[a.theme]||0)*.8+(sectionCount[a.sectionId||a.documentId]||0)) || a.id.localeCompare(b.id));
    const c=candidates.shift();
    const block={id:c.id,origin:c.origin,headings:c.headings,theme:c.theme,kind:c.kind,cutoff:c.cutoff,
      relatedPeople:faces.filter(f=>c.personIds.includes(f.id)).map(f=>f.name),
      temporalStatus:c.cutoff?'Arquivo datado; fatos contemporâneos NÃO revalidados':'Memória local',metadata:c.metadata,text:c.text,sources:c.sources};
    const next=[...serialized,block];if(JSON.stringify(next).length>settings.maxChars)continue;
    selected.push(c);serialized=next;themeCount[c.theme]=(themeCount[c.theme]||0)+1;const key=c.sectionId||c.documentId;sectionCount[key]=(sectionCount[key]||0)+1;
  }
  const context=JSON.stringify(serialized);
  return {mode,intensity:settings.intensity,freeAssociation:settings.freeAssociation,visualConcepts,searchTerms:[...new Set(terms(query))],expansion,people:faces.map(({id,name})=>({id,name})),
    chunks:selected.map(({length,...c})=>c),context,characters:context.length,estimatedTokens:Math.ceil(context.length/3),
    limits:{maxChunks:count,maxChars:settings.maxChars},themes:Object.keys(themeCount),fingerprint:index.fingerprint};
}
export function referenceTrace(retrieval,text='') {
  return {chunkIds:retrieval.chunks.map(c=>c.id),themes:retrieval.themes,
    spokenThemes:retrieval.themes.filter(theme=>retrieval.chunks.filter(c=>c.theme===theme).some(c=>terms(c.metadata+' '+c.title).some(t=>terms(text).includes(t)))),
    characters:retrieval.characters,estimatedTokens:retrieval.estimatedTokens,mode:retrieval.mode};
}
