import {showState} from '@/lib/showState';
import {sameOrigin,currentSession} from '@/lib/tarot/http';
import {faceLibrary,sourcePhotos,savePrepared,writeFaceLibrary} from '@/lib/tarot/face-store';
import {readCatalog} from '@/lib/tarot/catalog';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){return Response.json({...await faceLibrary(),sources:await sourcePhotos()},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request){
 if(!sameOrigin(request))return Response.json({error:'ORIGIN_NOT_ALLOWED'},{status:403});
 try{
  const multipart=request.headers.get('content-type')?.includes('multipart/form-data');
  let body,form;if(multipart){form=await request.formData();body=JSON.parse(form.get('metadata')||'{}');body.sessionId=form.get('sessionId');}else body=await request.json();
  if(!currentSession(body))return Response.json({error:'TAROT_SESSION_CHANGED'},{status:409});
  if(multipart){const image=form.get('image');if(!image||image.size>12*1024*1024)throw new Error('TAROT_IMAGE_INVALID');await savePrepared(body.kind,Buffer.from(await image.arrayBuffer()),body);}
  else await writeFaceLibrary(async db=>{
   if(body.action==='approve'){const asset=db.fusions.find(f=>f.id===body.id);if(!asset)throw new Error('TAROT_FUSION_MISSING');if(asset.pipelineVersion!==2&&body.approved===true)throw new Error('TAROT_FUSION_OUTDATED');const card=(await readCatalog()).find(c=>c.id===asset.cardId);if(card.version!==asset.cardVersion)throw new Error('TAROT_REFERENCE_CHANGED');if(body.approved===true&&!db.templates.some(t=>t.cardId===asset.cardId&&t.version===asset.templateVersion))throw new Error('TAROT_TEMPLATE_CHANGED');asset.approved=body.approved===true;}
   else if(body.action==='select'){const f=db.faces.find(f=>f.id===body.id);if(f)f.selected=body.selected===true;}
   else if(body.action==='templates')db.templates=(Array.isArray(body.templates)?body.templates:[]).slice(0,44).filter(t=>Number.isInteger(t.cardId)&&t.cardId>=0&&t.cardId<=21&&Array.isArray(t.region)&&t.region.length===4&&t.region.every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&t.region[2]>0&&t.region[3]>0&&t.region[0]+t.region[2]<=1&&t.region[1]+t.region[3]<=1).map(t=>({cardId:t.cardId,region:t.region,rotation:Math.max(-180,Math.min(180,Number(t.rotation)||0)),yaw:Math.max(-1,Math.min(1,Number(t.yaw)||0)),points:Array.isArray(t.points)&&t.points.length===17&&t.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1))?t.points:null,version:db.templates.find(old=>old.cardId===t.cardId&&JSON.stringify([old.region,old.rotation,old.yaw,old.points||null,old.cardVersion])===JSON.stringify([t.region,t.rotation,t.yaw,t.points||null,t.cardVersion]))?.version||globalThis.crypto.randomUUID(),cardVersion:t.cardVersion}));
   else if(body.action!=='ready')throw new Error('TAROT_ACTION_UNKNOWN');
  });
  const db=await faceLibrary(),cards=await readCatalog();
  showState.controlTarot('hallucination-assets',{assets:db.fusions.filter(f=>f.approved&&f.pipelineVersion===2&&cards.find(c=>c.id===f.cardId)?.version===f.cardVersion&&db.templates.some(t=>t.cardId===f.cardId&&t.version===f.templateVersion)).map(({id,cardId,url,surface,region,cardVersion})=>({id,cardId,url,surface,region,cardVersion}))});
  return Response.json({...db,sources:await sourcePhotos()});
 }catch(error){return Response.json({error:/^TAROT_/.test(error.message)?error.message:'TAROT_FACE_PREPARATION_FAILED'},{status:409});}
}
