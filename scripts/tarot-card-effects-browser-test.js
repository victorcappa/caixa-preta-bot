import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {prepareOperatorAudit} from './operator-public-audit-utils.js';
import {createTarotState} from '../lib/tarot/state.js';
import {builtInPreset,patchHallucination} from '../lib/tarot/hallucination.js';

const auditRoot=await prepareOperatorAudit(),output=await fs.mkdtemp('/private/tmp/tarot-card-effects-'),base='http://127.0.0.1:3317';
let occupied=false;try{await fetch(base,{signal:AbortSignal.timeout(400)});occupied=true;}catch{}assert(!occupied,'Audit port occupied; no process stopped');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3317','--hostname','127.0.0.1'],{cwd:auditRoot,env:{...process.env,OPENAI_API_KEY:'',CAIXA_PRETA_SHOW_RUNTIME_DIR:path.join(output,'runtime')},stdio:['ignore','pipe','pipe']});
let log='',browser;server.stdout.on('data',c=>log+=c);server.stderr.on('data',c=>log+=c);
try{
 const deadline=Date.now()+30000;let ready=false;while(Date.now()<deadline){try{if((await fetch(base+'/api/health?skipOptional=1')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,'Server ready');
 const catalog=await(await fetch(base+'/api/tarot/catalog')).json(),surface=[[.2,.15],[.8,.2],[.75,.85],[.15,.8]];
 catalog.cards.find(c=>c.id===8).surface=surface;
 const tarot=createTarotState();patchHallucination(tarot.hallucination,builtInPreset('carta-estranha'));
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/tarot',route=>{assert.equal(route.request().method(),'GET','Preview must not mutate show state');return route.fulfill({json:{sessionId:'card-only-preview',tarot,history:[]}});});
 await page.route('**/api/tarot/catalog',route=>route.fulfill({json:catalog}));
 await page.route('**/api/tarot/faces',route=>{assert.equal(route.request().method(),'GET');return route.fulfill({json:{faces:[],fusions:[],templates:[],sources:[]}});});
 await page.goto(base+'/treinamento/controle');await page.getByRole('button',{name:'11 — Testes',exact:true}).click();
 await page.getByRole('combobox',{name:/^Preset de teste/}).selectOption('carta-estranha');
 await page.getByRole('button',{name:'TESTAR ALUCINAÇÃO',exact:true}).click();
 const seek=page.getByRole('spinbutton',{name:'Posição da prévia (s)',exact:true});await seek.fill('10');await seek.blur();
 await page.waitForFunction(()=>{const c=document.querySelector('[data-tarot-effects]');if(!c||c.width<100)return false;const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return a.some((v,i)=>i%4===3&&v>0);});
 const pixels=await page.locator('[data-tarot-effects]').evaluate((c,surface)=>{
  const ctx=c.getContext('2d'),mask=document.createElement('canvas');mask.width=c.width;mask.height=c.height;const mc=mask.getContext('2d');
  mc.beginPath();surface.forEach(([x,y],i)=>mc[i?'lineTo':'moveTo'](x*c.width,y*c.height));mc.closePath();mc.fill();mc.lineWidth=3;mc.stroke();
  const a=ctx.getImageData(0,0,c.width,c.height).data,m=mc.getImageData(0,0,c.width,c.height).data;let painted=0,outside=0;
  for(let i=3;i<a.length;i+=4)if(a[i]){painted++;if(!m[i])outside++;}return {painted,outside};
 },surface);
 assert(pixels.painted>10000,'Visible card distortion');assert.equal(pixels.outside,0,'No effect pixels outside the projected card');
 const textPixels=await page.locator('[data-tarot-text-effects]').evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return a.some((v,i)=>i%4===3&&v>0);});assert.equal(textPixels,false,'Caption effects remain empty');
 await page.locator('[data-tarot-effects]').screenshot({path:path.join(output,'card-pixels.png')});await page.screenshot({path:path.join(output,'card-only.png'),fullPage:true});assert.deepEqual(errors,[]);

 // Real HTTP decisions and tracked video: a winning card keeps its draw when a losing second card joins.
 const initial=await(await fetch(base+'/api/tarot')).json(),sessionId=initial.sessionId;
 const command=async(action,data={})=>{const r=await fetch(base+'/api/tarot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,action,...data})});assert.equal(r.status,200,await r.text());};
 const state=async()=>(await(await fetch(base+'/api/tarot')).json()).tarot;
 const poll=async(predicate,label)=>{const deadline=Date.now()+30000;while(Date.now()<deadline){if(await predicate())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+label);};
 await command('config',{config:{autoAnalyze:false,floorEnabled:false}});await command('hallucination-preset',{name:'carta-estranha'});await command('hallucination',{patch:{randomEnabled:true,randomChance:100,afterCards:22,automatic:false}});
 const context=await browser.newContext();await context.addInitScript(()=>{
  window.__randomCards=[0];
  navigator.mediaDevices.getUserMedia=async()=>{const images=await Promise.all([0,13].map(async id=>{const img=new Image();img.src='/api/tarot/reference/'+id;await img.decode();return img;}));const c=document.createElement('canvas');c.width=800;c.height=600;const ctx=c.getContext('2d');const draw=()=>{ctx.fillStyle='#45695a';ctx.fillRect(0,0,800,600);for(const id of window.__randomCards)ctx.drawImage(images[id===0?0:1],id===0?70:440,80,270,430);};draw();const timer=setInterval(draw,65),stream=c.captureStream(15);stream.getTracks().forEach(t=>{const stop=t.stop.bind(t);t.stop=()=>{clearInterval(timer);stop();};});return stream;};
 });
 const projection=await context.newPage();projection.on('pageerror',e=>errors.push(e.message));await projection.goto(base+'/treinamento');await command('start');
 await poll(async()=>{const t=await state();return t.currentCard?.id===0&&t.hallucination.run.status==='playing';},'first card wins without waiting for 22');const firstDraw=(await state()).hallucination.run.randomDraws[0];
 await command('hallucination',{patch:{randomChance:0}});await projection.evaluate(()=>{window.__randomCards=[0,13];});
 await poll(async()=>{const t=await state();return t.currentCards.length===2&&t.hallucination.run.randomDraws?.length===2;},'separate pair decisions');let live=await state();assert.deepEqual(live.hallucination.run.randomDraws[0],firstDraw);assert.deepEqual(live.hallucination.run.randomDraws.map(d=>d.triggered),[true,false]);
 await projection.waitForFunction(()=>{const c=document.querySelector('[data-tarot-effects]');if(!c||c.width!==800)return false;const a=c.getContext('2d').getImageData(0,0,800,c.height).data;return a.some((v,i)=>i%4===3&&v>0);});
 const pairPixels=await projection.locator('[data-tarot-effects]').evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let left=0,right=0;for(let i=3;i<a.length;i+=4)if(a[i]){if(((i-3)/4)%c.width>400)right++;else left++;}return {left,right};});assert(pairPixels.left>0);assert.equal(pairPixels.right,0,'Losing card has no visual effect');await projection.screenshot({path:path.join(output,'random-pair.png')});
 await projection.evaluate(()=>{window.__randomCards=[13];});await poll(async()=>{const t=await state();return t.currentCard?.id===13&&t.hallucination.run.status==='stopped';},'losing card remains normal');
 await projection.evaluate(()=>{window.__randomCards=[0];});await poll(async()=>{const t=await state();return t.currentCard?.id===0&&t.hallucination.run.status==='stopped';},'new presentation loses at zero percent');
 await command('hallucination',{patch:{randomChance:100}});await new Promise(r=>setTimeout(r,1200));assert.equal((await state()).hallucination.run.status,'stopped','Editing chance does not redraw the visible card');
 await projection.evaluate(()=>{window.__randomCards=[];});await poll(async()=>(await state()).hallucination.run.absent,'confirmed loss');await new Promise(r=>setTimeout(r,1100));await projection.evaluate(()=>{window.__randomCards=[0];});await poll(async()=>(await state()).hallucination.run.status==='playing','stable return gets a fresh draw');
 assert.equal((await(await fetch(base+'/api/tarot')).json()).history.length,0,'Random draws do not invoke the language model');assert.deepEqual(errors,[]);await command('end');await context.close();
 const report={ok:true,synthetic:true,physicalWebcamValidated:false,pixels,textPixels,randomPerCard:true,pairPixels,auditRoot,output};await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();if(server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await ended;}await fs.writeFile(path.join(output,'server.log'),log);}
