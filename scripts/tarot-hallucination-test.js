import assert from 'node:assert/strict';
import {createHallucination,patchHallucination,transport,evaluate,elapsed,removeHallucination,restoreHallucination,hallucinationSnapshot,eventLevel,hallucinationReadiness,builtInPreset,EFFECTS,selectHallucination} from '../lib/tarot/hallucination.js';
import {createTarotState,publicTarotSnapshot} from '../lib/tarot/state.js';
import {createTarotController} from '../lib/tarot/controller.js';
const h=createHallucination();h.enabled=true;transport(h,'restart',8,'8:v',1000);
assert.equal(evaluate(h,9).levels.fusion,0);assert.equal(evaluate(h,13).levels.fusion,1);assert.equal(evaluate(h,57.9).levels.fusion,1);assert.equal(evaluate(h,61).levels.fusion,0);assert(evaluate(h,70).levels.fusion>0);
const run=h.run.id;patchHallucination(h,{effects:{falling:{enabled:false}}});assert.equal(h.run.id,run);assert.equal(h.run.anchorMono,1000);assert.equal(evaluate(h,15).levels.fusion,1);
patchHallucination(h,{enabled:false});assert.equal(evaluate(h,15).levels.fusion,0);assert(h.effects.fusion.enabled);patchHallucination(h,{enabled:true});assert.equal(evaluate(h,15).levels.fusion,1);assert(!h.effects.falling.enabled);patchHallucination(h,{effects:{fusion:{mix:90}}});assert.equal(h.effects.fusion.mix,90);assert.equal(h.run.id,run);
h.run.overrides.fusion={mode:'off',until:1e12};assert.equal(evaluate(h,15).levels.fusion,0);delete h.run.overrides.fusion;
transport(h,'pause',null,null,16000);assert.equal(elapsed(h,999999),15);transport(h,'play',8,'8:v',21000);assert.equal(elapsed(h,26000),20);
removeHallucination(h);assert.equal(evaluate(h,70).levels.fusion,0);assert.equal(h.run.status,'stopped');assert.notEqual(h.run.id,run);
const e={enabled:true,start:1,hold:2,fadeIn:0,fadeOut:0,intensity:100,repeat:2,gap:3,transition:'cut'};assert.equal(eventLevel(e,2),1);assert.equal(eventLevel(e,4),0);assert.equal(eventLevel(e,7),1);assert.equal(eventLevel(e,10),0);
h.memories=[{title:'private',text:'secret'}];h.assets=[{cardId:8,url:'/ok'},{cardId:9,url:'/other'}];h.run.cardId=8;const snap=hallucinationSnapshot(h);assert(!snap.memories);assert.equal(snap.assets.length,1);assert(!('anchorMono'in snap.run));assert.equal(restoreHallucination(h).run.status,'stopped');
let state=createTarotState(),messages=[];const c=createTarotController({get:()=>state,set:s=>state=s,emit:()=>{},addMessage:(...m)=>messages.push(m),runTurn:async()=>{},sessionId:()=> 'test'});
c.control('start');c.control('claim-camera',{owner:'test'});
for(const id of [1,2,2,8])c.control('select',{card:{id,name:`Card ${id}`,version:'v',elements:[]},source:'camera',owner:'test',newVisit:true});
assert.equal(state.hallucination.seenCards.length,3);assert.equal(state.hallucination.run.status,'playing');assert.equal(state.hallucination.run.cardId,8);assert.equal(evaluate(state.hallucination,0).levels.fusion,0);
const id=state.hallucination.run.id;c.control('hallucination',{patch:{effects:{wave:{enabled:false}}}});assert.equal(state.hallucination.run.id,id);
c.control('tracking-lost',{owner:'test',signature:'8:v'});assert.equal(state.hallucination.run.status,'stopped');c.control('tracking-resumed',{owner:'test',signature:'8:v'});assert.equal(state.hallucination.run.status,'stopped');assert.equal(messages.length,0);
c.control('hallucination-manual',{effect:'circular',mode:'on'});assert(state.hallucination.run.manualOnly);assert(evaluate(state.hallucination,30).levels.fusion===0);c.control('hallucination-transport',{command:'restart'});assert(!state.hallucination.run.manualOnly);c.pause();assert.equal(state.hallucination.run.status,'stopped');assert(!publicTarotSnapshot(state).hallucination.memories);
c.control('resume-speech');c.control('hallucination',{patch:{enabled:false}});c.control('hallucination-transport',{command:'play'});assert.equal(state.hallucination.enabled,false);c.control('reset');c.control('start');c.control('select',{cards:[{id:1,version:'v',elements:[]},{id:2,version:'v',elements:[]}],card:{id:1,version:'v',elements:[]},source:'manual-camera'});assert.deepEqual(state.hallucination.seenCards,[1,2]);
// Reproduce the live report: six valid cards, but only arcano 2 is eligible.
state=createTarotState();c.control('start');c.control('claim-camera',{owner:'filter-test'});c.control('hallucination',{patch:{eligibleCardIds:[2]}});
for(const id of [3,12,10,14,9,5])c.control('select',{card:{id,name:`Card ${id}`,version:'v',elements:[]},source:'camera',owner:'filter-test',newVisit:true});
assert.equal(state.hallucination.run.status,'stopped');assert.equal(hallucinationReadiness(state).code,'card-filter');assert.equal(hallucinationReadiness(state).count,6);assert.match(hallucinationReadiness(state).faceMessage,/Nenhuma fusão aprovada/);
const blockedRun=state.hallucination.run.id;c.control('hallucination',{patch:{eligibleCardIds:[]}});assert.equal(state.hallucination.run.id,blockedRun);assert.equal(state.hallucination.seenCards.length,6);
c.control('select',{card:{id:8,name:'A Justiça',version:'v',elements:[]},source:'camera',owner:'filter-test',newVisit:true});assert.equal(state.hallucination.run.status,'playing');assert.equal(hallucinationReadiness(state,1).code,'playing');assert.match(hallucinationReadiness(state,1).message,/Próximo evento em 9 s/);assert(evaluate(state.hallucination,16).levels.wave>0,'Image effects do not require an approved face');
c.control('hallucination',{patch:{requireFusion:true}});c.control('select',{card:{id:5,name:'O Sacerdote',version:'v',elements:[]},source:'camera',owner:'filter-test',newVisit:true});assert.equal(hallucinationReadiness(state).code,'fusion-required');
c.control('hallucination',{patch:{enabled:false}});assert.equal(hallucinationReadiness(state).code,'master-off');
console.log(JSON.stringify({ok:true,checks:['45-second hold and gaps, editable envelopes and repetitions','independent gates, master suspension, manual precedence and unchanged clock','monotonic pause/resume; run invalidation and removal clears overrides','third distinct presentation; brief returns do not count; no old-run resurrection','six-card filter regression; explicit readiness and missing-fusion diagnostics; clearing restriction preserves count and clock','public privacy; recovery stopped; emergency pause cancels effects; no model calls']} ,null,2));

const cardOnly=createHallucination();cardOnly.effects.morph.intensity=85;patchHallucination(cardOnly,builtInPreset('carta-estranha'));transport(cardOnly,'restart',8,'8:v',1000);
assert.equal(cardOnly.effects.morph.intensity,85,'Disabled face settings remain available');
for(const t of [0,2,5,10,49,51,120,1000]){const {levels}=evaluate(cardOnly,t);for(const [key,[,group]]of Object.entries(EFFECTS))if(group!=='carta'||key==='symbols')assert.equal(levels[key],0,`${key} disabled at ${t}`);}
assert(evaluate(cardOnly,2).levels.breathing>0);assert(evaluate(cardOnly,5).levels.wave>.5);assert(evaluate(cardOnly,10).levels.double>0);assert(!cardOnly.requireFusion);
console.log(JSON.stringify({ok:true,cardOnlyPreset:true}));

const randomH=createHallucination(),randomCards=[{id:2,version:'a'},{id:8,version:'b'}];let rolls=0;
const rng=()=>{rolls++;return rolls===1?.2:.8;};patchHallucination(randomH,{randomEnabled:true,randomChance:50,automatic:false,afterCards:22});
selectHallucination(randomH,randomCards.slice(0,1),'2:a',{},rng);assert.equal(rolls,1);assert.equal(randomH.run.status,'playing');assert.deepEqual(randomH.run.randomCardIds,[2]);
selectHallucination(randomH,randomCards,'2:a+8:b',{},rng);assert.equal(rolls,2,'Adding a second card does not redraw the first');assert.deepEqual(randomH.run.randomDraws.map(d=>d.triggered),[true,false]);assert.deepEqual(randomH.run.randomCardIds,[2]);
selectHallucination(randomH,randomCards,'2:a+8:b',{},rng);assert.equal(rolls,2,'Repeated recognition keeps both decisions');
selectHallucination(randomH,randomCards.slice(1),'8:b',{},rng);assert.equal(rolls,2);assert.equal(randomH.run.status,'stopped','The losing card remains normal when alone');
assert.equal(hallucinationReadiness({...createTarotState(),active:true,currentCards:randomCards.slice(1),hallucination:randomH}).code,'random');
selectHallucination(randomH,randomCards.slice(1),'8:b',{newVisit:true},rng);assert.equal(rolls,3,'A new presentation gets a new draw');
for(const chance of [0,100]){patchHallucination(randomH,{randomChance:chance});selectHallucination(randomH,randomCards,'pair',{newVisit:true},()=>.5);assert.equal(randomH.run.status,chance?'playing':'stopped');}
for(const options of [{active:false},{suspended:true}])selectHallucination(randomH,randomCards,'pair',options,()=>{throw Error('Inactive cards must not roll');});
patchHallucination(randomH,{enabled:false});selectHallucination(randomH,randomCards,'pair',{},()=>{throw Error('Master OFF must not roll');});
patchHallucination(randomH,{enabled:true,eligibleCardIds:[2],requireFusion:true});selectHallucination(randomH,randomCards,'pair',{},()=>{throw Error('Missing approved fusion must not roll');});
patchHallucination(randomH,{requireFusion:false,randomChance:100});selectHallucination(randomH,randomCards,'pair',{newVisit:true},()=>.5);assert.deepEqual(randomH.run.randomCardIds,[2]);assert(!hallucinationSnapshot(randomH).run.randomDraws);assert(hallucinationSnapshot(randomH,true).run.randomDraws);
const restoredRandom=restoreHallucination(randomH);assert(restoredRandom.randomEnabled);assert.equal(restoredRandom.randomChance,100);assert(!restoredRandom.run.randomDraws,'Recovery starts without old draws');
patchHallucination(randomH,{randomChance:999});assert.equal(randomH.randomChance,100);patchHallucination(randomH,{randomChance:-9});assert.equal(randomH.randomChance,0);
let rs=createTarotState();const rc=createTarotController({get:()=>rs,set:s=>rs=s,emit:()=>{},addMessage:()=>{throw Error('Random draws do not speak');},runTurn:async()=>{},sessionId:()=> 'random-test'});
rc.control('start');rc.control('claim-camera',{owner:'owner'});rc.control('hallucination',{patch:{randomEnabled:true,randomChance:100}});rc.control('select',{card:randomCards[0],source:'camera',owner:'owner'});
const draw=rs.hallucination.run.randomDraws[0];rc.control('select',{card:randomCards[0],source:'camera',owner:'owner'});assert.equal(rs.hallucination.run.randomDraws[0],draw,'Duplicate camera select does not redraw');
rc.control('tracking-lost',{owner:'owner',signature:'2:a'});assert(rs.hallucination.run.absent);assert.throws(()=>rc.control('hallucination-card-return',{owner:'other',signature:'2:a'}),/CAMERA_NOT_OWNER/);
rc.control('hallucination-card-return',{owner:'owner',signature:'2:a'});assert.equal(rs.hallucination.run.status,'playing');const returnRun=rs.hallucination.run.id;rc.control('hallucination-card-return',{owner:'owner',signature:'2:a'});assert.equal(rs.hallucination.run.id,returnRun,'Duplicate return notification does not redraw');
rc.control('hallucination-preset',{operation:'save',name:'Random'});assert.equal(rs.hallucination.presets[0].patch.randomChance,100);rc.cancel();
console.log(JSON.stringify({ok:true,randomPerCard:true,checks:['one draw per continuous card, pair winner mask, stable return, 0/100%, eligibility and master gates, private ephemeral outcomes, persisted chance and presets']}));
