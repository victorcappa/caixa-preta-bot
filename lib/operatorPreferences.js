import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { resolveOpenAIModel } from './openaiModels.js';

// Operator choices only. Running cues, history, participants, camera ownership,
// playback IDs, hallucination clocks and card counters belong to the session.
const PATHS = [
  'model','operatorPublic.composition','operatorPublic.personality','robotSound','globalVolume','performance.intensity','postDemo.config',
  'tarot.config','tarot.visual','tarot.profile','tarot.references','tarot.privateInstruction','tarot.contexts',
  'tarot.camera.automatic','tarot.camera.deviceId',
  ...['enabled','automatic','randomEnabled','randomChance','requireFusion','afterCards','eligibleCardIds','onRemoval','effects','events','presets','preset','memories'].map(key=>'tarot.hallucination.'+key),
  'glitch.preset','glitch.params','glitch.audio','glitch.video.transitionMs',
  'forcaGShaders.intensity','forcaGSampler.masterVolume',
  ...['rawText','subdivision','fadeMs','pace','stageMultiplier','autoPlay','loop'].map(key=>'quedaAviao.'+key),
  'sceneZero.personalityGuidance.text','sceneZero.personalityGuidance.quickDirections','sceneZero.unlock.soundEnabled',
  ...['selectedAction','intensity','automatic','manualMode','intervalMs'].map(key=>'audienceWarmup.'+key),
  ...['researchEnabled','performativeResearchEnabled','budgetMode','config'].map(key=>'research.'+key)
];
const VOLATILE_SOUND = new Set(['sequence','updatedAt','outputResetSequence']);
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const get = (object, keys) => keys.reduce((value,key)=>value && Object.hasOwn(value,key)?value[key]:undefined,object);
function put(object,keys,value) {
  const key=keys[0];
  if(keys.length===1){object[key]=value;return;}
  object[key] ||= {};put(object[key],keys.slice(1),value);
}
export function extractOperatorPreferences(state) {
  const values={};
  for(const field of PATHS){
    const value=get(state,field.split('.'));if(value===undefined)continue;
    const selected=field==='robotSound'?Object.fromEntries(Object.entries(value).filter(([key])=>!VOLATILE_SOUND.has(key))):value;
    put(values,field.split('.'),clone(selected));
  }
  return values;
}
export function applyOperatorPreferences(state, values={}) {
  // Re-extract to reject accidental runtime fields from callers or older files.
  const selected=extractOperatorPreferences(values);
  for(const field of PATHS){
    const keys=field.split('.'),value=get(selected,keys);if(value===undefined)continue;
    const current=get(state,keys);
    put(state,keys,current&&value&&typeof current==='object'&&typeof value==='object'&&!Array.isArray(value)?{...current,...clone(value)}:clone(value));
  }
  state.model = resolveOpenAIModel(state.model);
  return state;
}
export function operatorPreferencesPath() {
  const directory=process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR?path.resolve(process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR):path.join(process.cwd(),'.runtime/show');
  return path.join(directory,'operator-preferences.json');
}
export function createOperatorPreferenceStore({file=operatorPreferencesPath()}={}) {
  let envelope=null,lastError=null;
  try{
    const raw=JSON.parse(fs.readFileSync(file,'utf8'));
    if(raw.schemaVersion!==1||!raw.values||raw.checksum!==hash(raw.values))throw new Error('OPERATOR_PREFERENCES_INVALID');
    envelope=raw;
  }catch(error){if(error.code!=='ENOENT')throw error;}
  let serialized=envelope?JSON.stringify(extractOperatorPreferences(envelope.values)):null;
  return {
    apply(state){return applyOperatorPreferences(state,envelope?.values);},
    save(state){
      // Hot reload also migrates the live singleton before persisting its choices.
      state.model = resolveOpenAIModel(state.model);
      const values=extractOperatorPreferences(state),next=JSON.stringify(values);
      if(serialized===next)return this.status();
      const record={schemaVersion:1,savedAt:new Date().toISOString(),values,checksum:hash(values)};
      const temporary=file+'.'+randomUUID()+'.tmp';let descriptor;
      try{
        fs.mkdirSync(path.dirname(file),{recursive:true});descriptor=fs.openSync(temporary,'wx',0o600);
        fs.writeFileSync(descriptor,JSON.stringify(record,null,2)+'\n');fs.fsyncSync(descriptor);fs.closeSync(descriptor);descriptor=undefined;
        fs.renameSync(temporary,file);envelope=record;serialized=next;lastError=null;
      }catch(error){
        if(descriptor!==undefined)fs.closeSync(descriptor);
        try{fs.unlinkSync(temporary);}catch{}
        lastError=error.code||error.message;throw new Error('OPERATOR_PREFERENCES_SAVE_FAILED',{cause:error});
      }
      return this.status();
    },
    status(){return {saved:Boolean(envelope),savedAt:envelope?.savedAt||null,error:lastError};}
  };
}
