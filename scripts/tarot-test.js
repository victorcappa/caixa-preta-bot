import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createTarotController } from "../lib/tarot/controller.js";
import { createTarotState, publicTarotSnapshot, restoredTarotState, normalizeElements, normalizeNarrative, canAutonomousTurn, normalizeTarotVisual } from "../lib/tarot/state.js";
import { projectPoint, regionPoints, validQuad, visibleElementIds, activeElementIds, videoQuadInStage } from "../lib/tarot/geometry.js";
import { createRecognitionGate } from "../lib/tarot/recognition.js";
import { isMainProjectionMessage } from "../lib/publicText.js";

const root = process.cwd();
const checks=[];
function check(label, run) {run();checks.push(label);}
check("shared tarot memory never becomes main-projection speech",()=>{
  for(const source of ["tarot-response","tarot-stage","tarot-question","tarot-contingency"])
    assert.equal(isMainProjectionMessage({role:"assistant",source,content:"Tarô"}),false);
  assert.equal(isMainProjectionMessage({role:"assistant",tarot:{cardId:0}}),false);
  assert.equal(isMainProjectionMessage(null),false);
  for(const source of ["scene-zero-suitcase-choice","scene-zero-hangman-instruction","audience-warmup","operator","openai"])
    assert.equal(isMainProjectionMessage({role:"assistant",source,content:"Espetáculo"}),true);
});
const h=[600,40,100,20,700,80,.15,.08,1];
check("homography, perspective, circles and absent geometry",()=>{
  assert.deepEqual(projectPoint([1,0,0,0,1,0,0,0,1],.2,.3),[.2,.3]);
  const p=projectPoint(h,.5,.5);assert(Math.abs(p[0]-420/1.115)<1e-6);
  assert.equal(projectPoint([1,0,0,0,1,0,0,0,0],0,0),null);
  assert.equal(regionPoints([.2,.3,.1,.1],"circle").length,32);
  assert(validQuad([[10,10],[200,20],[190,280],[20,290]],640,480));
  assert(!validQuad([[10,10],[190,280],[200,20],[20,290]],640,480));
});
check("invalid anchors are not trusted; polygons and element IDs are bounded",()=>{
  const es=normalizeElements([{id:"sun",name:"Sol",region:[.9,0,.5,.5],validated:true},
    {id:"dog",name:"Animal",region:[.1,.1,.3,.4],validated:true,origin:"operator"},{id:"dog",name:"Duplicado"}]);
  assert.equal(es.length,2);assert.equal(es[0].region,null);assert.equal(es[0].validated,false);assert.equal(es[1].validated,true);
  const n=normalizeNarrative({segments:[{text:"Um animal.",elementIds:["dog","invented"]}]},es);
  assert.deepEqual(n.segments[0].elementIds,["dog"]);
  const leaked=normalizeNarrative({segments:[{text:"t12-suspenso, t12-rosto — Pessoa de cabeça para baixo.",elementIds:["t12-suspenso","t12-rosto"]}]},[{id:"t12-suspenso"},{id:"t12-rosto"}]);
  assert.equal(leaked.text,"Pessoa de cabeça para baixo.");assert.deepEqual(leaked.segments[0].elementIds,["t12-suspenso","t12-rosto"]);
  assert.deepEqual(visibleElementIds([{text:"Um sol.",elementIds:["sun"]},{text:"Um animal.",elementIds:["dog"]}],9),["sun"]);
  assert.deepEqual(visibleElementIds([{text:"Um sol.",elementIds:["sun"]},{text:"Um animal.",elementIds:["dog"]}],10),["sun","dog"]);
});
check("automatic interpretation defaults, stability, return policy and segment events",()=>{
  assert.equal(createTarotState().config.autoAnalyze,true);assert.equal(createTarotState().config.repeatOnReturn,false);
  const gate=createRecognitionGate();assert(!gate.observe(13,100));assert(!gate.observe(13,250));assert(gate.observe(13,550));gate.submitted(13,550);
  assert(gate.wasSubmittedRecently(13,600));
  for(let now=650;now<=1550;now+=100)gate.observe(13,now);
  assert(!gate.isReturning(13));gate.lost();assert(!gate.observe(13,2550));assert(gate.isReturning(13));
  assert(!gate.observe(13,2750));assert(gate.observe(13,3000));gate.submitted(13,3000);assert(!gate.isReturning(13));
  assert(!gate.observe(18,3100));assert(!gate.observe(18,3250));assert(gate.observe(18,3550));
  assert.deepEqual(activeElementIds([{text:"Primeiro.",elementIds:["a"]},{text:"Depois.",elementIds:["b"]}],12),["b"]);
});
check("camera isolation coordinates respect letterboxes and visual limits",()=>{
  assert.deepEqual(videoQuadInStage([[0,0],[800,0],[800,600],[0,600]],800,600,1600,900),[[12.5,0],[87.5,0],[87.5,100],[12.5,100]]);
  assert.deepEqual(videoQuadInStage([[0,0],[800,0],[800,600],[0,600]],800,600,600,1000),[[0,27.500000000000004],[100,27.500000000000004],[100,72.5],[0,72.5]]);
  const visual=normalizeTarotVisual({blur:100,dimming:-3,matrix:1});assert.equal(visual.blur,18);assert.equal(visual.dimming,0);assert.equal(visual.matrix,.8);
});
let state=createTarotState(),session="session-a",messages=[],events=[];
const controller=createTarotController({get:()=>state,set:(s)=>{state=s;},sessionId:()=>session,
  emit:(e)=>events.push(e),addMessage:(role,content,source)=>{const m={id:`message-${messages.length}`,role,content,source};messages.push(m);return m;},runTurn:async()=>{}});
const card={id:0,name:"O Louco",number:0,version:"v1",imageUrl:"/ref/0",elements:[]};
check("public/private separation and exclusive capture ownership",()=>{
  controller.control("instruction",{text:"private-only"});
  controller.control("claim-camera",{owner:"owner-a"});
  assert.throws(()=>controller.control("claim-camera",{owner:"owner-b"}),/OWNED/);
  assert.throws(()=>controller.control("camera-status",{owner:"owner-b",status:"live"}),/NOT_OWNER/);
  assert(!JSON.stringify(publicTarotSnapshot(state)).includes("private-only"));
  assert(!JSON.stringify(publicTarotSnapshot(state)).includes("owner-a"));
  controller.control("start");controller.control("select",{card,source:"camera",owner:"owner-a",inliers:34,matches:40});
  assert.equal(state.currentCard.source,"camera");
});
check("late replies and interrupted questions cannot count or overwrite a new card",()=>{
  const old=controller.begin({requestId:"request-old",question:"Pergunta antiga"});
  controller.control("select",{card:{...card,id:1},source:"manual-camera"});
  assert(old.controller.signal.aborted);
  assert.equal(controller.finish(old,{text:"stale",segments:[]},[]),false);
  assert.equal(state.answeredQuestions,0);
  assert.equal(state.currentCard.id,1);
  const job=controller.begin({requestId:"request-new",question:"Pergunta nova"});
  controller.fail(job,"OFFLINE");assert.equal(state.answeredQuestions,0);
  assert.equal(controller.begin({requestId:"request-new"}).duplicate,true);
});
check("autonomy waits for actual presentation acknowledgement, including reconnect progress",()=>{
  controller.control("config",{config:{questionsUntilAutonomy:1,automatic:true}});
  const job=controller.begin({requestId:"request-answer",question:"Uma máquina morre?"});
  controller.finish(job,{text:"Uma reflexão.",segments:[{text:"Uma reflexão.",elementIds:[]}]},[]);
  assert.equal(state.answeredQuestions,1);assert.equal(state.autonomy.status,"off");
  assert.throws(()=>controller.control("presented",{owner:"owner-a",responseId:state.response.id,chars:3}),/INCOMPLETE/);
  controller.control("progress",{owner:"owner-a",responseId:state.response.id,chars:6});assert.equal(state.response.presentedChars,6);
  controller.control("presented",{owner:"owner-a",responseId:state.response.id,chars:state.response.text.length});
  assert.equal(state.autonomy.status,"running");assert(canAutonomousTurn(state));
  controller.control("autonomy-pause");assert(!canAutonomousTurn(state));
  controller.control("autonomy-resume");state.autonomy.count=state.config.maxCards;assert(!canAutonomousTurn(state));
  controller.control("human");assert.equal(state.autonomy.status,"off");
});
check("STOP, session change and recovery never auto-resume capture or generation",()=>{
  const job=controller.begin({requestId:"stop-job"});controller.pause();assert(job.controller.signal.aborted);
  const late=controller.begin({requestId:"session-job"});session="session-b";assert(!controller.isCurrent(late));controller.cancel();
  const restored=restoredTarotState({...state,active:true,autonomy:{...state.autonomy,status:"running"}});
  assert.equal(restored.active,false);assert.equal(restored.camera.enabled,false);assert.equal(restored.camera.owner,null);assert.equal(restored.autonomy.status,"paused");
});
check("catalogue edits update shared anchors and cancel stale catalogue generations",()=>{
  controller.control("camera-status",{owner:"owner-a",metrics:{processingMs:8,inliers:42,matches:55}});
  assert(!("metrics" in publicTarotSnapshot(state)));
  const job=controller.begin({requestId:"catalog-edit"});
  controller.control("catalog-updated",{card:{...card,id:1,elements:[{id:"anchor",name:"Elemento",region:[.2,.2,.1,.1],validated:true}]}});
  assert(job.controller.signal.aborted);assert.equal(state.currentCard.elements[0].id,"anchor");
});

const directory=await fs.mkdtemp(path.join(os.tmpdir(),"tarot-catalog-test-"));
try {
  await fs.mkdir(path.join(directory,"assets/tarot"),{recursive:true});
  const original=await fs.readFile(path.join(root,"assets/tarot/0-louco.jpeg"));
  await fs.writeFile(path.join(directory,"assets/tarot/0-louco.jpeg"),original);
  process.chdir(directory);
  const {readCatalog,saveCatalogCard,referenceBytes}=await import(`../lib/tarot/catalog.js?test=${Date.now()}`);
  const cards=await readCatalog();assert.equal(cards.length,22);assert.equal(cards[8].name,"A Justiça");assert.equal(cards[11].name,"A Força");assert.equal(cards[1].status,"missing");
  await Promise.all([saveCatalogCard(0,{description:"Fotografia real",elements:[{id:"human",name:"Figura",region:[.2,.2,.3,.3],validated:true,origin:"operator"}]}),saveCatalogCard(1,{relations:"Relação cadastrada"})]);
  let saved=await readCatalog();assert.equal(saved[0].description,"Fotografia real");assert.equal(saved[0].elements[0].validated,true);assert.equal(saved[1].relations,"Relação cadastrada");
  await assert.rejects(saveCatalogCard(0,{},new File(["bad"],"bad.jpeg",{type:"image/jpeg"})),/INVALID/);
  await saveCatalogCard(0,{},new File([original],"reference.jpeg",{type:"image/jpeg"}));
  saved=await readCatalog();assert.equal(saved[0].elements.length,0);assert.equal((await referenceBytes(0)).mime,"image/jpeg");
  checks.push("22-card numbering, progressive catalogue, concurrent atomic metadata, validated anchors, reference upload and invalidation");
} finally {process.chdir(root);await fs.rm(directory,{recursive:true,force:true});controller.cancel();}
assert(messages.every((m)=>m.source.startsWith("tarot-")));assert(events.length>0);
console.log(JSON.stringify({ok:true,checks},null,2));
