import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareOperatorAudit } from './operator-public-audit-utils.js';

// Always starts its own isolated production copy and runtime; never uses the show on port 3000.
const auditRoot = await prepareOperatorAudit();
const output = await fs.mkdtemp(path.join(os.tmpdir(), 'caixa-composition-evidence-'));
const base='http://127.0.0.1:3321';
let occupied=false;
try { await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)});occupied=true; } catch {}
assert(!occupied,'Audit port 3321 is occupied; no existing process will be stopped.');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3321','--hostname','127.0.0.1'],{
 cwd:auditRoot,env:{...process.env,OPENAI_API_KEY:'',CAIXA_PRETA_SHOW_RUNTIME_DIR:path.join(output,'runtime')},stdio:['ignore','pipe','pipe']
});
let serverLog='';server.stdout.on('data',chunk=>{serverLog+=chunk;});server.stderr.on('data',chunk=>{serverLog+=chunk;});
let browser;
try {
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  if(server.exitCode!==null)throw new Error(serverLog.slice(-3000));
  try { const response=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;} } catch {}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert(ready,'Audit server did not start');
const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const value=await r.json();assert(r.ok,JSON.stringify(value));return value;};
browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1920,height:1080}});
const errors=[];
context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
context.setDefaultTimeout(15000);
const checks=[];
 const state=await (await fetch(base+'/api/state')).json();
 const sessionId=state.reliability.sessionId;
 await post('/api/operator-public',{action:'patch',visible:false,composition:{modules:Object.fromEntries(Object.keys(state.operatorPublic.composition.modules).map(id=>[id,null]))}});
 await post('/api/tarot',{sessionId,action:'config',config:{autoAnalyze:false}});
 await post('/api/tarot',{sessionId,action:'select',cardId:0});
 const tarot=await context.newPage();
 // Synthetic narrative only: no live model or camera request is required for layout QA.
 await tarot.route('**/api/events?*',route=>route.abort());
 await tarot.route('**/api/state*',async route=>{
  const response=await route.fetch();const state=await response.json();
  if(state.tarot)state.tarot.response={id:'layout-fixture',text:'Uma figura atravessa o limite.\n\nO passo transforma a dúvida em movimento.\n\nQuem escolhe a direção?',status:'complete',origin:'catalog',presentedChars:150,elements:[],segments:[]};
  await route.fulfill({response,json:state});
 });
 await tarot.goto(base+'/treinamento');
 await tarot.locator('[data-public-module="tarot-speech"] h2').filter({hasText:'Louco'}).waitFor();
 const speech=tarot.locator('[data-public-module="tarot-speech"]');
 const vision=tarot.locator('[data-public-module="tarot-vision"]');
 let a=await speech.boundingBox(),b=await vision.boundingBox();
 assert(a.y+a.height<=b.y+2,'reading must be above camera');
 assert.equal(await speech.locator('[class*="speechText"]').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)),48);
 await tarot.screenshot({path:path.join(output,'tarot-top.png')});
 checks.push('Tarot: card name above synthetic reading, 48px text, reading above camera');
 const operator=await context.newPage();await operator.goto(base+'/operator');
 await operator.getByText('COMPOSIÇÃO DA TELA PÚBLICA',{exact:true}).click();
 await operator.getByRole('button',{name:'BRANCO',exact:true}).click();
 await operator.getByLabel('Componente',{exact:true}).selectOption('tarot-speech');
 await operator.getByLabel('X do componente',{exact:true}).fill('8');
 await operator.getByLabel('Y do componente',{exact:true}).fill('10');
 await operator.getByLabel('Largura do componente',{exact:true}).fill('80');
 await operator.getByLabel('Altura do componente',{exact:true}).fill('30');
 await operator.getByText('Composição sincronizada.',{exact:true}).waitFor();
 await tarot.waitForFunction(()=>document.querySelector('[data-public-module="tarot-speech"]').style.left==='8%');
 a=await speech.boundingBox();b=await vision.boundingBox();
 assert(Math.abs(a.x-1920*.08)<2);assert(Math.abs(a.width-1920*.8)<2);assert(b.y>a.y+a.height);
 checks.push('Private controls update only selected public Tarot module through shared state');
 const selected=operator.locator('[data-composition-preview] [data-selected="true"]');
 await selected.scrollIntoViewIfNeeded();
 let box=await selected.boundingBox();await operator.mouse.move(box.x+40,box.y+20);await operator.mouse.down();await operator.mouse.move(box.x+70,box.y+35,{steps:5});await operator.mouse.up();
 await operator.getByText('Composição sincronizada.',{exact:true}).waitFor();
 const afterDrag=await (await fetch(base+'/api/state')).json();assert(afterDrag.operatorPublic.composition.modules['tarot-speech'].x>8);
 const handle=selected.getByRole('button');box=await handle.boundingBox();await operator.mouse.move(box.x+12,box.y+12);await operator.mouse.down();await operator.mouse.move(box.x-20,box.y-10,{steps:4});await operator.mouse.up();
 await operator.getByText('Composição sincronizada.',{exact:true}).waitFor();
 const afterResize=await (await fetch(base+'/api/state')).json();assert(afterResize.operatorPublic.composition.modules['tarot-speech'].width<80);
 await tarot.reload();await tarot.waitForFunction(()=>document.querySelector('[data-public-module="tarot-speech"]').dataset.moduleCustom==='true');
 checks.push('Drag, resize and public reload preserve module geometry');
 await post('/api/operator-public',{action:'patch',visible:true});
 const display=await context.newPage();await display.goto(base+'/');
 await display.waitForFunction(()=>getComputedStyle(document.querySelector('[aria-label="Operator público"]')).color==='rgb(255, 255, 255)');
 assert.equal(await display.getByText('COMPOSIÇÃO DA TELA PÚBLICA',{exact:true}).count(),0);
 const color=await display.locator('[data-public-module="operator-personality"] label').first().evaluate(e=>getComputedStyle(e).color);assert.equal(color,'rgb(255, 255, 255)');
 await display.waitForFunction(()=>Math.abs(document.querySelector('[data-public-module="operator-rail"]').getBoundingClientRect().x-1248)<2);
 await display.screenshot({path:path.join(output,'operator-white.png')});
 checks.push('Operator white color reaches public labels; editing controls stay private');
 await operator.getByRole('button',{name:'RESTAURAR COMPONENTE',exact:true}).click();
 await operator.getByText('Composição sincronizada.',{exact:true}).waitFor();
 await tarot.waitForFunction(()=>document.querySelector('[data-public-module="tarot-speech"]').dataset.moduleCustom==='false');
 checks.push('Per-module reset restores default layout');

 const fixturePage=await context.newPage();
 let fixtureStatus='BOOTING';
 await fixturePage.route('**/api/events?*',route=>route.abort());
 await fixturePage.route('**/api/state*',async route=>{
  const response=await route.fetch();const value=await response.json();
  if(value.sceneZero){value.operatorPublic.visible=false;value.sceneZero.unlock={...value.sceneZero.unlock,status:fixtureStatus,bootStep:5,bootProgress:60,progress:20,soundEnabled:false};}
  await route.fulfill({response,json:value});
 });
 await fixturePage.goto(base+'/');
 await fixturePage.getByLabel('BIOS da Cena 0',{exact:true}).waitFor();
 assert(await fixturePage.locator('[class*="biosLines"] p').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=18);
 await fixturePage.waitForFunction(()=>Array.from(document.querySelectorAll('[class*="biosLines"] p')).every(e=>Number(getComputedStyle(e).opacity)>.9));
 await fixturePage.screenshot({path:path.join(output,'bios-large.png')});
 fixtureStatus='WARMING_AUDIENCE';await fixturePage.reload();
 await fixturePage.locator('[data-unlock-hud] [role="progressbar"]').waitFor();
 assert((await fixturePage.locator('[data-unlock-hud] [role="progressbar"]').boundingBox()).height>=28);
 await post('/api/operator-public',{action:'patch',composition:{modules:{'main-status':{x:10,y:20,width:60,height:50}}}});
 await fixturePage.waitForFunction(()=>document.querySelector('[data-public-module="main-status"]').style.left==='10%');
 const statusBox=await fixturePage.locator('[data-public-module="main-status"]').boundingBox();
 assert(Math.abs(statusBox.x-192)<2);assert(Math.abs(statusBox.width-1152)<2);
 checks.push('BIOS larger text, thicker progress bar and independent Principal module bounds');
 assert.deepEqual(errors,[]);
 const report={ok:true,checks,liveModel:false,physicalCamera:false,output};
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
} finally { await browser?.close();server.kill('SIGTERM');await fs.writeFile(path.join(output,'server.log'),serverLog); }
