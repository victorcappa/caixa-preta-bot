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
 const report={ok:true,synthetic:true,physicalWebcamValidated:false,pixels,textPixels,auditRoot,output};await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();if(server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await ended;}await fs.writeFile(path.join(output,'server.log'),log);}
