import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { prepareOperatorAudit } from "./operator-public-audit-utils.js";

// Isolated production build/catalogue; never touches the active port-3000 show.
const root=process.cwd(),auditRoot=process.env.CAIXA_PRETA_TAROT_AUDIT_ROOT||await prepareOperatorAudit();
const assets=path.join(auditRoot,"assets");
if((await fs.lstat(assets)).isSymbolicLink()){
  await fs.unlink(assets);await fs.mkdir(assets);
  for(const entry of await fs.readdir(path.join(root,"assets"))){
    if(entry==="tarot")await fs.cp(path.join(root,"assets",entry),path.join(assets,entry),{recursive:true});
    else await fs.symlink(path.join(root,"assets",entry),path.join(assets,entry));
  }
}
// Reusing a verified build still gets fresh editorial data and session state.
assert.notEqual(path.resolve(auditRoot),path.resolve(root));
await fs.copyFile(path.join(root,"assets/tarot/catalog.json"),path.join(assets,"tarot/catalog.json"));
const base="http://127.0.0.1:3312",output=process.env.CAIXA_PRETA_TAROT_OUTPUT||"/private/tmp/tarot-browser-evidence";
await fs.mkdir(output,{recursive:true});
let occupied=false;try{await fetch(base,{signal:AbortSignal.timeout(500)});occupied=true;}catch{}
assert(!occupied,"Audit port 3312 occupied; no process will be stopped");
const completeQuestion="quem aqui pede para chegar sem escolher o caminho?";
const fixture=path.join(auditRoot,"tarot-mock.json");await fs.writeFile(fixture,JSON.stringify({segments:2,delay:500,association:`Cena teatral: um transporte que promete chegada enquanto recicla a ideia de progresso — tecnologia/arquivo que move corpos e delega controle. Pergunta curta para a plateia: ${completeQuestion}`}));
await fs.writeFile(`${fixture}.calls.jsonl`,"");
let log="";
const server=spawn(process.execPath,["--import",fileURLToPath(new URL("./tarot-model-mock.js",import.meta.url)),"node_modules/next/dist/bin/next","start","--port","3312","--hostname","127.0.0.1"],{
  cwd:auditRoot,env:{...process.env,OPENAI_API_KEY:"audit-only",CAIXA_PRETA_TAROT_MOCK:fixture,CAIXA_PRETA_SHOW_RUNTIME_DIR:await fs.mkdtemp(path.join(auditRoot,"runtime-"))},stdio:["ignore","pipe","pipe"]});
server.stdout.on("data",(c)=>{log+=c;});server.stderr.on("data",(c)=>{log+=c;});
const checks=[],errors=[];let browser,sessionId,projection;
const state=async()=>(await fetch(`${base}/api/state`)).json();
const privateState=async()=>(await fetch(`${base}/api/tarot`)).json();
const calls=async()=>(await fs.readFile(`${fixture}.calls.jsonl`,"utf8")).trim().split("\n").filter(Boolean).length;
async function post(route,body,status=200){const response=await fetch(base+route,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;}
async function command(action,data={},status=200){return post("/api/tarot",{sessionId,action,...data},status);}
async function poll(predicate,label,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){if(await predicate())return;await new Promise((resolve)=>setTimeout(resolve,75));}throw new Error(`Timeout: ${label}`);}
async function complete(){await poll(async()=>(await state()).tarot.response?.status==="complete","presentation complete");}
try{
  await poll(async()=>{try{return(await fetch(`${base}/api/health?skipOptional=1`)).ok;}catch{return false;}},"server",30000);
  sessionId=(await state()).reliability.sessionId;const before=await state();
  await post("/api/tarot",{sessionId:"wrong",action:"start"},409);
  const badOrigin=await fetch(base+"/api/tarot",{method:"POST",headers:{"content-type":"application/json",origin:"https://invalid.example"},body:JSON.stringify({sessionId,action:"start"})});assert.equal(badOrigin.status,403);
  const catalog=async()=>(await(await fetch(base+"/api/tarot/catalog")).json()).cards;
  const cards=await catalog();assert.equal(cards.filter((c)=>c.preparation.inventory).length,22);assert(cards.every((c)=>c.preparation.verifiedAnchors>=5));
  checks.push("22 supplied images arrive with complete reviewed inventories; session/origin checks preserved");
  browser=await chromium.launch({headless:true,args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]});
  const context=await browser.newContext({viewport:{width:1920,height:1080},permissions:["camera"]});
  await context.addInitScript(()=>{
    let currentImage=null,pair=[],blank=false,move=true,frame=0,floor=false,floorCount=22,back=null,removed=new Set();
    const load=async(id)=>{const image=new Image();image.src=id==="back"?"/api/tarot/back":`/api/tarot/reference/${id}`;await image.decode();return image;};
    window.__tarotUseCard=async(id)=>{currentImage=await load(id);pair=[];floor=false;blank=false;};
    window.__tarotUsePair=async(ids)=>{pair=await Promise.all(ids.map(load));floor=false;blank=false;};
    window.__tarotFloor=async(count=22)=>{back ||= await load("back");floor=true;floorCount=count;removed=new Set();blank=false;};
    window.__tarotRemoveFloor=(quad)=>{const center=quad.reduce((c,p)=>[c[0]+p[0]*800/4,c[1]+p[1]*600/4],[0,0]);let best=0,d=Infinity;for(let i=0;i<floorCount;i++){const distance=Math.hypot(center[0]-(35+i%6*122+46),center[1]-(25+Math.floor(i/6)*140+62.5));if(distance<d){d=distance;best=i;}}removed.add(best);};
    window.__tarotBlank=(value)=>{blank=value;};window.__tarotMotion=(value)=>{move=value;};
    navigator.mediaDevices.getUserMedia=async()=>{
      if(!currentImage)await window.__tarotUseCard(13);
      const canvas=document.createElement("canvas");canvas.width=800;canvas.height=600;const ctx=canvas.getContext("2d");
      const draw=()=>{ctx.fillStyle="#45695a";ctx.fillRect(0,0,800,600);for(let x=0;x<800;x+=16){ctx.fillStyle=x%32?"#436758":"#74917c";ctx.fillRect(x,0,8,600);}if(move)frame++;
        if(blank)return;
        if(floor&&back){for(let i=0;i<floorCount;i++)if(!removed.has(i))ctx.drawImage(back,35+i%6*122,25+Math.floor(i/6)*140,92,125);}
        else if(pair.length)pair.forEach((image,i)=>ctx.drawImage(image,70+i*370+Math.sin(frame/18)*10,80,270,430));
        else if(currentImage)ctx.drawImage(currentImage,210+Math.sin(frame/18)*32,65,345,460);
      };
      draw();const timer=setInterval(draw,65),stream=canvas.captureStream(15);
      for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}return stream;
    };
    addEventListener("DOMContentLoaded",()=>{
      window.__revealSamples=[];let last="";
      new MutationObserver(()=>{const main=document.querySelector("main[data-response-id]");if(!main)return;const ids=[...main.querySelectorAll("aside article[data-element-id]")].map((e)=>e.dataset.elementId),key=main.dataset.responseId+":"+ids.join("+");if(key!==last){last=key;window.__revealSamples.push({response:main.dataset.responseId,ids});}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["data-response-id"]});
    });
  });
  projection=await context.newPage();const operator=await context.newPage(),main=await context.newPage();
  for(const page of [projection,operator,main])page.on("pageerror",(e)=>errors.push(e.message));
  await main.goto(base+"/");await main.getByLabel("Cursor da Caixa Preta",{exact:true}).waitFor();
  await projection.goto(base+"/treinamento");await projection.getByRole("heading",{name:"TARÔ / TREINAMENTO",exact:true}).waitFor();
  assert(!/caixa\s+preta/i.test(await projection.locator("body").innerText()));assert.equal(await projection.locator("textarea,button,input").count(),0);
  await operator.goto(base+"/operator");assert.equal(await operator.getByRole("button",{name:"PREPARAR BARALHO",exact:true}).count(),0);
  await operator.getByRole("link",{name:/TREINAMENTO · ABRIR/}).click();
  await operator.waitForURL(base+"/treinamento/controle");await operator.getByRole("heading",{name:"TARÔ / TREINAMENTO",exact:true}).waitFor();
  await operator.getByRole("link",{name:"TARÔ",exact:true}).waitFor();
  assert.equal(new URL(projection.url()).pathname,"/treinamento","opening controls must not navigate the projection");
  await post("/api/robot-sound",{settings:{typingIntervalMs:20,typingPauseMs:0,messageGapMs:0}});
  await operator.getByRole("button",{name:"INICIAR PRÓLOGO",exact:true}).click();
  await poll(async()=>(await state()).tarot.response?.status==="presenting","A Morte starts interpretation automatically");
  const automatic=(await state()).tarot;assert.equal(automatic.currentCard.id,13);assert(automatic.response.elements.length>=5);
  const [first,second]=automatic.response.segments.map((s)=>s.elementIds[0]);
  const sideItem=(id)=>projection.locator(`aside article[data-element-id="${id}"]`);
  await sideItem(first).waitFor();assert.equal(await sideItem(second).count(),0,"second element waits for its structured segment");
  assert.equal(automatic.response.text.split("\n\n").length,3);assert(automatic.response.text.split(/\s+/).length<=90);
  await projection.evaluate(()=>window.__tarotBlank(true));
  await poll(async()=>(await state()).tarot.response?.status==="interrupted","loss interrupts the spoken text");
  const stopped=(await state()).tarot.response.presentedChars;await new Promise((r)=>setTimeout(r,800));assert.equal((await state()).tarot.response.presentedChars,stopped);
  await projection.evaluate(()=>window.__tarotBlank(false));
  await poll(async()=>(await state()).tarot.response?.status==="presenting","stable return resumes the exact response");assert.equal((await state()).tarot.response.id,automatic.response.id);assert.equal(await calls(),1);
  await complete();await sideItem(second).waitFor();
  assert((await state()).tarot.response.text.endsWith(completeQuestion),"word target must not cut the final question in mid-sentence");
  assert(!/Cena teatral:|Pergunta curta para a plateia:/.test((await state()).tarot.response.text));
  await projection.getByText(new RegExp(completeQuestion.replace(/\?/g,"\\?"))).waitFor();
  assert.equal(await projection.locator('[class*="speechText"] [class*="cursor"]').count(),0,"completed speech must not keep a pending cursor");
  assert.equal((await privateState()).tarot.answeredQuestions,0);assert.equal(await calls(),1);
  assert.equal((await state()).publicMessage,null,"tarot cannot publish speech on the main stage before boot");
  assert((await state()).conversation.some((m)=>m.source==="tarot-response"),"shared conversational memory remains available");
  await main.getByLabel("Cursor da Caixa Preta",{exact:true}).waitFor();
  assert.equal(await main.locator('[class*="messageFrame"]').count(),0);
  assert.notEqual(await main.getByLabel("Cursor da Caixa Preta",{exact:true}).evaluate((e)=>getComputedStyle(e).animationName),"none");
  await main.reload();await main.getByLabel("Cursor da Caixa Preta",{exact:true}).waitFor();
  assert.equal(await main.locator('[class*="messageFrame"]').count(),0,"reopening main cannot hydrate tarot speech");
  await main.screenshot({path:path.join(output,"principal-cursor-durante-tarot.png")});
  const annotation=projection.locator(`g[data-element-id="${first}"] polygon`);await annotation.waitFor();const firstPoints=await annotation.getAttribute("points");
  await poll(async()=>(await annotation.getAttribute("points"))!==firstPoints,"anchored SVG moves");
  const sharp=projection.locator("canvas[data-card-isolation]").first();assert((await sharp.getAttribute("style")).includes("polygon("));
  assert((await projection.locator("video").evaluate((v)=>getComputedStyle(v).filter)).includes("blur(5px)"));
  assert.equal(await sharp.evaluate((v)=>getComputedStyle(v).filter),"none");
  await projection.screenshot({path:path.join(output,"morte-automatic-isolation-1920x1080.png")});
  await new Promise((resolve)=>setTimeout(resolve,1600));assert.equal(await calls(),1,"movement cannot generate duplicate interpretations");
  const request=JSON.parse(await fs.readFile(`${fixture}.request.json`,"utf8"));assert(!JSON.stringify(request).includes("input_image"));assert(!JSON.stringify(request).includes("data:image"));assert(!request.tools);
  checks.push("physical-card photo in synthetic video triggers automatic text-only analysis; segment IDs reveal sidebar/SVG in order without duplicate calls");
  const previousId=(await state()).tarot.response.id;
  await projection.evaluate(()=>window.__tarotBlank(true));await poll(async()=>(await projection.locator('[data-focused="true"]').count())===0,"isolation clears on loss");
  await new Promise((resolve)=>setTimeout(resolve,1000));await projection.evaluate(()=>window.__tarotBlank(false));
  await poll(async()=>(await projection.locator('[data-focused="true"]').count())>0,"tracking recovers");
  await new Promise((resolve)=>setTimeout(resolve,1300));assert.equal(await calls(),1);assert.equal((await state()).tarot.response.id,previousId);
  await projection.evaluate(()=>window.__tarotUseCard(18));await poll(async()=>(await state()).tarot.currentCard?.id===18&&((await state()).tarot.response?.status==="complete"),"new card automatic analysis");
  assert.equal(await calls(),2);
  const response18=(await state()).tarot.response.id;
  const firstReveal=await projection.evaluate((id)=>window.__revealSamples.find((s)=>s.response===id),response18);assert(firstReveal&&firstReveal.ids.length<=1,"new response cannot flash every sidebar element before typing");
  assert(!/CÂMERA AO VIVO|VISÃO COMPUTACIONAL|INTERPRETAÇÃO.*DIÁLOGO.*AUTONOMIA/.test(await projection.locator("body").innerText()));
  assert(await projection.locator('[class*="speechText"]').evaluate((e)=>parseFloat(getComputedStyle(e).fontSize)>=38));
  await operator.getByRole("button",{name:"02 — Câmera e reconhecimento",exact:true}).click();
  await operator.getByLabel("Análise automática",{exact:true}).uncheck();
  await poll(async()=>(await privateState()).tarot.config.autoAnalyze===false,"automatic off");
  await projection.evaluate(()=>window.__tarotUseCard(0));await poll(async()=>(await state()).tarot.currentCard?.id===0,"recognition remains on");
  await new Promise((resolve)=>setTimeout(resolve,1300));assert.equal(await calls(),2);assert.equal((await state()).tarot.response,null);
  await operator.getByLabel("Análise automática",{exact:true}).check();
  await poll(async()=>(await state()).tarot.currentCard?.id===0&&(await state()).tarot.response?.status==="complete","automatic enabled on an already recognized card");
  assert.equal(await calls(),3);
  await command("config",{config:{repeatOnReturn:true}});await projection.evaluate(()=>window.__tarotBlank(true));
  await new Promise((resolve)=>setTimeout(resolve,1400));await projection.evaluate(()=>window.__tarotBlank(false));
  await poll(async()=>(await calls())===4,"repeat on return");await complete();
  await command("config",{config:{repeatOnReturn:false}});await command("camera",{automatic:false});
  await command("camera",{enabled:false});
  await poll(async()=>projection.locator("video").evaluate((v)=>v.srcObject===null),"camera stops and releases source");
  await command("camera",{enabled:true});
  await poll(async()=>(await projection.locator('[data-focused="true"]').count())>0,"camera restart rearms tracking and sharp layer");
  assert.equal(await calls(),4,"camera restart preserves the current interpretation");
  checks.push("loss freezes speech and audio progression; stable return resumes exact cursor without a model call; final question stays complete at word target and completion removes pending cursor; no label leakage or sidebar flash; concise three-paragraph text is larger and public chrome is removed");
  await command("camera",{automatic:true});await projection.evaluate(()=>window.__tarotUsePair([0,13]));
  await poll(async()=>(await state()).tarot.currentCards?.length===2&&(await state()).tarot.response?.status==="complete","joint interpretation of two simultaneous cards",30000);
  assert.equal(await calls(),5);assert.equal((await state()).tarot.response.text.split("\n\n").length,3);
  const jointRequest=JSON.parse(await fs.readFile(`${fixture}.request.json`,"utf8"));assert.equal(JSON.parse(jointRequest.input.at(-1).content).cards.length,2);
  assert.equal(await projection.locator('g[data-card-id]').count(),2);assert.equal(await projection.locator('canvas[data-card-isolation]').evaluateAll((nodes)=>nodes.filter((n)=>getComputedStyle(n).opacity==="1").length),2);
  await projection.screenshot({path:path.join(output,"two-cards-joint-interpretation.png")});
  assert.equal((await state()).publicMessage,null,"a joint tarot reading cannot publish main speech");
  await main.getByLabel("Cursor da Caixa Preta",{exact:true}).waitFor();
  await command("camera",{automatic:false});await command("select",{cardId:0,source:"manual-camera"});

  await operator.getByRole("button",{name:"Visual",exact:true}).click();
  const blur=operator.getByRole("slider",{name:"Desfoque do fundo",exact:true});await blur.fill("9");await blur.press("Tab");
  await poll(async()=>(await privateState()).tarot.visual.blur===9,"visual setting shared");
  await poll(async()=>(await projection.locator("video").evaluate((v)=>getComputedStyle(v).filter)).includes("blur(9px)"),"visual applied publicly");
  await operator.getByRole("combobox",{name:"Formato Matrix",exact:true}).selectOption("orbits");
  await poll(async()=>(await privateState()).tarot.visual.matrixStyle==="orbits","editable Matrix field shared");
  await operator.getByLabel("Alfabeto de símbolos",{exact:true}).fill("☉ ☽ ∞ ◇");await operator.getByLabel("Alfabeto de símbolos",{exact:true}).press("Tab");
  await poll(async()=>(await state()).tarot.visual.matrixSymbols==="☉ ☽ ∞ ◇","custom glyph alphabet public");
  await operator.getByRole("button",{name:"RESTAURAR VISUAL",exact:true}).click();
  await operator.getByRole("button",{name:"04 — Baralho",exact:true}).click();
  await operator.getByRole("button",{name:"PREPARAR BARALHO",exact:true}).click();
  await operator.getByText("22 referências preparadas. Descritores salvos neste navegador.",{exact:true}).waitFor();assert.equal(await calls(),5,"preprocessing never invokes the model");
  await operator.getByRole("button",{name:"EDITAR CARTA 0",exact:true}).click();
  await operator.getByLabel("Elemento",{exact:true}).selectOption({label:"Astro encoberto · validado"});
  const anchorEditor=operator.locator('[class*="anchorImage"] svg');await anchorEditor.scrollIntoViewIfNeeded();const bounds=await anchorEditor.boundingBox();
  await operator.mouse.move(bounds.x+bounds.width*.274,bounds.y+bounds.height*.288);await operator.mouse.down();await operator.mouse.move(bounds.x+bounds.width*.402,bounds.y+bounds.height*.371,{steps:5});await operator.mouse.up();
  await operator.getByLabel("Âncora revisada sobre esta fotografia",{exact:true}).check();
  await operator.getByRole("button",{name:"SALVAR CARTA E ÂNCORAS",exact:true}).click();await operator.getByText("Carta e âncoras salvas localmente.",{exact:true}).waitFor();
  assert((await catalog())[0].elements.every((e)=>e.validated));
  await post("/api/tarot/catalog",{sessionId,id:0,patch:{contingency:"Uma fala cadastrada, sem geração nova."}});
  checks.push("independent sectioned controls; live visual settings; free descriptor preparation; manual anchor editor preserved");
  await operator.getByRole("button",{name:"03 — Conversa",exact:true}).click();
  await operator.getByLabel("Pergunta ao bot",{exact:true}).fill("O que esta imagem sugere?");await operator.getByRole("button",{name:"ENVIAR PERGUNTA",exact:true}).click();
  await poll(async()=>(await privateState()).tarot.answeredQuestions===1,"count only answered question");await complete();
  await command("instruction",{text:"PRIVATE-TEST-SECRET"});assert(!JSON.stringify((await state()).tarot).includes("PRIVATE-TEST-SECRET"));
  await command("config",{config:{questionsUntilAutonomy:2,automatic:true,intervalMs:1000,maxCards:2}});
  await command("ask",{question:"Uma máquina pode desaparecer?",requestId:"browser-question-2"});
  assert.equal((await privateState()).tarot.autonomy.status,"off");
  await poll(async()=>(await state()).tarot.currentCard?.source==="bot","bounded autonomy starts after presentation");
  await projection.getByText("CARTA ESCOLHIDA PELO BOT",{exact:true}).waitFor();await command("autonomy-pause");
  await command("human");await command("select",{cardId:0,source:"manual-camera"});await command("contingency");await complete();
  await projection.getByText("CONTEÚDO CADASTRADO",{exact:true}).waitFor();
  await fs.writeFile(fixture,JSON.stringify({delay:1800}));const late=command("ask",{question:"Resposta atrasada",requestId:"browser-late"});
  await poll(async()=>(await privateState()).tarot.generation==="pending","pending generation");await command("select",{cardId:2,source:"manual-camera"});await late;
  assert.equal((await state()).tarot.currentCard.id,2);assert.equal((await state()).tarot.response,null);
  await projection.evaluate(()=>window.__tarotUseCard(2));await poll(async()=>await projection.locator('g[data-card-id="2"]').count()>0,"manual camera correction stays geometrically tracked");
  await fs.writeFile(fixture,JSON.stringify({failure:true}));await command("ask",{question:"Sem API",requestId:"browser-offline"});
  assert.equal((await privateState()).tarot.generation,"failed");assert.equal((await privateState()).tarot.answeredQuestions,2);
  assert.equal((await state()).sceneZero.stage,before.sceneZero.stage);assert.equal((await state()).reliability.sessionId,sessionId);
  await fs.writeFile(fixture,JSON.stringify({delay:100,segments:2}));
  await command("config",{config:{autoAnalyze:false}});await projection.evaluate(()=>window.__tarotBlank(true));
  await poll(async()=>await projection.locator('g[data-card-id]').count()===0,"clear previous card before resetting the six-card test");
  // Drain the worker's in-flight photo before enabling a fresh count. An empty
  // SVG alone can precede the next blank video frame in the synthetic stream.
  await new Promise((resolve)=>setTimeout(resolve,2000));
  await command("floor-reset");
  await projection.evaluate(()=>window.__tarotUseCard(0));
  await command("select",{cardId:0,source:"manual-camera"});
  await poll(async()=>await projection.locator('g[data-card-id="0"]').count()>0,"first counted card visible before enabling automatic analysis");
  await command("config",{config:{autoAnalyze:true,automatic:false,floorEnabled:true,floorAfterCards:6,revealSpeed:4}});await command("camera",{automatic:true});
  for(let id=0;id<6;id++){
    await projection.evaluate((id)=>window.__tarotUseCard(id),id);
    await poll(async()=>{const t=(await privateState()).tarot;return t.currentCard.id===id&&t.readCards.includes(id)&&t.readCards.length===id+1;},`completed reading ${id+1}/6 before the floor`,30000);
    if(id<5)assert.equal((await state()).tarot.floor.phase,"idle");
  }
  await poll(async()=>(await state()).tarot.floor.phase==="scanning","six readings trigger invitation then scan",20000);
  await projection.evaluate(()=>window.__tarotFloor(21));await new Promise((r)=>setTimeout(r,2200));assert.equal((await state()).tarot.floor.selected,null,"21 backs cannot start a 22-card choice");
  await projection.evaluate(()=>window.__tarotFloor(22));
  await poll(async()=>(await state()).tarot.floor.phase==="await-removal","22 stable actual backs and spoken positional instruction",30000);
  const chosen=(await state()).tarot.floor.selected;await projection.locator(`[data-floor-choice="${chosen.slot}"]`).waitFor();
  assert(/da direita para a esquerda/.test((await state()).tarot.response.text));
  await projection.screenshot({path:path.join(output,"floor-22-backs-selected.png")});
  await projection.evaluate((quad)=>window.__tarotRemoveFloor(quad),chosen.quad);
  await poll(async()=>(await state()).tarot.floor.phase==="await-reveal","selected position removed while 21 others remain",30000);
  await projection.evaluate(()=>window.__tarotUseCard(17));
  await poll(async()=>(await state()).tarot.floor.phase==="closing","interpretation of chosen revealed face completes",30000);
  await poll(async()=>(await state()).tarot.floor.phase==="complete","authored learning/next-training closing completes",20000);
  await projection.getByText(/Vamos embaralhar realidades e ver o que elas nos contam/).waitFor();
  checks.push("two tracked faces receive one joint reading; editable Matrix symbols/styles; six distinct completed readings lead to all 22 verified backs; spatial highlight/instruction, selected removal, revealed-face interpretation and next-training closing");
  await command("end");await projection.waitForURL((url)=>url.pathname==="/");assert.equal((await state()).reliability.sessionId,sessionId);
  assert.equal((await state()).publicMessage,null,"floor instructions and closing cannot publish main speech");
  await projection.getByLabel("Cursor da Caixa Preta",{exact:true}).waitFor();
  await main.reload();await main.getByLabel("Cursor da Caixa Preta",{exact:true}).waitFor();
  checks.push("main projection stays on its blinking cursor before boot, including reload with tarot history; tarot readings, questions, floor stages, closing and return to Principal never publish main speech");
  await projection.goto(base+"/treinamento?projectionWindow=tarot-reconnect");await projection.getByRole("heading",{name:"TARÔ / TREINAMENTO",exact:true}).waitFor();assert.equal((await state()).tarot.active,false);
  await projection.setViewportSize({width:390,height:844});await projection.screenshot({path:path.join(output,"treinamento-390x844.png")});assert(await projection.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
  await operator.setViewportSize({width:1440,height:900});await operator.getByRole("button",{name:"01 — Apresentação",exact:true}).click();await operator.screenshot({path:path.join(output,"controle-1440x900.png")});
  checks.push("shared conversation/personality/session; counted questions; presentation gate; autonomy; contingency; late replies; failure; end to Principal and reconnect");
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(output,"result.json"),JSON.stringify({ok:true,syntheticCamera:true,liveModel:false,checks,auditRoot},null,2));
  console.log(JSON.stringify({ok:true,checks,output,auditRoot},null,2));
}catch(error){if(projection)await projection.screenshot({path:path.join(output,"failure.png")}).catch(()=>{});throw error;}
finally{await browser?.close();server.kill("SIGTERM");await fs.writeFile(path.join(output,"server.log"),log);}
