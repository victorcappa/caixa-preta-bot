import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createOperatorPreferenceStore,extractOperatorPreferences} from '../lib/operatorPreferences.js';
import {DEFAULT_OPENAI_MODEL,OPENAI_MODEL_OPTIONS,normalizeOpenAIModel,resolveOpenAIModel} from '../lib/openaiModels.js';

const child=process.argv[2]==='--child';
const directory=child?process.argv[3]:fs.mkdtempSync(path.join(os.tmpdir(),'caixa-preferences-test-'));
process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR=directory;
if (!child) {
  const values = {model:'gpt-5-mini',globalVolume:.39};
  const checksum = createHash('sha256').update(JSON.stringify(values)).digest('hex');
  fs.writeFileSync(path.join(directory,'operator-preferences.json'), JSON.stringify({schemaVersion:1,values,checksum}), {mode:0o600});
}
registerHooks({resolve(specifier,context,nextResolve){
  let url;
  if(specifier.startsWith('@/'))url=pathToFileURL(path.resolve(specifier.slice(2))).href;
  else if(specifier.startsWith('.'))url=new URL(specifier,context.parentURL).href;
  if(url?.startsWith('file:')&&!path.extname(fileURLToPath(url))&&fs.existsSync(fileURLToPath(url)+'.js'))return nextResolve(url+'.js',context);
  return nextResolve(url||specifier,context);
}});
const {showState}=await import('../lib/showState.js');
const recoveryState=showState.privateSnapshot();
const saved=()=>JSON.parse(fs.readFileSync(path.join(directory,'operator-preferences.json'),'utf8'));
if(child){
  assert.deepEqual(extractOperatorPreferences(showState.privateSnapshot()),saved().values);
  const s=showState.privateSnapshot();assert.equal(s.tarot.active,false);assert.equal(s.tarot.camera.enabled,false);assert.equal(s.tarot.hallucination.run.status,'stopped');assert.deepEqual(s.tarot.hallucination.seenCards,[]);assert.equal(s.conversation.length,0);
  console.log('PASS cold process loads saved choices without replaying a session');
  process.exit(0);
}
const checks=[];
assert.equal(saved().values.model,'gpt-5.6-terra');
const hotState = {model:'gpt-5-nano',conversation:[{content:'keep this session'}]};
const hotStore = createOperatorPreferenceStore({file:path.join(directory,'hot-model.json')});
hotStore.save(hotState);
assert.equal(hotState.model,'gpt-5.6-luna');
assert.deepEqual(hotState.conversation,[{content:'keep this session'}]);
assert.equal(DEFAULT_OPENAI_MODEL,'gpt-5.6-terra');
assert.deepEqual(OPENAI_MODEL_OPTIONS,['gpt-5.6-terra','gpt-5.6-luna']);
for (const [legacy,current] of [
  ['gpt-5-mini','gpt-5.6-terra'], ['gpt-5-mini-2025-08-07','gpt-5.6-terra'],
  ['gpt-5-nano','gpt-5.6-luna'], ['gpt-5-nano-2025-08-07','gpt-5.6-luna']
]) {
  assert.equal(normalizeOpenAIModel(` ${legacy} `),current);
  showState.setModel(legacy);
  assert.equal(showState.snapshot().model,current);
  assert.equal(saved().values.model,current);
}
assert.equal(recoveryState.model,'gpt-5.6-terra');
assert.equal(recoveryState.globalVolume,.39);
assert.equal(normalizeOpenAIModel('gpt-5'),null);
assert.equal(normalizeOpenAIModel('o3'),null);
assert.equal(normalizeOpenAIModel('__proto__'),null);
assert.equal(resolveOpenAIModel('invalid','gpt-5-nano'),'gpt-5.6-luna');
assert.equal(resolveOpenAIModel(null,'invalid'),DEFAULT_OPENAI_MODEL);
checks.push('retired mini/nano aliases, environment values and persisted preferences migrate by tier, including cold startup');
showState.patchOperatorPublic({personality:{sarcasm:88,rebellion:49,curiosity:91,verbosity:52}});
showState.controlRobotSound({typingIntervalMs:83,typingPauseMs:650,messageGapMs:900,displayFont:'courier',typingVolume:.17});
showState.setModel('gpt-5-nano');showState.setGlobalVolume(.42);
assert.equal(showState.snapshot().model,'gpt-5.6-luna');
showState.controlTarot('config',{config:{maxWords:113,associationIntensity:87,automatic:true}});
showState.controlTarot('visual',{visual:{matrix:.31,textSize:44}});
showState.controlTarot('profile',{profile:{humor:19,poetry:81}});
showState.controlTarot('instruction',{text:'Preferência privada do teste.'});
showState.controlTarot('contexts',{contexts:[{text:'Um registro editorial.',url:'https://example.org/archive',date:'2026-10-15',checkedAt:'2026-10-16',verification:'verified'}]});
showState.controlTarot('references',{settings:{maxChunks:2,themes:{politica:false}}});
showState.controlTarot('camera',{automatic:false,deviceId:'test-camera'});
showState.controlTarot('hallucination',{patch:{randomEnabled:true,randomChance:37,afterCards:4,requireFusion:true,effects:{fusion:{mix:73},wave:{enabled:false}}}});
showState.controlTarot('hallucination-memory',{memories:[{id:'interview',title:'Entrevista',text:'Memória editorial de teste.',personIds:['face-a']}]});
showState.controlTarot('hallucination-preset',{operation:'save',name:'Preferência teste'});
showState.postDemo.config({typingIntervalMs:145,typingPauseMs:950,cardHoldMs:33000,displayFont:'vt323',model:'gpt-5.6-terra',personality:{sarcasm:21,verbosity:67},profile:{humor:31,poetry:48}});
const expected=extractOperatorPreferences(showState.privateSnapshot());
assert.deepEqual(saved().values,expected);assert.equal(fs.statSync(path.join(directory,'operator-preferences.json')).mode&0o777,0o600);
checks.push('current edits are written atomically before acknowledgement, including isolated post-demo timing/personality/model/font');
const timestamp=saved().savedAt;
showState.addMessage('assistant','Histórico que não é preferência.','test');
showState.controlTarot('start');showState.controlTarot('claim-camera',{owner:'test-owner'});
showState.controlTarot('select',{card:{id:8,version:'test',name:'A Justiça',elements:[]},source:'camera',owner:'test-owner'});
assert.equal(saved().savedAt,timestamp);assert(!JSON.stringify(saved()).includes('Histórico que não é preferência'));assert(!JSON.stringify(saved()).includes('test-owner'));assert(!('assets' in saved().values.tarot.hallucination));
checks.push('history, camera ownership, card counters, running effects and recovery metadata never become preferences');
const before=showState.privateSnapshot();let events=0;const unsubscribe=showState.subscribe(()=>events++);
showState._refreshOperatorPreferences(createOperatorPreferenceStore());assert.equal(events,0);assert.deepEqual(showState.privateSnapshot().conversation,before.conversation);unsubscribe();
checks.push('hot persistence refresh keeps live listeners/history and does not emit a presentation event');
showState.controlTarot('reset');assert.deepEqual(extractOperatorPreferences(showState.privateSnapshot()),expected);assert.deepEqual(showState.privateSnapshot().tarot.hallucination.seenCards,[]);
showState.startNewPresentation();assert.deepEqual(extractOperatorPreferences(showState.privateSnapshot()),expected);assert.equal(showState.privateSnapshot().conversation.length,0);assert.equal(showState.privateSnapshot().tarot.active,false);
checks.push('Tarot reset and new presentation retain every selected setting while resetting performance state');
const restarted=spawnSync(process.execPath,['--no-warnings',fileURLToPath(import.meta.url),'--child',directory],{encoding:'utf8',env:{...process.env}});assert.equal(restarted.status,0,restarted.stderr+restarted.stdout);
const {createSnapshotEnvelope}=await import('../lib/showSessionPersistence.js');
showState.restoreFromRecovery(createSnapshotEnvelope({storeVersion:showState._storeVersion,sessionId:'old-test-session',bootId:'old-test-boot',revision:0,summary:{},state:recoveryState}));assert.deepEqual(extractOperatorPreferences(showState.privateSnapshot()),expected);
checks.push('restoring an older presentation retains the latest operator preferences');
checks.push('a separate Node process restores current saved values without resume or old history');
const bad=path.join(directory,'invalid-preferences.json');fs.writeFileSync(bad,'{"schemaVersion":1,"values":{},"checksum":"wrong"}');assert.throws(()=>createOperatorPreferenceStore({file:bad}),/PREFERENCES_INVALID/);assert(fs.readFileSync(bad,'utf8').includes('wrong'));
const occupied=path.join(directory,'occupied');fs.mkdirSync(occupied);const writer=createOperatorPreferenceStore({file:path.join(occupied,'file')});fs.mkdirSync(path.join(occupied,'file'));assert.throws(()=>writer.save(showState.privateSnapshot()),/SAVE_FAILED/);assert(writer.status().error);
checks.push('corrupt files are rejected without replacement and failed writes are reported');
console.log(JSON.stringify({ok:true,checks,directory},null,2));
