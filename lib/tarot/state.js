import { createHallucination, hallucinationSnapshot, restoreHallucination } from "./hallucination.js";
import { createFloorState } from "./floor.js";
export const DEFAULT_TAROT_CONFIG = {
  questionsUntilAutonomy: 5, automatic: false, maxCards: 6,
  intervalMs: 6000, maxDurationMs: 600000, reflectionSeconds: 35,
  questionFrequency: 2, associationIntensity: 60,
  autoAnalyze: true, repeatOnReturn: false, stabilityMs: 450, revealSpeed: 1,
  maxWords:90, floorEnabled:true, floorAfterCards:6, floorStabilityMs:1200, glareProtection:true
};
export const DEFAULT_TAROT_VISUAL = { blur:5,dimming:.42,green:.12,matrix:.18,outline:.65,animations:true,textSize:38,
  matrixStyle:"rain",matrixDensity:32,matrixSpeed:1,matrixSize:16,matrixGlow:8,matrixTrails:.8,matrixScanlines:.12,matrixPulse:.2,matrixRotation:0,matrixColor:"#53ffad",matrixSymbols:"01 アイウエオ カキクケコ △ ◇ ⊕ ∞ ⌘ ☉ ☽ ⚝" };
export function normalizeTarotVisual(input = {}, current = DEFAULT_TAROT_VISUAL) {
  const result = { ...DEFAULT_TAROT_VISUAL, ...current };
  for (const [key, max] of Object.entries({ blur:18,dimming:.85,green:.6,matrix:.8,outline:1,textSize:64,matrixDensity:90,matrixSpeed:4,matrixSize:40,matrixGlow:25,matrixTrails:.97,matrixScanlines:.6,matrixPulse:1,matrixRotation:180 })) {
    if (Number.isFinite(input[key])) result[key] = Math.max(0, Math.min(max, input[key]));
  }
  if (typeof input.animations === "boolean") result.animations = input.animations;
  result.textSize=Math.max(24,result.textSize);result.matrixSize=Math.max(8,result.matrixSize);result.matrixDensity=Math.max(4,result.matrixDensity);result.matrixSpeed=Math.max(.1,result.matrixSpeed);
  if(["rain","constellation","orbits","runes"].includes(input.matrixStyle))result.matrixStyle=input.matrixStyle;
  if(typeof input.matrixSymbols==="string"&&input.matrixSymbols.trim())result.matrixSymbols=input.matrixSymbols.trim().slice(0,180);
  if(/^#[0-9a-f]{6}$/i.test(input.matrixColor||""))result.matrixColor=input.matrixColor;
  return result;
}

export function createTarotState() {
  return { hallucination:createHallucination(), active:false,suspended:false,sequence:0, currentCard: null, currentCards:[],readCards:[],floor:createFloorState(),response: null,
    answeredQuestions: 0, requestId: null, generation: "idle", error: null,
    camera: { enabled: false, automatic: true, deviceId: "", devices: [], owner: null, leaseUntil: 0, captureSequence: 0, status: "waiting" },
    config: { ...DEFAULT_TAROT_CONFIG }, visual: { ...DEFAULT_TAROT_VISUAL }, autonomy: { status: "off", count: 0, startedAt: null, used: [] },
    privateInstruction: "", contexts: [], profile: {}, metrics: {}, recentRequestIds: [] };
}

export function normalizeTarotConfig(input = {}, current = DEFAULT_TAROT_CONFIG) {
  const ranges = { questionsUntilAutonomy: [1, 100], maxCards: [1, 22], intervalMs: [1000, 120000],
    maxDurationMs: [10000, 3600000], reflectionSeconds: [5, 120], questionFrequency: [1, 10], associationIntensity: [0, 100], stabilityMs: [200, 3000], revealSpeed: [.25, 4],maxWords:[45,150],floorAfterCards:[1,22],floorStabilityMs:[500,5000] };
  const config = { ...DEFAULT_TAROT_CONFIG, ...current };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (Number.isFinite(input[key])) config[key] = key === "revealSpeed" ? Math.max(min, Math.min(max, input[key])) : Math.round(Math.max(min, Math.min(max, input[key])));
  }
  if (typeof input.automatic === "boolean") config.automatic = input.automatic;
  for (const key of ["autoAnalyze", "repeatOnReturn","floorEnabled","glareProtection"]) if (typeof input[key] === "boolean") config[key] = input[key];
  return config;
}

export function publicTarotSnapshot(value = createTarotState(), includePrivate = false) {
  if (includePrivate) return {...structuredClone(value),hallucination:hallucinationSnapshot(value.hallucination||createHallucination(),true)};
  return {hallucination:hallucinationSnapshot(value.hallucination||createHallucination()),active:value.active,suspended:Boolean(value.suspended),sequence:value.sequence, currentCard: value.currentCard,currentCards:value.currentCards||[],
    floor:{phase:value.floor?.phase||"idle",selected:value.floor?.selected||null},
    response: value.response ? { id: value.response.id, text: value.response.text, segments: value.response.segments,
      elements: value.response.elements, status: value.response.status, origin: value.response.origin || "generated", presentedChars: value.response.presentedChars || 0,interruptedBy:value.response.interruptedBy||null } : null,
    generation: value.generation, visual: normalizeTarotVisual(value.visual),
    presentation: { autoAnalyze: value.config.autoAnalyze !== false, repeatOnReturn: Boolean(value.config.repeatOnReturn), stabilityMs: value.config.stabilityMs || 450, revealSpeed: value.config.revealSpeed || 1,glareProtection:value.config.glareProtection!==false },
    camera: { enabled: value.camera.enabled, automatic: value.camera.automatic, captureSequence: value.camera.captureSequence },
    autonomy: { status: value.autonomy.status } };
}

export function restoredTarotState(value) {
  const initial = createTarotState();
  if (!value) return initial;
  return { ...initial, ...value, active: false, requestId: null, generation: "idle", error: null,
    hallucination:restoreHallucination(value.hallucination),floor:createFloorState(),currentCards:value.currentCards|| (value.currentCard?[value.currentCard]:[]),readCards:value.readCards||[],
    config: normalizeTarotConfig(value.config), visual: normalizeTarotVisual(value.visual),
    camera: { ...initial.camera, ...value.camera, enabled: false, owner: null, leaseUntil: 0, status: "waiting", devices: [] },
    response: value.response && (value.response.narrativeVersion===TAROT_NARRATIVE_VERSION||["stage","catalog"].includes(value.response.origin)) ? { ...value.response, status: "interrupted" } : null,
    autonomy: { ...value.autonomy, status: "paused" } };
}

export function canAutonomousTurn(state, now = Date.now()) {
  return state.active && state.autonomy.status === "running" && state.generation !== "pending" &&
    state.response?.status !== "presenting" && state.autonomy.count < state.config.maxCards &&
    now - state.autonomy.startedAt < state.config.maxDurationMs;
}

export function normalizeElements(elements = []) {
  if (!Array.isArray(elements)) return [];
  const ids = new Set();
  return elements.slice(0, 18).flatMap((element, index) => {
    const name = `${element?.name || ""}`.trim().slice(0, 70);
    if (!name) return [];
    const id = `${element.id || `element-${index}`}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
    if (!id || ids.has(id)) return [];
    ids.add(id);
    let region = element.region;
    if (!Array.isArray(region) || region.length !== 4 || !region.every(Number.isFinite) ||
      region[0] < 0 || region[1] < 0 || region[2] <= 0 || region[3] <= 0 ||
      region[0] + region[2] > 1.001 || region[1] + region[3] > 1.001) region = null;
    const points = Array.isArray(element.points) && element.points.length >= 3 && element.points.length <= 24 &&
      element.points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p.every((v) => v >= 0 && v <= 1)) ? element.points : null;
    return [{ id, name, description: `${element.description || ""}`.slice(0, 250),
      category: `${element.category || ""}`.slice(0, 60), region,
      shape: ["box", "circle", "underline", "polygon"].includes(element.shape) ? element.shape : "box", points,
      validated: Boolean(element.validated && region), origin: ["operator", "editorial"].includes(element.origin) ? element.origin : "model",
      uncertainty: `${element.uncertainty || ""}`.slice(0, 350), relations: Array.isArray(element.relations) ? element.relations.filter((id)=>typeof id==="string").slice(0,12) : [] }];
  });
}

export const TAROT_NARRATIVE_VERSION = 2;

export function normalizeNarrative(value, knownElements, {maxWords=90}={}) {
  const ids=new Set(knownElements.map(({id})=>id));
  const idPattern=ids.size?new RegExp(`\\b(?:${[...ids].map((id)=>id.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})\\b`,"g"):null;
  const clean=(text)=>(idPattern?`${text||""}`.replace(idPattern,""):`${text||""}`).replace(/\(\s*[,;\s]*\)|\[\s*[,;\s]*\]/g,"").replace(/^\s*[,;:–—\s-]+/,"").replace(/caixa\s+preta/gi,"o espetáculo").replace(/(^|[.!?]\s+)(?:observação|interpretação|associação(?: dramatúrgica)?|cena teatral|pergunta(?: curta)?(?: para a plateia)?)\s*[:–—]\s*/giu,"$1").trim();
  const structured=["observation","interpretation","association"].every((key)=>Array.isArray(value?.[key])&&value[key].length);
  const segmenter=structured?new Intl.Segmenter("pt",{granularity:"sentence"}):null;
  const groups=(structured?["observation","interpretation","association"].map((key)=>({key,items:value[key]})):[{key:"legacy",items:Array.isArray(value?.segments)?value.segments:[]}]).map(({key,items})=>({key,items:items.slice(0,structured?3:18).flatMap((item)=>{
    const phrase=clean(item?.text);if(!phrase)return [];
    if(structured&&!/[.!?…]["'»”’)\]]*$/u.test(phrase))throw new Error("TAROT_NARRATIVE_INCOMPLETE");
    const sentences=structured?[...segmenter.segment(phrase)].map(({segment})=>segment.trim()).filter((s)=>/[.!?…]["'»”’)\]]*$/u.test(s)):[phrase];
    if(!sentences.length||sentences[0].length>1200)throw new Error("TAROT_NARRATIVE_INCOMPLETE");
    return [{...item,sentences}];
  })}));
  // Reserve a whole first sentence for every clause, preserving both cards and
  // their reveal IDs. Spend the remaining global budget only on whole sentences.
  // Completeness wins if those mandatory sentences slightly exceed the target.
  const words=(s)=>s.split(/\s+/).length;
  let remaining=maxWords-groups.reduce((n,g)=>n+g.items.reduce((m,item)=>m+words(item.sentences[0]),0),0);
  const segments=[],paragraphs=new Set();let text="";
  for(const {key,items} of groups){
    let first=true;
    for(const item of items){
      let phrase=item.sentences[0];
      for(const sentence of item.sentences.slice(1)){
        if(words(sentence)>remaining||phrase.length+sentence.length+1>1200)break;
        phrase+=` ${sentence}`;remaining-=words(sentence);
      }
      const separator=text?(structured&&!first?" ":"\n\n"):"";
      text+=separator;
      segments.push({text:phrase,elementIds:Array.isArray(item?.elementIds)?[...new Set(item.elementIds.filter((id)=>ids.has(id)))].slice(0,4):[],start:text.length,paragraph:key});
      text+=phrase;paragraphs.add(key);first=false;
    }
  }
  if(!segments.length||(structured&&paragraphs.size!==3)||text.length>7000)throw new Error("TAROT_NARRATIVE_INVALID");
  return {segments,text,narrativeVersion:TAROT_NARRATIVE_VERSION};
}
