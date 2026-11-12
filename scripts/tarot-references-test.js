import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildLocalIndex, rankLocalIndex, digest, semanticChunks } from '../lib/knowledge-retrieval.js';
import { MAIN_REFERENCE, referenceIndex, referenceStatus, retrieveTarotReferences, referenceTrace } from '../lib/tarot/references.js';
import { referenceSettings, normalizeContemporaryContext } from '../lib/tarot/reference-settings.js';
import { readCatalog } from '../lib/tarot/catalog.js';
import { createTarotState, publicTarotSnapshot, restoredTarotState } from '../lib/tarot/state.js';
import { createTarotController } from '../lib/tarot/controller.js';
import { createHallucination } from '../lib/tarot/hallucination.js';
const checks=[];
const check=async(name,run)=>{await run();checks.push(name);};
const original=await fs.readFile(MAIN_REFERENCE,'utf8'),hash=digest(original);
const cards=await readCatalog(),library={faces:[]};
const state=()=>({tarot:createTarotState(),conversation:[],memories:[]});
const retrieve=(s,id=16,question='',mode='associative',people=library)=>retrieveTarotReferences({state:s,cards:[cards[id]],question,mode,library:people});
await check('full source preserved, 59 nuclei including all 22 arcana and bibliographic provenance indexed',async()=>{
 const index=await referenceIndex();assert(index.documents.find(d=>d.id===MAIN_REFERENCE).characters===original.trimEnd().length || index.documents.find(d=>d.id===MAIN_REFERENCE).characters===original.length);
 for(let n=1;n<=59;n++)assert(index.chunks.some(c=>c.sectionId===`CP-${String(n).padStart(2,'0')}`));
 assert(index.chunks.some(c=>c.sources.some(s=>s.includes('CENIPA'))));assert(index.chunks.every(c=>c.headings.length&&c.origin));
});
await check('paragraphs and headings are preserved without fixed character slicing',()=>{
 const paragraph='Uma frase completa. '.repeat(200);
 const chunks=semanticChunks({id:'test',origin:'original',title:'Teste',text:`# Universo\n\n## Núcleo\n\n${paragraph}\n\nOutro parágrafo.`});
 assert.equal(chunks[0].text.trim(),paragraph.trim());assert.deepEqual(chunks[0].headings,['Universo','Núcleo']);assert.equal(chunks.length,2);
});
await check('BM25 inverted index answers keywords and ranks exact evidence',()=>{
 const index=buildLocalIndex([{id:'a',origin:'a',text:'# Avião\n\nO radar registra colisão e falha.'},{id:'b',origin:'b',text:'# Praia\n\nO mar recebe ondas.'}]);
 assert.equal(rankLocalIndex(index,'colisão falha')[0].documentId,'a');assert.equal(rankLocalIndex(index,'ausentissimo').length,0);
 assert.equal(rankLocalIndex(JSON.parse(JSON.stringify(index)),'constructor').length,0);
 const technical=buildLocalIndex([{id:'tech',origin:'tech',text:'Constructor prototype algoritmo.'}]);assert.equal(rankLocalIndex(technical,'constructor')[0].documentId,'tech');
});
await check('concept expansion bridges images and distinct thematic nuclei',async()=>{
 const tower=await retrieve(state(),16,'queda avião colisão registro'),moon=await retrieve(state(),18,'pareidolia percepção simulação');
 assert(tower.chunks.some(c=>c.sectionId==='CP-02'));assert(moon.chunks.some(c=>['CP-08','CP-13','CP-05'].includes(c.sectionId)));
 assert(tower.expansion.some(e=>e.includes('acidente')));assert.notDeepEqual(tower.chunks.map(c=>c.id),moon.chunks.map(c=>c.id));
});
await check('disabled themes and documents are excluded independently',async()=>{
 const s=state();s.tarot.references=referenceSettings({themes:{politica:false,bets:false}});
 const r=await retrieve(s,4,'democracia apostas controle');assert(r.chunks.length);assert(r.chunks.every(c=>!['politica','bets'].includes(c.theme)));
 assert.equal(s.tarot.references.themes.morel,true);
 s.tarot.references=referenceSettings({documents:{[MAIN_REFERENCE]:false}},s.tarot.references);
 assert((await retrieve(s)).chunks.every(c=>c.documentId!==MAIN_REFERENCE));
 s.tarot.references.enabled=false;assert.equal((await retrieve(s)).chunks.length,0);
});
await check('retrieval context budget includes metadata and sources; whole document never sent',async()=>{
 const s=state();s.tarot.references=referenceSettings({maxChunks:8,maxChars:1800,intensity:100});const r=await retrieve(s);
 assert(r.characters<=1800);assert(r.chunks.length<=8);assert(r.characters<original.length/10);
 assert.equal(r.characters,r.context.length);assert.equal(r.estimatedTokens,Math.ceil(r.context.length/3));
 for(const c of r.chunks)assert(original.includes(c.text)||c.kind==='canonical');
});
await check('linked selected people retrieve their interviews without claiming visual identity',async()=>{
 const s=state();s.tarot.hallucination.memories=[{id:'interview',title:'Entrevista de trabalho',text:'O trabalho transforma a rotina da fábrica em movimento repetido.',personIds:['face-a'],enabled:true}];
 const r=await retrieve(s,7,'', 'associative',{faces:[{id:'face-a',name:'Pessoa cadastrada',selected:true}]});
 assert(r.chunks.some(c=>c.documentId==='memory/interview'));assert(r.chunks.some(c=>c.relations.includes('Pessoa selecionada / documento relacionado')));
 s.tarot.hallucination.memories[0].enabled=false;assert(!(await retrieve(s)).chunks.some(c=>c.documentId==='memory/interview'));
});
await check('canonical play and external references share retrieval with explicit origin priority',async()=>{
 const index=await referenceIndex();assert(index.chunks.some(c=>c.kind==='canonical'));assert(index.chunks.some(c=>c.kind==='reference'));
 const r=await retrieve(state(),16,'colisão CENIPA');for(const c of r.chunks)for(const source of c.sources)assert(original.includes(source));
});
await check('dated facts retain cutoff; contemporary context requires verification and consultation date',async()=>{
 const index=await referenceIndex();assert(index.chunks.filter(c=>c.sectionId==='CP-15').every(c=>c.cutoff==='2026-10-15'&&!c.checkedAt));
 const r=await retrieve(state(),4,'eleição Brasil Lula');assert(r.chunks.filter(c=>c.kind==='reference').every(c=>c.cutoff===(Number(c.sectionId?.slice(3))>=48?'2026-10-16':'2026-10-15')));
 const contexts=normalizeContemporaryContext([{text:'Registro histórico',url:'https://example.org/fato',date:'2026-10-01',verification:'verified'}]);
 assert.equal(contexts[0].verification,'unverified');assert.equal(contexts[0].checkedAt,null);
});
await check('researched political sections carry their own consultation date, sources, themes and bounded retrieval',async()=>{
 const index=await referenceIndex(),thematic={48:'politica',49:'politica',50:'politica',51:'politica',52:'politica',53:'politica',54:'bigtech',55:'bigtech',56:'politica',57:'bets',58:'bets',59:'politica'};
 for(const [n,theme]of Object.entries(thematic)){
  const chunks=index.chunks.filter(c=>c.sectionId===`CP-${n}`);assert(chunks.length);assert(chunks.every(c=>c.checkedAt==='2026-10-16'&&c.cutoff==='2026-10-16'&&c.theme===theme));
  if(n!=='59')assert(chunks.every(c=>c.sources.length>0),`CP-${n} has bibliographic provenance`);
 }
 for(const [query,ids]of [['Banco Master Daniel Vorcaro BRB liquidação',['CP-50','CP-51']],['bolsonarismo Jair Bolsonaro golpe',['CP-48']],['Trump tarifa soberania pressão externa',['CP-52']],['tecnocracia Google publicidade infraestrutura',['CP-54']],['algoritmo feed X experimento conservador',['CP-55']],['Facebook comparecimento eleitoral mobilização',['CP-56']],['bets MP 1394 bloqueio',['CP-57']],['Penalidade Máxima cartões pênaltis manipulação',['CP-58']]]){
  const r=await retrieve(state(),4,query);assert(r.chunks.some(c=>ids.includes(c.sectionId)),query);assert(r.characters<=r.limits.maxChars);
  for(const block of JSON.parse(r.context).filter(c=>c.checkedAt))assert(block.temporalStatus.includes('2026-10-16'));
 }
 const s=state();s.tarot.references=referenceSettings({themes:{politica:false,bigtech:false,bets:false}});assert((await retrieve(s,4,'Master Vorcaro bolsonarismo algoritmos bets')).chunks.every(c=>Number(c.sectionId?.slice(3))<48||c.kind!=='reference'));
 const bibliographicIds=[...original.matchAll(/^- \*\*\[(E\d+)\]\*\*/gm)].map(m=>m[1]);assert.equal(new Set(bibliographicIds).size,bibliographicIds.length);for(const [,id]of original.matchAll(/\[(E\d+)\]/g))assert(bibliographicIds.includes(id),id);
});
await check('recent references are penalized while deliberate hallucinatory repetition remains possible',async()=>{
 const s=state(),first=await retrieve(s);s.conversation=[{role:'assistant',content:'Uma fala sobre a queda.',tarot:{references:referenceTrace(first)}}];
 const second=await retrieve(s);assert.notDeepEqual(second.chunks.map(c=>c.id),first.chunks.map(c=>c.id));
 const normal=await retrieve(s,16,'','normal'),hallucinatory=await retrieve(s,16,'','hallucinatory');assert.equal(normal.expansion.length,0);assert(hallucinatory.expansion.length>0);
});
await check('actual hallucination levels select association mode; memory content is unchanged',async()=>{
 const s=state(),h=createHallucination();h.enabled=true;h.run.status='playing';h.effects.association={enabled:true,mode:'on',intensity:100};s.tarot.hallucination=h;
 const before=JSON.stringify(s);const r=await retrieveTarotReferences({state:s,cards:[cards[18]],library});assert.equal(r.mode,'hallucinatory');assert.equal(JSON.stringify(s),before);
});
await check('settings and contemporary context survive recovery; public snapshot excludes references',()=>{
 const s=createTarotState();s.references=referenceSettings({themes:{politica:false},maxChunks:2});
 assert.equal(restoredTarotState(s).references.themes.politica,false);assert.equal(restoredTarotState(s).references.maxChunks,2);assert(!('references' in publicTarotSnapshot(s)));
});
await check('controller stores trace on existing shared conversation; controls preserve content',()=>{
 let tarot=createTarotState();const messages=[];
 const controller=createTarotController({get:()=>tarot,set:s=>tarot=s,sessionId:()=> 'test',emit:()=>{},addMessage:(role,content)=>{const m={id:'m'+messages.length,role,content};messages.push(m);return m;},runTurn:async()=>{}});
 controller.control('start');controller.control('select',{card:cards[16],source:'manual'});
 const job=controller.begin({question:'queda'});job.references={chunkIds:['source'],themes:['morte']};
 controller.finish(job,{text:'Uma fala.',segments:[],narrativeVersion:2},[]);assert.equal(messages.length,2);assert.deepEqual(messages[1].tarot.references,job.references);
 controller.control('references',{settings:{themes:{politica:false}}});assert.equal(tarot.references.themes.morel,true);
 controller.control('hallucination-memory',{memories:[{id:'doc',title:'Entrevista',text:'x'.repeat(18000),personIds:['face-a']}]});assert.equal(tarot.hallucination.memories[0].text.length,18000);
 assert.throws(()=>controller.control('hallucination-memory',{memories:[{text:'x'.repeat(120001)}]}),/DOCUMENT_LIMIT/);
 controller.control('reset');assert.equal(tarot.references.themes.politica,false);assert.equal(tarot.hallucination.memories[0].text.length,18000);
});
await check('offline lookup, persistent cache reuse and serialized reindex preserve source hash',async()=>{
 const realFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Network forbidden');};
 try{await retrieve(state());await Promise.all([referenceIndex({force:true}),referenceIndex({force:true})]);const a=await referenceStatus(),b=await referenceStatus();assert.equal(a.indexedAt,b.indexedAt);}finally{globalThis.fetch=realFetch;}
 assert.equal(digest(await fs.readFile(MAIN_REFERENCE,'utf8')),hash);
});
console.log(JSON.stringify({ok:true,checks},null,2));
