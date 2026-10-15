import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const root=()=>process.env.CAIXA_PRETA_TAROT_FACE_DIR||path.join(process.cwd(),'.runtime/tarot-faces');
let queue=Promise.resolve();
export async function faceLibrary(){try{return JSON.parse(await fs.readFile(path.join(root(),'index.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return {faces:[],fusions:[],templates:JSON.parse(await fs.readFile(path.join(process.cwd(),'assets/tarot/face-templates.json'),'utf8'))};}}
export function writeFaceLibrary(change){const task=queue.then(async()=>{await fs.mkdir(root(),{recursive:true});const db=await faceLibrary();const result=await change(db);const temp=path.join(root(),`${randomUUID()}.tmp`);await fs.writeFile(temp,JSON.stringify(db));await fs.rename(temp,path.join(root(),'index.json'));return result;});queue=task.catch(()=>{});return task;}
export async function sourcePhotos(){return (await fs.readdir(path.join(process.cwd(),'assets/rostos')).catch(()=>[])).filter(f=>/^[\w .-]+\.(jpe?g|png|webp)$/i.test(f));}
export async function sourcePhoto(id){if(!(await sourcePhotos()).includes(id))throw new Error('TAROT_PHOTO_MISSING');return fs.readFile(path.join(process.cwd(),'assets/rostos',id));}
export function savePrepared(kind,bytes,meta){
 return writeFaceLibrary(async(db)=>{
  if(!['face','fusion'].includes(kind)||bytes.length>12*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('TAROT_IMAGE_INVALID');
  const hash=createHash('sha256').update(bytes).digest('hex'),id=`${kind}-${hash.slice(0,24)}`;
  if(kind==='face'){
   if(!Array.isArray(meta.points)||meta.points.length!==17||!meta.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1)))throw new Error('TAROT_FACE_GEOMETRY_INVALID');
   const face={id,name:`${meta.name||'Rosto'}`.slice(0,120),points:meta.points,yaw:Math.max(-1,Math.min(1,Number(meta.yaw)||0)),selected:meta.selected!==false,sourceHash:`${meta.sourceHash||''}`.slice(0,80),elapsedMs:Math.max(0,Number(meta.elapsedMs)||0),url:`/api/tarot/faces/${id}`};
   if(!db.faces.some(f=>f.id===id))db.faces.push(face);
  }else{
   if(!Array.isArray(meta.region)||meta.region.length!==4||!meta.region.every(Number.isFinite)||meta.region[2]<=0||meta.region[3]<=0||!db.faces.some(f=>f.id===meta.faceId)||!Number.isInteger(meta.cardId)||meta.cardId<0||meta.cardId>21||!Array.isArray(meta.surface)||meta.surface.length!==4||!meta.surface.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1)))throw new Error('TAROT_FUSION_INVALID');
   if(!db.fusions.some(f=>f.id===id))db.fusions.push({id,faceId:meta.faceId,cardId:meta.cardId,cardVersion:`${meta.cardVersion||''}`.slice(0,40),templateVersion:`${meta.templateVersion||''}`.slice(0,80),pipelineVersion:meta.pipelineVersion===2?2:1,surface:meta.surface,region:meta.region,approved:false,elapsedMs:Math.max(0,Number(meta.elapsedMs)||0),url:`/api/tarot/faces/${id}`});
  }
  await fs.writeFile(path.join(root(),`${id}.png`),bytes);return id;
 });
}
export async function preparedBytes(id){if(!/^(face|fusion)-[a-f0-9]{24}$/.test(id))throw new Error('TAROT_ASSET_INVALID');const db=await faceLibrary();const found=[...db.faces,...db.fusions].find(a=>a.id===id);if(!found)throw new Error('TAROT_ASSET_MISSING');return {bytes:await fs.readFile(path.join(root(),`${id}.png`)),meta:found};}
