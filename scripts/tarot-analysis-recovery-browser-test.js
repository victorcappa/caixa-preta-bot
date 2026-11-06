import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

// Real local tracker + supplied photos in synthetic video; model transport is
// intercepted. No active show, credential, physical camera or paid API is used.
const auditRoot=await prepareOperatorAudit(),base="http://127.0.0.1:3324";
assert.notEqual(path.resolve(auditRoot),process.cwd());
const output=await fs.mkdtemp("/private/tmp/tarot-recovery-");
const fixture=path.join(output,"model.json");
const configure=(config)=>fs.writeFile(fixture,JSON.stringify({compact:true,delay:100,...config}));
await configure({overlong:true,repairSucceeds:true});
await fs.writeFile(`${fixture}.calls.jsonl`,"");
let occupied=false;try{await fetch(base,{signal:AbortSignal.timeout(500)});occupied=true;}catch{}
assert(!occupied,"Audit port occupied; no process will be stopped");
const server=spawn(process.execPath,["--import",fileURLToPath(new URL("./tarot-model-mock.js",import.meta.url)),"node_modules/next/dist/bin/next","start","--port","3324","--hostname","127.0.0.1"],{
  cwd:auditRoot,env:{...process.env,OPENAI_API_KEY:"audit-only",CAIXA_PRETA_TAROT_MOCK:fixture,CAIXA_PRETA_SHOW_RUNTIME_DIR:path.join(output,"runtime")},stdio:["ignore","pipe","pipe"]});
let log="",browser,page,sessionId;const checks=[],errors=[];
server.stdout.on("data",(chunk)=>{log+=chunk;});server.stderr.on("data",(chunk)=>{log+=chunk;});
const state=async()=>(await fetch(base+"/api/tarot")).json();
const calls=async()=>(await fs.readFile(`${fixture}.calls.jsonl`,"utf8")).trim().split("\n").filter(Boolean).length;
async function post(route,data){const response=await fetch(base+route,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId,...data})});assert(response.ok);return response.json();}
async function poll(check,label,timeout=30000){const until=Date.now()+timeout;while(Date.now()<until){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error("Timeout: "+label);}
try{
  await poll(async()=>{try{return(await fetch(base+"/api/health?skipOptional=1")).ok;}catch{return false;}},"isolated server");
  sessionId=(await state()).sessionId;
  await post("/api/operator-public",{action:"patch",personality:{verbosity:0}});
  await post("/api/robot-sound",{settings:{typingIntervalMs:5,typingPauseMs:0,messageGapMs:0}});
  await post("/api/tarot",{action:"config",config:{floorEnabled:false,maxWords:60}});
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1920,height:1080},permissions:["camera"]});
  await context.addInitScript(()=>{
    let image,frame=0;
    window.__useCard=async(id)=>{image=new Image();image.src=`/api/tarot/reference/${id}`;await image.decode();};
    navigator.mediaDevices.getUserMedia=async()=>{
      await window.__useCard(2);
      const canvas=document.createElement("canvas");canvas.width=800;canvas.height=600;const ctx=canvas.getContext("2d");
      const draw=()=>{ctx.fillStyle="#45695a";ctx.fillRect(0,0,800,600);ctx.drawImage(image,210+Math.sin(frame++/18)*12,65,345,460);};
      draw();const timer=setInterval(draw,65),stream=canvas.captureStream(15);
      for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}return stream;
    };
  });
  page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
  await page.goto(base+"/treinamento");
  await post("/api/tarot",{action:"start"});
  await poll(async()=>(await state()).tarot.response?.status==="complete","recognized Sacerdotisa completes repaired reading");
  let current=(await state()).tarot;
  assert.equal(current.currentCard.id,2);assert.equal(await calls(),2);
  assert(current.response.text.split(/\s+/).length<=60);assert.equal(current.response.text.split("\n\n").length,3);
  await page.locator("aside article[data-element-id]").first().waitFor();
  const request=JSON.parse(await fs.readFile(`${fixture}.request.json`,"utf8"));
  assert(request.input.some(message=>message.content.includes("CORREÇÃO OBRIGATÓRIA:")));
  assert(!JSON.stringify(request).includes("input_image"));
  checks.push("Sacerdotisa recognized by real local tracker; oversized output corrected once; zero verbosity retains 60-word configured budget; reading and anchored elements appear");
  await configure({overlong:true});await page.evaluate(()=>window.__useCard(0));
  await poll(async()=>(await state()).tarot.generation==="failed","two invalid outputs fail visibly");
  assert.equal((await state()).tarot.error,"TAROT_NARRATIVE_TOO_LONG");assert.equal(await calls(),4);
  await page.getByRole("button",{name:"TENTAR NOVAMENTE",exact:true}).waitFor();
  assert(!(await page.locator("body").innerText()).includes("Os elementos surgem conforme a fala avança."));
  assert(!(await page.locator("body").innerText()).includes("TAROT_NARRATIVE_TOO_LONG"));
  await new Promise(resolve=>setTimeout(resolve,1400));assert.equal(await calls(),4,"stationary card cannot loop API calls");
  await page.screenshot({path:path.join(output,"failure-with-retry.png")});
  await configure({});await page.getByRole("button",{name:"TENTAR NOVAMENTE",exact:true}).click();
  await poll(async()=>(await state()).tarot.response?.status==="complete","same visible card retries successfully");
  assert.equal(await calls(),5);assert.equal((await state()).tarot.currentCard.id,0);
  checks.push("second invalid output surfaces failure; original private cause survives camera updates; no automatic loop; public retry restores same-card interpretation and progressive elements");
  await configure({failure:true});await page.evaluate(()=>window.__useCard(18));
  await poll(async()=>(await state()).tarot.generation==="failed","provider failure");
  assert.equal(await calls(),6);assert.notEqual((await state()).tarot.error,"TAROT_ANALYSIS_FAILED");
  await page.getByRole("button",{name:"TENTAR NOVAMENTE",exact:true}).waitFor();
  await configure({});await page.getByRole("button",{name:"TENTAR NOVAMENTE",exact:true}).click();
  await poll(async()=>(await state()).tarot.response?.status==="complete","provider recovery on same card");
  assert.equal(await calls(),7);
  const publicState=await(await fetch(base+"/api/state")).json();assert.equal(publicState.publicMessage,null);
  assert(publicState.conversation.some(message=>message.source==="tarot-response"));
  checks.push("provider failure never retries automatically or invents a reading; explicit retry recovers; shared history and Principal speech isolation preserved");
  await page.screenshot({path:path.join(output,"recovered-reading.png")});
  assert.deepEqual(errors,[]);
  const report={ok:true,checks,auditRoot,syntheticCamera:true,liveModel:false,physicalCameraValidated:false};
  await fs.writeFile(path.join(output,"result.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,output},null,2));
}catch(error){await page?.screenshot({path:path.join(output,"failure.png")}).catch(()=>{});throw error;}
finally{await browser?.close();server.kill("SIGTERM");await fs.writeFile(path.join(output,"server.log"),log);}
