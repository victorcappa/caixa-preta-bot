import { createHallucination, patchHallucination, transport, removeHallucination, defaultEffect, EFFECTS, builtInPreset, elapsed } from "./hallucination.js";
import { randomUUID } from "node:crypto";
import { canAutonomousTurn, createTarotState, normalizeTarotConfig, normalizeTarotVisual, TAROT_NARRATIVE_VERSION } from "./state.js";

import { createFloorState, readingCards, readingSignature, normalizeFloorLayout, sameFloorLayout, nearby, removalInstruction, FLOOR_INVITATION, FLOOR_CLOSING } from "./floor.js";

// A facet of showState, with its existing revision, recovery, conversation and SSE.
export function createTarotController({ get, set, emit, addMessage, runTurn, sessionId }) {
  let pending = null;
  let timer = null,lastFloorPublish=0;
  function publish() { get().sequence++; emit({ type: "tarot" }); }
  function cancel() {
    clearTimeout(timer); timer = null;
    pending?.controller.abort("TAROT_INTERRUPTED"); pending = null;
    const state = get();
    state.requestId = null; state.generation = "idle";
    if (state.response?.status === "presenting") state.response.status = "interrupted";
  }
  function pause() {
    cancel();get().suspended=true;transport(get().hallucination||=createHallucination(),"stop");
    if (get().autonomy.status === "running") get().autonomy.status = "paused";
  }
  function schedule() {
    clearTimeout(timer);
    const state = get();
    if (state.autonomy.status !== "running") return;
    if (!canAutonomousTurn(state)) {
      if (state.autonomy.count >= state.config.maxCards || Date.now() - state.autonomy.startedAt >= state.config.maxDurationMs) {
        state.autonomy.status = "finished"; publish();
      }
      return;
    }
    timer = setTimeout(() => { timer = null; void runTurn().catch(() => { pause(); get().error = "TAROT_AUTONOMY_FAILED"; publish(); }); }, state.config.intervalMs);
    timer.unref?.();
  }
  function stageLine(text) {
    cancel();const message=addMessage("assistant",text,"tarot-stage");
    get().response={id:message.id,text,segments:[{text,elementIds:[],start:0}],elements:[],origin:"stage",status:"presenting",presentedChars:0};
  }
  function inviteFloor(){transport(get().hallucination||=createHallucination(),"stop");get().autonomy.status="off";get().floor=createFloorState();get().floor.phase="inviting";stageLine(FLOOR_INVITATION);}
  function begin({ requestId = randomUUID(), question = "", autonomous = false,automatic=false } = {}) {
    const state = get();
    if (state.recentRequestIds.includes(requestId)) return { duplicate: true };
    if (!state.active || !state.currentCard) throw new Error("TAROT_NOT_READY");
    if(!["idle","interpreting"].includes(state.floor.phase))throw new Error("TAROT_AWAIT_REVEAL");
    if(state.suspended&&(automatic||autonomous))throw new Error("TAROT_PAUSED");
    if(!automatic&&!autonomous)state.suspended=false;
    if (pending || state.response?.status === "presenting") throw new Error("TAROT_BUSY");
    clearTimeout(timer);
    if (question) addMessage("user", question, "tarot-question");
    const controller = new AbortController();
    pending = { requestId, controller, cardId: state.currentCard.id, source: state.currentCard.source,
      version: state.currentCard.version, signature:readingSignature(readingCards(state)),cardIds:readingCards(state).map((c)=>c.id),session: sessionId(), question, autonomous };
    state.requestId = requestId; state.generation = "pending"; state.error = null;
    state.recentRequestIds = [...state.recentRequestIds, requestId].slice(-100);
    publish();
    return pending;
  }
  function isCurrent(job) {
    const state = get();
    return pending === job && !job.controller.signal.aborted && job.session === sessionId() && state.active &&
      readingSignature(readingCards(state)) === job.signature && state.currentCard?.source === job.source;
  }
  function finish(job, narrative, elements) {
    if (!isCurrent(job)) return false;
    const state = get();
    const message = addMessage("assistant", narrative.text, "tarot-response");
    // Presentation metadata lives on the shared conversation message, never in a second chat memory.
    message.tarot = { cardId:job.cardId,version:job.version,cardIds:job.cardIds,signature:job.signature,segments:narrative.segments,narrativeVersion:narrative.narrativeVersion };
    if (job.question) state.answeredQuestions++;
    state.response = { ...narrative, id: message.id, elements, status: "presenting", presentedChars: 0 };
    state.generation = "idle"; state.requestId = null; pending = null;
    publish();
    return true;
  }
  function fail(job, code) {
    if (!isCurrent(job)) return false;
    pending = null; get().requestId = null; get().generation = "failed";
    get().error = code; get().autonomy.status = get().autonomy.status === "running" ? "paused" : get().autonomy.status;
    publish(); return true;
  }
  function control(action, data = {}) {
    const state = get();
    const h=state.hallucination ||= createHallucination();
    if(action === "hallucination") {patchHallucination(h,data.patch);}
    else if(action === "hallucination-transport") {
      if(!["play","pause","stop","restart"].includes(data.command))throw new Error("TAROT_TRANSPORT_INVALID");
      if(["play","restart"].includes(data.command)&&(!state.active||!state.currentCard||state.suspended))throw new Error("TAROT_NOT_READY");
      transport(h,data.command,state.currentCard?.id,readingSignature(readingCards(state)));
      if(["play","restart"].includes(data.command)){h.run.absent=false;}
    } else if(action === "hallucination-manual") {
      if(!EFFECTS[data.effect]||!["on","off","timeline"].includes(data.mode))throw new Error("TAROT_EFFECT_INVALID");
      if(data.mode==="on"&&h.run.status==="stopped"){if(!state.active||!state.currentCard||state.suspended)throw new Error("TAROT_NOT_READY");transport(h,"restart",state.currentCard.id,readingSignature(readingCards(state)));h.run.manualOnly=true;}
      if(data.mode==="timeline")delete h.run.overrides[data.effect];
      else h.run.overrides[data.effect]={mode:data.mode,until:data.mode==="off"?1e12:elapsed(h)+h.effects[data.effect].duration};
    } else if(action === "hallucination-reset-effect") {if(EFFECTS[data.effect]){h.effects[data.effect]=defaultEffect(data.effect);delete h.run.overrides[data.effect];}}
    else if(action === "hallucination-next-face"){h.run.assetIndex=(h.run.assetIndex||0)+1;}
    else if(action === "hallucination-count-reset"){h.seenCards=[];}
    else if(action === "hallucination-assets"){h.assets=data.assets;}
    else if(action === "hallucination-memory"){
      h.memories=(Array.isArray(data.memories)?data.memories:[]).slice(0,30).map(m=>({id:`${m.id||randomUUID()}`.slice(0,80),title:`${m.title||"Documento"}`.slice(0,120),text:`${m.text||""}`.slice(0,12000),enabled:m.enabled!==false}));
    } else if(action === "hallucination-preset") {
      if(data.operation==="save"){const name=`${data.name||"Personalizado"}`.slice(0,80);h.presets=[...h.presets.filter(p=>p.name!==name),{name,patch:{effects:structuredClone(h.effects),events:structuredClone(h.events),afterCards:h.afterCards,automatic:h.automatic,requireFusion:h.requireFusion,onRemoval:h.onRemoval,eligibleCardIds:h.eligibleCardIds}}].slice(-30);}
      else if(data.operation==="delete")h.presets=h.presets.filter(p=>p.name!==data.name);
      else {if(data.name!=="personalizado"){const patch=h.presets.find(p=>p.name===data.name)?.patch||builtInPreset(data.name);patchHallucination(h,patch);}h.preset=data.name;}
    } else if(action.startsWith("hallucination"))throw new Error("TAROT_ACTION_UNKNOWN");
    else if (action === "claim-camera") {
      if (typeof data.owner !== "string" || !/^[\w-]{1,100}$/.test(data.owner)) throw new Error("TAROT_OWNER_INVALID");
      if (state.camera.owner && state.camera.owner !== data.owner && state.camera.leaseUntil > Date.now()) throw new Error("TAROT_CAMERA_OWNED");
      state.camera.owner = data.owner; state.camera.leaseUntil = Date.now() + 15000;
      // A lease heartbeat doesn't need to generate an SSE snapshot.
      return { owner: data.owner, camera: structuredClone(state.camera) };
    }
    if(action.startsWith("hallucination")){publish();return {ok:true};}
    if (action === "camera-status") {
      if (state.camera.owner !== data.owner || state.camera.leaseUntil < Date.now()) throw new Error("TAROT_CAMERA_NOT_OWNER");
      state.camera.status = `${data.status || "waiting"}`.slice(0, 60);
      if (Array.isArray(data.devices)) state.camera.devices = data.devices.slice(0, 20).map((d) => ({ deviceId: `${d.deviceId}`.slice(0, 200), label: `${d.label}`.slice(0, 100) }));
      if (data.error) state.error = `${data.error}`.slice(0, 160);
      if (data.metrics && typeof data.metrics === "object") {
        const metrics = {};
        for (const key of ["processingMs", "inliers", "matches", "descriptors"]) if (Number.isFinite(data.metrics[key])) metrics[key] = Math.max(0, Math.min(60000, data.metrics[key]));
        state.metrics = { ...state.metrics, ...metrics, at: Date.now() };
      }
    } else if (action === "release-camera") {
      if (state.camera.owner !== data.owner) return { ok: true };
      state.camera.owner = null; state.camera.leaseUntil = 0; state.camera.status = "waiting";
    } else if (action === "start") {
      if(state.floor.phase==="complete"){state.floor=createFloorState();state.readCards=[];state.currentCards=[];state.currentCard=null;state.response=null;}
      state.active=true;state.suspended=false;state.camera.enabled=true;
    } else if (action === "end") { pause(); state.active = false; state.camera.enabled = false; state.autonomy.status = "off";
    } else if (action === "reset") { cancel(); const fresh = createTarotState(); fresh.config=state.config;fresh.visual=state.visual;fresh.hallucination=state.hallucination;transport(fresh.hallucination,"stop");fresh.hallucination.seenCards=[];fresh.camera = { ...state.camera, enabled: false }; set(fresh);
    } else if (action === "interrupt") { pause();
    } else if (action === "tracking-lost") {
      if(state.camera.owner!==data.owner||state.camera.leaseUntil<Date.now())throw new Error("TAROT_CAMERA_NOT_OWNER");
      if(data.signature!==readingSignature(readingCards(state))||!["camera","manual-camera"].includes(state.currentCard?.source)||state.response?.origin==="stage")return {ok:true,ignored:true};
      if(data.responseId&&data.responseId!==state.response?.id)return {ok:true,ignored:true};
      removeHallucination(h);
      if(state.response&&Number.isFinite(data.chars))state.response.presentedChars=Math.max(state.response.presentedChars||0,Math.min(state.response.text.length,Math.floor(data.chars)));
      if(pending||state.response?.status==="presenting"){cancel();if(state.response?.status==="interrupted")state.response.interruptedBy="tracking-lost";}
    } else if (action === "tracking-resumed") {
      if(state.camera.owner!==data.owner||state.camera.leaseUntil<Date.now())throw new Error("TAROT_CAMERA_NOT_OWNER");
      if(state.active&&!state.suspended&&h.run.absent&&h.onRemoval==="pause"&&data.signature===readingSignature(readingCards(state))&&h.run.signature===data.signature){h.run.absent=false;transport(h,"play",state.currentCard?.id,data.signature);}
      if(!state.suspended&&data.signature===readingSignature(readingCards(state))&&state.response?.status==="interrupted"&&state.response.interruptedBy==="tracking-lost") {state.response.status="presenting";state.response.interruptedBy=null;}
    } else if (action === "floor-start") {
      if(!state.active)throw new Error("TAROT_NOT_READY");state.suspended=false;inviteFloor();
    } else if (action === "floor-reset") {
      cancel();state.floor=createFloorState();state.readCards=[];state.response=null;
    } else if (action === "floor-layout") {
      if(state.camera.owner!==data.owner||state.camera.leaseUntil<Date.now())throw new Error("TAROT_CAMERA_NOT_OWNER");
      const floor=state.floor;
      if(!state.active||state.suspended||!state.camera.enabled||!["scanning","await-removal"].includes(floor.phase))return {ok:true,ignored:true};
      const layout=normalizeFloorLayout(data.cards),now=Date.now();
      if(floor.phase==="scanning"){
        if(layout.length!==22){floor.layout=[];floor.stableSince=0;floor.error=`Detectadas ${layout.length}/22 cartas de costas. Separe as cartas e mantenha todas visíveis.`;return {ok:true};}
        if(!sameFloorLayout(floor.layout,layout)){floor.layout=layout;floor.stableSince=now;return {ok:true};}
        if(now-floor.stableSince<state.config.floorStabilityMs)return {ok:true};
        const slot=Math.min(layout.length-1,Math.floor(Math.random()*layout.length));
        floor.selected={...layout[slot],slot:slot+1};floor.layout=layout;floor.phase="announcing";floor.error=null;
        stageLine(removalInstruction(slot+1,layout[slot]));
      }else{
        const selected=floor.selected,others=floor.layout.filter((item)=>item!==floor.layout[selected.slot-1]);
        const stillThere=layout.some((item)=>nearby(item,selected));
        if(stillThere){floor.selected={...selected,...layout.find((item)=>nearby(item,selected))};if(sameFloorLayout(floor.layout,layout))floor.layout=floor.layout.map((item)=>layout.find((other)=>nearby(item,other))||item);floor.missingSince=0;floor.removalHits=0;if(now-lastFloorPublish>400){lastFloorPublish=now;publish();}return {ok:true};}
        if(layout.length!==others.length||!others.every((item)=>layout.some((candidate)=>nearby(item,candidate)))){
          floor.missingSince=0;floor.removalHits=0;floor.error="Mantenha a disposição e as demais cartas visíveis.";return {ok:true};
        }
        floor.missingSince ||= now;floor.removalHits++;
        if(floor.removalHits>=3&&now-floor.missingSince>=700){floor.phase="await-reveal";floor.selected={...selected,removed:true};floor.error=null;}
      }
    } else if (action === "resume-speech") {
      state.suspended=false;
      if (state.active && state.response?.status === "interrupted") state.response.status = "presenting";
    } else if (action === "camera") {
      if (typeof data.enabled === "boolean") {state.camera.enabled = data.enabled;if(!data.enabled)removeHallucination(h);}
      if (typeof data.automatic === "boolean") state.camera.automatic = data.automatic;
      if (typeof data.deviceId === "string") state.camera.deviceId = data.deviceId.slice(0, 200);
      if (data.capture) state.camera.captureSequence++;
    } else if (action === "select") {
      if (!data.card || !Number.isInteger(data.card.id)) throw new Error("TAROT_CARD_INVALID");
      if (data.source === "camera" && (state.camera.owner !== data.owner || state.camera.leaseUntil < Date.now())) throw new Error("TAROT_CAMERA_NOT_OWNER");
      const supplied=(data.cards||[data.card]).slice(0,2).sort((a,b)=>a.id-b.id);
      const signature=readingSignature(supplied);
      if(state.floor.phase==="await-reveal"&&supplied.length!==1)throw new Error("TAROT_SHOW_CHOSEN_CARD_ONLY");
      if(data.source==="camera"&&!data.newVisit&&readingSignature(readingCards(state))===signature&&state.currentCard?.source==="camera")return {ok:true,duplicate:true};
      cancel();
      state.currentCard = { id: data.card.id, name: data.card.name, number: data.card.number, version: data.card.version, elements: data.card.elements,
        imageUrl: data.card.imageUrl, surface: data.card.surface, relationships: data.card.relationships,
        source: ["camera", "manual-camera", "bot"].includes(data.source) ? data.source : "manual-camera",
        // Inliers/matches are measured geometric evidence, never a model probability.
        evidence: data.source === "camera" ? { inliers: Math.max(0, Math.min(5000, Number(data.inliers) || 0)), matches: Math.max(0, Math.min(5000, Number(data.matches) || 0)) } : null };
      state.currentCards=supplied.map((card)=>({id:card.id,number:card.number,name:card.name,version:card.version,imageUrl:card.imageUrl,elements:card.elements,surface:card.surface,relationships:card.relationships,source:state.currentCard.source,evidence:state.currentCard.evidence}));
      state.currentCard=state.currentCards[0];
      const hallucinationCard=state.currentCards.find(c=>(!h.eligibleCardIds.length||h.eligibleCardIds.includes(c.id))&&(!h.requireFusion||h.assets.some(a=>a.cardId===c.id&&a.cardVersion===c.version)));
      const eligible=Boolean(hallucinationCard);
      for(const card of state.currentCards)if(!h.seenCards.includes(card.id))h.seenCards.push(card.id);
      transport(h,"stop");h.run.absent=false;
      if(h.automatic&&eligible&&h.seenCards.length>=h.afterCards&&!state.suspended&&state.active){transport(h,"restart",hallucinationCard.id,signature);}
      if(state.floor.phase==="await-reveal"&&data.source==="camera")state.floor.phase="interpreting";
      state.response = null; state.error = null;
    } else if (action === "config") {
      state.config = normalizeTarotConfig(data.config, state.config);
    } else if (action === "visual") {
      state.visual = normalizeTarotVisual(data.visual, state.visual);
    } else if (action === "restore-presentation") {
      if(data.message.tarot?.narrativeVersion!==TAROT_NARRATIVE_VERSION)throw new Error("TAROT_NARRATIVE_OUTDATED");
      if (!state.active || !state.currentCard || (data.message.tarot?.signature||`${data.message.tarot?.cardId}:${data.message.tarot?.version}`)!==readingSignature(readingCards(state))) throw new Error("TAROT_CARD_CHANGED");
      cancel(); state.response = { id: data.message.id, text: data.message.content, segments: data.message.tarot.segments,
        elements: readingCards(state).flatMap((c)=>c.elements.map((e)=>({...e,cardId:c.id}))),status:"presenting",presentedChars:0,origin:"resumed",narrativeVersion:TAROT_NARRATIVE_VERSION };
    } else if (action === "catalog-updated") {
      const current=readingCards(state),changed=current.find((c)=>c.id===data.card.id);
      if(changed){
        if(changed.version!==data.card.version){pause();state.response=null;}else if(pending)cancel();
        state.currentCards=current.map((c)=>c.id===data.card.id?{...c,version:data.card.version,imageUrl:data.card.imageUrl,name:data.card.name,elements:data.card.elements,surface:data.card.surface,relationships:data.card.relationships}:c);
        state.currentCard=state.currentCards[0];
        if(state.response)state.response.elements=state.currentCards.flatMap((c)=>c.elements.map((e)=>({...e,cardId:c.id})));
      }
    } else if (action === "instruction") {
      state.privateInstruction = `${data.text || ""}`.slice(0, 4000);
    } else if (action === "contingency") {
      if (!state.currentCard || !data.text) throw new Error("TAROT_CONTINGENCY_MISSING");
      cancel();
      const text = `${data.text}`.slice(0, 4000).replace(/caixa\s+preta/gi, "o espetáculo");
      const message = addMessage("assistant", text, "tarot-contingency");
      state.response = { id: message.id, text, segments: [{ text, elementIds: state.currentCard.elements.map((e) => e.id) }],
        elements: state.currentCard.elements, status: "presenting", presentedChars: 0, origin: "catalog" };
    } else if (action === "contexts") {
      if (!Array.isArray(data.contexts)) throw new Error("TAROT_CONTEXT_INVALID");
      state.contexts = data.contexts.slice(0, 20).filter((c) => typeof c.text === "string" && /^https?:\/\//.test(c.url || "") && /^\d{4}-\d{2}-\d{2}$/.test(c.date || ""))
        .map((c) => ({ text: c.text.slice(0, 1400), url: c.url.slice(0, 500), date: c.date, enabled: c.enabled !== false }));
    } else if (action === "profile") {
      const fields = ["humor", "provocation", "philosophy", "association", "social", "poetry", "rigor"];
      state.profile = Object.fromEntries(fields.filter((key) => Number.isFinite(data.profile?.[key])).map((key) => [key, Math.max(0, Math.min(100, data.profile[key]))]));
    } else if (action === "autonomy-start" || action === "autonomy-resume") {
      state.active=true;state.suspended=false;
      if (action === "autonomy-start") { state.autonomy.count = 0; state.autonomy.used = []; state.autonomy.startedAt = Date.now(); }
      if (!state.autonomy.startedAt) state.autonomy.startedAt = Date.now();
      if (action === "autonomy-resume" && state.response?.status === "interrupted") state.response.status = "presenting";
      state.autonomy.status = "running"; schedule();
    } else if (action === "autonomy-pause") { pause();
    } else if (action === "human") { pause();state.suspended=false; state.autonomy.status = "off";
    } else if (action === "autonomy-card") {
      if (!canAutonomousTurn(state)) throw new Error("TAROT_AUTONOMY_LIMIT");
      state.autonomy.count++; state.autonomy.used.push(data.cardId);
    } else if (action === "progress" || action === "presented") {
      if (state.camera.owner !== data.owner || state.camera.leaseUntil < Date.now()) throw new Error("TAROT_CAMERA_NOT_OWNER");
      if (!state.active || state.response?.id !== data.responseId || (state.response.status!=="presenting"&&!(action==="progress"&&state.response.status==="interrupted")))return {ok:true,ignored:true};
      const count = Math.floor(Number(data.chars));
      if (Number.isFinite(count)) state.response.presentedChars = Math.max(state.response.presentedChars, Math.min(count, state.response.text.length));
      if (action === "presented") {
        if (state.response.presentedChars < state.response.text.length) throw new Error("TAROT_PRESENTATION_INCOMPLETE");
        state.response.status = "complete";
        const floor=state.floor;
        if(state.response.origin==="stage"){
          if(floor.phase==="inviting")floor.phase="scanning";
          else if(floor.phase==="announcing")floor.phase="await-removal";
          else if(floor.phase==="closing")floor.phase="complete";
          publish();return {ok:true};
        }
        if(floor.phase==="interpreting"){floor.phase="closing";stageLine(FLOOR_CLOSING);publish();return {ok:true};}
        if(floor.phase==="idle"&&state.response.origin!=="catalog"){
          state.readCards=[...new Set([...state.readCards,...readingCards(state).map((c)=>c.id)])];
          if(state.config.floorEnabled&&state.readCards.length>=state.config.floorAfterCards){inviteFloor();publish();return {ok:true};}
        }
        if (floor.phase==="idle"&&state.config.automatic && state.answeredQuestions >= state.config.questionsUntilAutonomy && state.autonomy.status === "off") {
          state.autonomy = { status: "running", count: 0, startedAt: Date.now(), used: [] };
        }
        schedule();
      }
    } else throw new Error("TAROT_ACTION_UNKNOWN");
    publish();
    return { ok: true };
  }
  return { version: 5, control, begin, finish, fail, isCurrent, cancel, pause, schedule };
}
