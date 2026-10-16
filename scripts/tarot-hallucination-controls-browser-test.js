import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {createTarotState} from '../lib/tarot/state.js';
import {patchHallucination} from '../lib/tarot/hallucination.js';
const base=process.env.CAIXA_PRETA_TAROT_TEST_URL;
assert(base&&new URL(base).port!=='3000','Use an isolated server, never the active show');
const tarot=createTarotState();tarot.active=true;tarot.currentCard={id:5,number:5,name:'O Sacerdote',version:'v',elements:[],source:'camera'};tarot.currentCards=[tarot.currentCard];
tarot.hallucination.seenCards=[3,12,10,14,9,5];tarot.hallucination.eligibleCardIds=[2];tarot.hallucination.run.id='preserve-run';
const before=structuredClone(tarot.hallucination),commands=[],errors=[];
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/tarot',async route=>{
 if(route.request().method()==='POST'){
  const body=route.request().postDataJSON();commands.push(body);assert.equal(body.action,'hallucination');assert.equal(body.sessionId,'filter-test');patchHallucination(tarot.hallucination,body.patch);
  await route.fulfill({json:{ok:true}});
 }else await route.fulfill({json:{sessionId:'filter-test',tarot,history:[]}});
});
try{
 await page.goto(base+'/treinamento/controle');const status=page.getByRole('status',{name:'Estado da alucinação'});
 await status.waitFor();await page.waitForFunction(()=>document.querySelector('[data-hallucination-status="card-filter"]'));
 assert.match(await status.innerText(),/6\/3 CARTAS/);assert.match(await status.innerText(),/Bloqueada pelo filtro/);assert.match(await status.innerText(),/Nenhuma fusão aprovada/);
 await page.getByRole('button',{name:'07 — Alucinação',exact:true}).click();
 assert.equal(await page.locator('select[multiple]').count(),0,'Card eligibility does not use an ambiguous multi-select');
 await page.getByRole('button',{name:'TODAS AS CARTAS',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-hallucination-status="ready"]'));
 assert.deepEqual(tarot.hallucination.eligibleCardIds,[]);assert.deepEqual(tarot.hallucination.seenCards,before.seenCards);assert.deepEqual(tarot.hallucination.run,before.run);assert.deepEqual(tarot.hallucination.effects,before.effects);
 await page.getByRole('button',{name:'ESCOLHER CARTAS ESPECÍFICAS',exact:true}).click();await page.getByRole('checkbox',{name:'2 · A Sacerdotisa',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-hallucination-status="card-filter"]'));assert(await page.getByRole('checkbox',{name:'2 · A Sacerdotisa',exact:true}).isChecked());
 await status.getByRole('button',{name:'PERMITIR TODAS AS CARTAS',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-hallucination-status="ready"]'));
 assert.deepEqual(tarot.hallucination.eligibleCardIds,[]);assert.equal(commands.length,3);assert.deepEqual(errors,[]);
 const output='/private/tmp/tarot-hallucination-filter-evidence';await fs.mkdir(output,{recursive:true});await page.screenshot({path:output+'/all-cards.png'});
 console.log(JSON.stringify({ok:true,checks:['six counted cards blocked by a specific-card filter are explained','explicit all-cards selection removes restriction without changing count, clock or effects','named checkboxes replace multi-select; filter can also be cleared from persistent status','missing approved face is reported independently'],output},null,2));
}finally{await browser.close();}
