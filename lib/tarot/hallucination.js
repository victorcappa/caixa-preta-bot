// One clock and a pure evaluator; changing a gate never changes the transport.
export const EFFECTS = {
  fusion:['Fusão facial','facial'],morph:['Morphing','facial'],oscillation:['Oscilação entre rostos','facial'],identity:['Troca de identidade','facial'],
  breathing:['Respiração da imagem','carta'],wave:['Ondulação','carta'],texture:['Distorção de textura','carta'],chromatic:['Aberração cromática','carta'],double:['Duplicação visual','carta'],symbols:['Pulsação dos símbolos','carta'],
  falling:['Palavras caindo','texto'],pile:['Acúmulo de letras','texto'],circular:['Texto circular','texto'],duplicate:['Duplicação de palavras','texto'],textWave:['Texto ondulante','texto'],floating:['Palavras flutuantes','texto'],invert:['Inversão de texto','texto'],typeChromatic:['Aberração tipográfica','texto'],
  association:['Associação livre intensa','narrativa'],repetition:['Repetições','narrativa'],contradiction:['Contradições','narrativa'],confusion:['Memória e percepção','narrativa'],documents:['Recuperação associativa de documentos','narrativa']
};
const clamp=(n,a,b,f)=>Number.isFinite(n)?Math.max(a,Math.min(b,n)):f;
export function defaultEffect(effect){return {enabled:true,intensity:effect==='fusion'?100:65,speed:50,duration:20,mix:85,mode:'timeline',amount:35,gravity:50,radius:50,direction:1};}
export function eventDefault(effect='fusion',start=10){return {id:globalThis.crypto.randomUUID(),effect,start,hold:45,fadeIn:3,fadeOut:3,intensity:100,enabled:true,repeat:1,gap:7,transition:'smooth'};}
export function createHallucination(){
 return {enabled:true,automatic:true,requireFusion:false,afterCards:3,eligibleCardIds:[],onRemoval:'end',seenCards:[],effects:Object.fromEntries(Object.keys(EFFECTS).map(k=>[k,{...defaultEffect(),intensity:k==='fusion'?100:65}])),
 events:[{...eventDefault(),id:'first'},{...eventDefault('fusion',68),id:'second',hold:20,fadeIn:2},{...eventDefault('fusion',98),id:'third',hold:25,fadeIn:2},...['wave','chromatic','association'].map((effect,i)=>({...eventDefault(effect,13+i*5),id:`grow-${effect}`,hold:100,intensity:40})),{...eventDefault('oscillation',98),id:'oscillation',hold:25}],
 run:{id:null,status:'stopped',elapsed:0,anchorMono:0,cardId:null,signature:null,overrides:{}},assets:[],memories:[],presets:[],preset:'personalizado'};
}
export function normalizeEvent(e){
 if(!EFFECTS[e?.effect])return null;
 return {id:typeof e.id==='string'?e.id.slice(0,80):globalThis.crypto.randomUUID(),effect:e.effect,start:clamp(e.start,0,3600,0),hold:clamp(e.hold,0,3600,45),fadeIn:clamp(e.fadeIn,0,300,3),fadeOut:clamp(e.fadeOut,0,300,3),intensity:clamp(e.intensity,0,100,100),enabled:e.enabled!==false,repeat:Math.round(clamp(e.repeat,1,50,1)),gap:clamp(e.gap,0,3600,7),transition:['linear','smooth','cut'].includes(e.transition)?e.transition:'smooth'};
}
export function patchHallucination(h,patch={}){
 for(const key of ['enabled','automatic','requireFusion'])if(typeof patch[key]==='boolean')h[key]=patch[key];
 if(Number.isFinite(patch.afterCards))h.afterCards=Math.round(clamp(patch.afterCards,1,22,3));
 if(Array.isArray(patch.eligibleCardIds))h.eligibleCardIds=[...new Set(patch.eligibleCardIds.filter(n=>Number.isInteger(n)&&n>=0&&n<22))];
 if(['end','pause','restart','next'].includes(patch.onRemoval))h.onRemoval=patch.onRemoval;
 if(Array.isArray(patch.events))h.events=patch.events.slice(0,150).map(normalizeEvent).filter(Boolean).filter((e,i,arr)=>arr.findIndex(x=>x.id===e.id)===i);
 for(const [key,p] of Object.entries(patch.effects||{})){
  if(!EFFECTS[key]||!p||typeof p!=='object')continue;
  const e=h.effects[key];if(e.mix===undefined)e.mix=85;if(typeof p.enabled==='boolean')e.enabled=p.enabled;
  for(const f of ['intensity','speed','amount','gravity','radius','mix'])if(Number.isFinite(p[f]))e[f]=clamp(p[f],0,100,e[f]);
  if(Number.isFinite(p.duration))e.duration=clamp(p.duration,.1,3600,20);
  if(['timeline','off','on'].includes(p.mode))e.mode=p.mode;
  if([1,-1].includes(p.direction))e.direction=p.direction;
 }
 return h;
}
export function elapsed(h,mono=performance.now()){return h.run.elapsed+(h.run.status==='playing'&&Number.isFinite(h.run.anchorMono)?Math.max(0,mono-h.run.anchorMono)/1000:0);}
export function transport(h,action,cardId=null,signature=null,mono=performance.now()){
 const r=h.run,preserveManual=action==='play'&&r.status==='paused'&&r.manualOnly;
 if(action==='pause'){r.elapsed=elapsed(h,mono);r.status='paused';}
 if(action==='stop'){r.status='stopped';r.elapsed=0;r.overrides={};r.id=globalThis.crypto.randomUUID();}
 if(action==='restart'||(action==='play'&&r.status==='stopped')){r.elapsed=0;r.id=globalThis.crypto.randomUUID();r.overrides={};r.cardId=cardId;r.signature=signature;}
 if(action==='play'||action==='restart'){r.anchorMono=mono;r.status='playing';r.absent=false;r.manualOnly=Boolean(preserveManual);}
}
export function removeHallucination(h){
 if(h.onRemoval==='pause')transport(h,'pause');else transport(h,'stop');
 // Removal always invalidates manual commands, even while pausing.
 h.run.overrides={};h.run.absent=true;
}
export function eventLevel(e,t){
 if(!e.enabled)return 0;const length=e.fadeIn+e.hold+e.fadeOut,cycle=length+e.gap;
 if(t<e.start||length<=0||cycle<=0)return 0;
 const index=Math.floor((t-e.start)/cycle);if(index>=e.repeat)return 0;
 const p=t-e.start-index*cycle;if(p>length)return 0;
 let level=p<e.fadeIn?p/(e.fadeIn||1):p<e.fadeIn+e.hold?1:1-(p-e.fadeIn-e.hold)/(e.fadeOut||1);
 level=Math.max(0,Math.min(1,level));if(e.transition==='smooth')level=level*level*(3-2*level);if(e.transition==='cut')level=p<length?1:0;
 return level*e.intensity/100;
}
export function evaluate(h,t=elapsed(h),present=true){
 const levels={},active=[],completed=[];
 for(const e of h.events){if(eventLevel(e,t)>0)active.push(e.id);if(t>=e.start+(e.fadeIn+e.hold+e.fadeOut+e.gap)*e.repeat-e.gap)completed.push(e.id);}
 for(const [key,e] of Object.entries(h.effects)){
  const manual=h.run.overrides[key];const override=manual&&t<manual.until?manual.mode:null;
  const mode=override||e.mode;
  const level=mode==='on'?1:mode==='off'||h.run.manualOnly?0:Math.max(0,...h.events.filter(v=>v.effect===key).map(v=>eventLevel(v,t)));
  levels[key]=present&&h.enabled&&e.enabled&&h.run.status!=='stopped'&&!h.run.absent?level*e.intensity/100:0;
 }
 return {levels,active,completed};
}
export function hallucinationSnapshot(h,includePrivate=false){
 const t=elapsed(h),snapshot=structuredClone(h);delete snapshot.run.anchorMono;snapshot.run.elapsed=t;snapshot.run.sampledAt=Date.now();
 snapshot.run.active=evaluate(h,t).active;snapshot.run.completed=evaluate(h,t).completed;
 if(!includePrivate){delete snapshot.memories;delete snapshot.presets;delete snapshot.seenCards;snapshot.assets=snapshot.assets.filter(a=>a.cardId===h.run.cardId);}
 return snapshot;
}
export function restoreHallucination(value){
 const h=createHallucination();if(!value)return h;patchHallucination(h,value);
 h.assets=Array.isArray(value.assets)?value.assets:[];h.memories=Array.isArray(value.memories)?value.memories:[];h.presets=Array.isArray(value.presets)?value.presets:[];h.seenCards=Array.isArray(value.seenCards)?value.seenCards:[];
 return h; // Never resume an old theatrical run after restart.
}
export function builtInPreset(name){
 const h=createHallucination();h.enabled=true;
 const sets={sutil:['fusion','breathing','association'],psicodelico:['fusion','morph','wave','chromatic','textWave','circular','association'],desintegracao:['fusion','wave','texture','falling','pile','duplicate','typeChromatic','contradiction'],pareidolia:['fusion','oscillation','identity','confusion','documents']};
 const selected=sets[name]||Object.keys(EFFECTS);
 for(const [key,e]of Object.entries(h.effects)){e.enabled=selected.includes(key);e.intensity=key==='fusion'?100:name==='sutil'?25:65;}
 for(const key of selected)if(!h.events.some(e=>e.effect===key))h.events.push({...eventDefault(key, key==='falling'?55:20),hold:90,intensity:65});
 return {effects:h.effects,events:h.events,afterCards:h.afterCards,automatic:h.automatic,preset:name};
}
export function narrativeContext(h,query=""){
 const {levels}=evaluate(h);const labels=Object.keys(EFFECTS).filter(k=>EFFECTS[k][1]==='narrativa'&&levels[k]>0).map(k=>({effect:EFFECTS[k][0],intensity:Math.round(levels[k]*100)}));
 const terms=query.toLowerCase().split(/[^\p{L}]+/u).filter(t=>t.length>3);
 return {effects:labels,memories:levels.documents>0?h.memories.filter(m=>m.enabled!==false).sort((a,b)=>terms.filter(t=>(b.title+' '+b.text).toLowerCase().includes(t)).length-terms.filter(t=>(a.title+' '+a.text).toLowerCase().includes(t)).length).slice(0,15).map(({title,text})=>({title,text})):[]};
}
