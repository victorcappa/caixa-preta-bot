import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {prepareOperatorAudit} from './operator-public-audit-utils.js';
const live=process.argv.includes('--live');
if(live)assert(process.env.OPENAI_API_KEY,'OPENAI_API_KEY is required for explicit live validation');
const auditRoot=process.env.CAIXA_PRETA_OPERATOR_AUDIT_ROOT||await prepareOperatorAudit();
assert.notEqual(path.resolve(auditRoot),path.resolve(process.cwd()));
const base='http://127.0.0.1:3318',output=await fs.mkdtemp('/private/tmp/tarot-reference-evidence-');
try{await fetch(base,{signal:AbortSignal.timeout(500)});throw new Error('Port 3318 occupied; no process stopped');}catch(e){if(e.message.startsWith('Port'))throw e;}
const fixture=path.join(output,'model.json');await fs.writeFile(fixture,JSON.stringify({association:'O registro preserva o vestígio da queda, mas nunca devolve quem caiu.'}));
const args=live?[]:['--import',fileURLToPath(new URL('./tarot-model-mock.js',import.meta.url))];
args.push('node_modules/next/dist/bin/next','start','--port','3318','--hostname','127.0.0.1');
let log='';const server=spawn(process.execPath,args,{cwd:auditRoot,env:{...process.env,OPENAI_API_KEY:live?process.env.OPENAI_API_KEY:'audit-only',CAIXA_PRETA_TAROT_MOCK:live?'':fixture,CAIXA_PRETA_SHOW_RUNTIME_DIR:path.join(output,'runtime')},stdio:['ignore','pipe','pipe']});
server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
const checks=[],errors=[];let browser,sessionId;
const get=async(route)=>{const r=await fetch(base+route);assert(r.ok,route);return r.json();};
const post=async(route,body,status=200)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,...body})});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};
const command=(action,data={})=>post('/api/tarot',{action,...data});
const test=(action,cardId=16,mode='associative',question='queda avião colisão registro')=>post('/api/tarot/references',{action,cardId,mode,question});
const stable=s=>({history:s.history,card:s.tarot.currentCard,response:s.tarot.response,active:s.tarot.active,generation:s.tarot.generation,requestId:s.tarot.requestId,sequence:s.tarot.sequence,settings:s.tarot.references});
try{
 const deadline=Date.now()+30000;while(true){try{if((await fetch(base+'/api/health?skipOptional=1')).ok)break;}catch{}assert(Date.now()<deadline,'server readiness');await new Promise(r=>setTimeout(r,100));}
 const initial=await get('/api/tarot');sessionId=initial.sessionId;
 const status=await get('/api/tarot/references');assert(status.loaded&&status.chunks>100&&status.sourceCount>20);
 await post('/api/tarot/references',{action:'search',sessionId:'wrong',cardId:16,mode:'normal'},409);
 const invalidOrigin=await fetch(base+'/api/tarot/references',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://invalid.example'},body:JSON.stringify({sessionId,action:'reindex'})});assert.equal(invalidOrigin.status,403);
 await test('search',200,'normal').then(()=>assert.fail('invalid card accepted')).catch(e=>assert.match(e.message,/TAROT_REFERENCE_MISSING/));
 const normal=await test('search',16,'normal'),associative=await test('search'),hallucinatory=await test('search',18,'hallucinatory','percepção pareidolia simulação');
 assert(normal.references.expansion.length===0&&associative.references.expansion.length>0);
 assert(associative.references.chunks.some(c=>c.sectionId==='CP-02'));assert(hallucinatory.references.mode==='hallucinatory');
 const politics=await test('search',4,'associative','Banco Master Daniel Vorcaro BRB liquidação');assert(politics.references.chunks.some(c=>c.sectionId==='CP-50'&&c.checkedAt==='2026-10-16'));assert(politics.references.characters<=politics.references.limits.maxChars);
 assert.deepEqual(stable(await get('/api/tarot')),stable(initial));checks.push('offline HTTP index/search, origin/session/card guards and three retrieval modes preserve the presentation session');
 await command('references',{settings:{themes:{politica:false},maxChunks:2}});
 assert((await test('search',4,'associative','democracia autoridade')).references.chunks.every(c=>c.theme!=='politica'));
 await command('references',{settings:{themes:{politica:true},maxChunks:4}});
 checks.push('private settings change real retrieval independently');
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/treinamento/controle');await page.getByRole('button',{name:'05 — Memória',exact:true}).click();
 await page.getByText(/Documento principal carregado/).waitFor();
 await page.getByLabel('Pergunta para a busca contextual').fill('queda avião colisão registro');
 await page.getByRole('button',{name:'TESTAR ASSOCIAÇÕES',exact:true}).click();await page.getByText(/RESULTADO ASSOCIATIVA/).waitFor();
 assert(await page.getByText(/CP-02/).count()>0);await page.getByLabel('Pergunta para a busca contextual').fill('Banco Master Daniel Vorcaro BRB liquidação');await page.getByRole('button',{name:'TESTAR ASSOCIAÇÕES',exact:true}).click();await page.getByText(/CP-50/).first().waitFor();assert(await page.getByText(/fontes consultadas em 2026-10-16/).count()>0);await page.screenshot({path:output+'/political-references.png',fullPage:true});checks.push('new Master/Vorcaro sources and per-section consultation date are retrieved and rendered without changing the session');await page.getByRole('checkbox',{name:'Política e democracia',exact:true}).uncheck();
 await page.waitForFunction(()=>!document.querySelector('input[type="checkbox"]:checked')?.disabled);await page.screenshot({path:output+'/references.png',fullPage:true});
 checks.push('rendered TARÔ controls load status, search with provenance and independently disable a theme');
 const beforePreview=stable(await get('/api/tarot'));
 const generated=[];
 for(const [id,mode,question] of [[16,'normal','queda avião registro'],[13,'associative','memória corpo imagem eternidade Morel'],[18,'hallucinatory','percepção simulação imagem duplicação']]){
  const result=await test('generate',id,mode,question);assert(result.narrative.text.length>30);assert(result.narrative.text.split(/\n\n/).length===3);assert(result.references.chunks.length>0);
  generated.push({id,mode,text:result.narrative.text,sections:result.references.chunks.map(c=>c.sectionId),characters:result.references.characters,estimatedTokens:result.references.estimatedTokens});
  if(!live){const request=JSON.parse(await fs.readFile(fixture+'.request.json','utf8')),content=JSON.parse(request.input.at(-1).content);
   assert.deepEqual(content.retrievedReferences,JSON.parse(result.references.context));assert(!JSON.stringify(request).includes('input_image'));assert(content.retrievedReferences.length<=4);
   assert(!JSON.stringify(request).includes('atualizacao_obrigatoria'));
   assert(JSON.stringify(content.retrievedReferences).length<=result.references.limits.maxChars);
   assert(request.input.some(m=>m.content.includes('Modo de associação: '+mode)));
  }
 }
 assert.deepEqual(stable(await get('/api/tarot')),beforePreview);
 checks.push((live?'three REAL model responses':'three intercepted model calls')+' use retrieved context and distinct mode parameters without history, card, generation or presentation mutations');
 const beforePublic=await get('/api/state');await command('start');await command('select',{cardId:16,source:'manual'});const result=await command('ask',{question:'O que um registro da queda preserva?',requestId:crypto.randomUUID()});assert(result.ok);
 const privateState=await get('/api/tarot'),publicState=await get('/api/state');
 const message=privateState.history.filter(m=>m.source==='tarot-response').at(-1);const active={text:message.content,references:message.tarot.references};assert(message.tarot.references.chunkIds.length>0);
 assert.equal(publicState.conversation.find(m=>m.id===message.id).tarot.references,undefined);assert.deepEqual(publicState.publicMessage,beforePublic.publicMessage);
 checks.push('active generation stores recurrence trace in shared history; Principal speech and public references remain isolated');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'report.json'),JSON.stringify({ok:true,live,checks,generated,active,status},null,2));
 console.log(JSON.stringify({ok:true,live,checks,generated,active,output},null,2));
}finally{await browser?.close();server.kill('SIGTERM');await fs.writeFile(path.join(output,'server.log'),log);}
