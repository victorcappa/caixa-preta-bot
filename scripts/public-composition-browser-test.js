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
 let fixtureText='Uma figura atravessa o limite.\n\nO passo transforma a dúvida em movimento.\n\nQuem escolhe a direção?';
 // Synthetic narrative only: no live model or camera request is required for layout QA.
 await tarot.route('**/api/events?*',route=>route.abort());
 await tarot.route('**/api/state*',async route=>{
  const response=await route.fetch();const state=await response.json();
  if(state.tarot)state.tarot.response={id:'layout-fixture',text:fixtureText,status:'complete',origin:'catalog',presentedChars:fixtureText.length,elements:[],segments:[]};
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
 await post('/api/projection',{action:'register',projectionWindowId:'rehearsal-projection',path:'/'});
 const operator=await context.newPage();await operator.goto(base+'/?menu');
 await operator.getByRole('complementary',{name:'Ajustes da projeção'}).waitFor();
 assert.equal((await (await fetch(base+'/api/projection')).json()).projection.activeProjectionWindowId,'rehearsal-projection','calibration tab must not claim the active projection');
 await operator.screenshot({path:path.join(output,'menu-projecao.png')});
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
 await operator.getByRole('button',{name:'PERFIL TECIDO'}).click();
 await operator.getByLabel('Encaixar texto do bot e Tarô na área').uncheck();
 await operator.getByText('Composição sincronizada.',{exact:true}).waitFor();
 await display.waitForFunction(()=>document.querySelector('[data-projection-readability]')?.dataset.projectionReadability==='true');
 await tarot.waitForFunction(()=>document.querySelector('[data-projection-readability]')?.dataset.projectionReadability==='true');
 await display.waitForFunction(()=>{const r=document.querySelector('[data-projection-original]').getBoundingClientRect();return Math.abs(r.width-1248)<2 && Math.abs(r.height-1080)<2;});
 const layout=await display.locator('[data-projection-original]').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,transform:getComputedStyle(e).transform}));
 assert(Math.abs(layout.width-1248)<2 && Math.abs(layout.height-1080)<2,'the main screen must reflow at full height beside the operator');
 assert(!layout.transform.includes('0.65'),'profile must not scale down the whole projection');
 const reading=await speech.locator('[class*="speechText"]').evaluate(e=>({size:parseFloat(getComputedStyle(e).fontSize),font:getComputedStyle(e).fontFamily,color:getComputedStyle(e).color}));
 assert(Math.abs(reading.size-55.2)<.1 && reading.font.includes('Arial') && reading.color==='rgb(255, 255, 255)',JSON.stringify(reading));
 await operator.getByLabel('Fonte da projeção').selectOption('scene');
 await tarot.waitForFunction(()=>getComputedStyle(document.querySelector('[data-public-module="tarot-speech"] [class*="speechText"]')).fontFamily.includes('Modern DOS'));
 await operator.getByLabel('Fonte da projeção').selectOption('sans');
 await tarot.waitForFunction(()=>getComputedStyle(document.querySelector('[data-public-module="tarot-speech"] [class*="speechText"]')).fontFamily.includes('Arial'));
 await tarot.screenshot({path:path.join(output,'tarot-tecido.png')});
 await operator.getByLabel('Tamanho do texto do componente').fill('150');
 await operator.getByText('Composição sincronizada.',{exact:true}).waitFor();
 await tarot.waitForFunction(()=>Math.abs(parseFloat(getComputedStyle(document.querySelector('[data-public-module="tarot-speech"] [class*="speechText"]')).fontSize)-82.8)<.1);
 await tarot.reload();
 await tarot.waitForFunction(()=>Math.abs(parseFloat(getComputedStyle(document.querySelector('[data-public-module="tarot-speech"] [class*="speechText"]')).fontSize)-82.8)<.1);
 checks.push('Profile reflows full-height Principal and updates Tarot font, color and per-module text size across reload');
 await display.screenshot({path:path.join(output,'operator-white.png')});
 checks.push('Operator white color reaches public labels; editing controls stay private');
 await operator.getByRole('button',{name:'RESTAURAR COMPONENTE',exact:true}).click();
 await operator.getByText('Composição sincronizada.',{exact:true}).waitFor();
 await tarot.waitForFunction(()=>document.querySelector('[data-public-module="tarot-speech"]').dataset.moduleCustom==='false');
 await tarot.waitForFunction(()=>Math.abs(parseFloat(getComputedStyle(document.querySelector('[data-public-module="tarot-speech"] [class*="speechText"]')).fontSize)-55.2)<.1);
 checks.push('Per-module reset restores default layout');

 fixtureText='A carta aparece diante de você e pede atenção ao caminho que está começando. Ainda não há garantias, mas existe uma escolha possível. O que parece um tropeço pode revelar uma saída. Olhe para as pessoas ao redor e perceba quem oferece apoio. Respire antes de agir. Seu próximo passo não precisa ser perfeito, apenas consciente e aberto ao inesperado.';
 await operator.getByLabel('Encaixar texto do bot e Tarô na área').check();
 await operator.getByText('Composição sincronizada.',{exact:true}).waitFor();
 await tarot.reload();
 for(const width of [1920,1280]) {
  await tarot.setViewportSize({width,height:width===1920?1080:720});
  try {
   await tarot.waitForFunction(()=>{const e=document.querySelector('[data-public-module="tarot-speech"] [class*="speechText"]');return e?.dataset.textFit==='fits' && e.scrollHeight<=e.clientHeight && e.scrollTop===0;});
  } catch (error) {
   const details=await tarot.locator('[data-public-module="tarot-speech"] [class*="speechText"]').evaluate(e=>({viewport:innerWidth,fit:e.dataset.textFit,font:getComputedStyle(e).fontSize,client:e.clientHeight,scroll:e.scrollHeight,top:e.scrollTop,root:e.closest('[data-projection-readability]')?.dataset.projectionFit}));
   throw new Error(`Long reading did not fit: ${JSON.stringify(details)}`,{cause:error});
  }
  const result=await speech.locator('[class*="speechText"]').evaluate(e=>({size:parseFloat(getComputedStyle(e).fontSize),text:e.textContent}));
  assert(result.size>=24 && result.size<=55.2 && result.text===fixtureText,JSON.stringify(result));
 }
 const bot=await context.newPage();
 let botSource='fixture';
 await bot.route('**/api/events?*',route=>route.abort());
 await bot.route('**/api/state*',async route=>{
  const response=await route.fetch(), value=await response.json();
  if(value.sceneZero){
   value.sceneZero.unlock.status='TEST';
   const message={id:'bot-fit-fixture',role:'assistant',content:fixtureText,source:botSource,timestamp:new Date().toISOString()};
   value.conversation=[message];value.publicMessage=message;
  }
  await route.fulfill({response,json:value});
 });
 await bot.goto(base+'/');
 for(const width of [1920,1280]) {
  await bot.setViewportSize({width,height:width===1920?1080:720});
  await bot.waitForFunction(()=>{
   const e=document.querySelector('[data-public-module="main-speech"] [class*=machine]'),area=e?.closest('[data-projection-text-area]');
   if(!e||!area||e.dataset.textFit!=='fits')return false;
   const text=e.getBoundingClientRect(),bounds=area.getBoundingClientRect(),frame=getComputedStyle(e.parentElement);
   const rail=document.querySelector('[data-public-module="operator-rail"]')?.getBoundingClientRect();
   return text.top>=bounds.top-1 && text.bottom<=bounds.bottom+1 && Number(frame.opacity)>.99 && frame.filter==='blur(0px)' && rail && Math.abs(rail.x-innerWidth*.65)<2;
  });
  assert.equal(await bot.locator('[data-public-module="main-speech"] [class*=machine]').innerText(),fixtureText);
 }
 await bot.screenshot({path:path.join(output,'bot-long-speech.png')});
 botSource='fixture:failure';
 await bot.reload();
 await bot.waitForFunction(()=>{
  const e=document.querySelector('[data-public-module="main-speech"] [class*=machine]'), frame=e?.parentElement, area=e?.closest('[data-projection-text-area]');
  if(!e||!area||e.dataset.textFit!=='fits'||frame?.dataset.warmupEffect!=='failure')return false;
  const text=frame.getBoundingClientRect(),bounds=area.getBoundingClientRect();
  return text.top>=bounds.top-1 && text.bottom<=bounds.bottom+1;
 });
 await bot.close();
 checks.push('A complete 60-word bot line remains inside its area at both resolutions and with a warmup result');
 await operator.getByLabel('Encaixar texto do bot e Tarô na área').uncheck();
 await tarot.waitForFunction(()=>{const e=document.querySelector('[data-public-module="tarot-speech"] [class*="speechText"]');return e && Math.abs(parseFloat(getComputedStyle(e).fontSize)-55.2)<.1 && e.scrollHeight>e.clientHeight;});
 await operator.getByLabel('Encaixar texto do bot e Tarô na área').check();
 await tarot.waitForFunction(()=>{const e=document.querySelector('[data-public-module="tarot-speech"] [class*="speechText"]');return e?.dataset.textFit==='fits' && e.scrollHeight<=e.clientHeight;});
 await tarot.screenshot({path:path.join(output,'tarot-long-reading.png')});
 checks.push('A complete 60-word Tarot reading fits at 1920x1080 and 1280x720 with the public Operator visible');

 await operator.getByRole('button',{name:'VISUAL ORIGINAL'}).click();
 await display.waitForFunction(()=>document.querySelector('[data-projection-readability]')?.dataset.projectionReadability==='false');
 await operator.getByRole('button',{name:'FECHAR MENU'}).click();
 assert.equal(await operator.getByRole('complementary',{name:'Ajustes da projeção'}).count(),0);
 assert(!new URL(operator.url()).searchParams.has('menu'));
 await operator.keyboard.press('Alt+m');
 await operator.getByRole('complementary',{name:'Ajustes da projeção'}).waitFor();
 let failOnce=true;
 await operator.route('**/api/operator-public',async route=>{
  if(failOnce && route.request().method()==='POST'){failOnce=false;return route.fulfill({status:503,body:'{}'});}
  return route.continue();
 });
 await operator.getByLabel('Componente',{exact:true}).selectOption('main-speech');
 await operator.getByLabel('Tamanho do texto do componente').fill('125');
 await operator.getByRole('button',{name:'TENTAR SALVAR NOVAMENTE'}).waitFor();
 await operator.getByRole('button',{name:'TENTAR SALVAR NOVAMENTE'}).click();
 await operator.getByText('Composição sincronizada.',{exact:true}).waitFor();
 assert.equal((await (await fetch(base+'/api/state')).json()).operatorPublic.composition.textScales['main-speech'],1.25);
 await operator.getByRole('button',{name:'RESTAURAR COMPONENTE',exact:true}).click();
 await operator.getByText('Composição sincronizada.',{exact:true}).waitFor();
 await operator.unroute('**/api/operator-public');
 await operator.keyboard.press('Escape');
 assert.equal(await operator.getByRole('complementary',{name:'Ajustes da projeção'}).count(),0);
 checks.push('Original profile, menu shortcuts, calibration isolation and retry after failed save');

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
