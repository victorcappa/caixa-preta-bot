import { showState } from '@/lib/showState';
import { sameOrigin, currentSession } from '@/lib/tarot/http';
import { readCatalog } from '@/lib/tarot/catalog';
import { referenceStatus, retrieveTarotReferences } from '@/lib/tarot/references';
import { generateTarotTurn } from '@/lib/openai';
import { normalizeNarrative } from '@/lib/tarot/state';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET() {
  try{return Response.json(await referenceStatus(),{headers:{'Cache-Control':'no-store'}});}
  catch {return Response.json({error:'TAROT_REFERENCE_LOAD_FAILED'},{status:503});}
}
export async function POST(request) {
  if(!sameOrigin(request))return Response.json({error:'ORIGIN_NOT_ALLOWED'},{status:403});
  const body=await request.json().catch(()=>null);
  if(!currentSession(body))return Response.json({error:'TAROT_SESSION_CHANGED'},{status:409});
  try {
    if(body.action==='reindex')return Response.json(await referenceStatus({force:true}));
    if(!['search','generate'].includes(body.action))throw new Error('TAROT_ACTION_UNKNOWN');
    if(!['normal','associative','hallucinatory'].includes(body.mode))throw new Error('TAROT_REFERENCE_MODE_INVALID');
    const card=(await readCatalog()).find(c=>c.id===body.cardId);
    if(!card)throw new Error('TAROT_REFERENCE_MISSING');
    // Detached value from the existing session. No begin/finish, history write or SSE mutation.
    const state=structuredClone(showState.privateSnapshot());
    state.tarot.currentCard={...card,source:'private-test'};state.tarot.currentCards=[state.tarot.currentCard];
    state.tarot.config.associationIntensity={normal:0,associative:60,hallucinatory:100}[body.mode];
    const h=state.tarot.hallucination;
    h.enabled=body.mode==='hallucinatory';h.run.status=h.enabled?'playing':'stopped';
    h.run.anchorMono=performance.now();h.run.absent=false;h.run.overrides={};
    for(const key of ['association','repetition','contradiction','confusion','documents'])h.effects[key]={...h.effects[key],enabled:h.enabled,mode:'on',intensity:key==='association'?90:55};
    const question=typeof body.question==='string'?body.question.slice(0,4000):'';
    const references=await retrieveTarotReferences({state,cards:[card],question,mode:body.mode});
    if(body.action==='search')return Response.json({references});
    const generated=await generateTarotTurn({state,card,cards:[card],question,references,signal:request.signal});
    const narrative=normalizeNarrative(generated,card.elements,{maxWords:state.tarot.config.maxWords});
    if(!currentSession(body))throw new Error('TAROT_SESSION_CHANGED');
    return Response.json({references,narrative});
  } catch(error) {return Response.json({error:/^TAROT_[A-Z_]+$/.test(error.message||'')?error.message:'TAROT_REFERENCE_TEST_FAILED'},{status:409});}
}
