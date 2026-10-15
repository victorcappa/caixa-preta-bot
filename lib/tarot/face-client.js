'use client';
let worker=null,pending=new Map();
export function cancelFaceWork(){worker?.terminate();worker=null;for(const {reject,timer}of pending.values()){clearTimeout(timer);reject(new Error('Preparação cancelada'));}pending.clear();}
export function faceJob(action,data){
 if(!worker){worker=new Worker('/tarot-face.worker.js');worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);data.error?p.reject(new Error(data.error)):p.resolve(data);};worker.onerror=()=>cancelFaceWork();}
 return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{cancelFaceWork();reject(new Error('Tempo de processamento excedido'));},90000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,action,...data});});
}
export async function saveFaceAsset(sessionId,kind,blob,meta){const form=new FormData();form.set('sessionId',sessionId);form.set('metadata',JSON.stringify({...meta,kind}));form.set('image',blob,'prepared.png');const r=await fetch('/api/tarot/faces',{method:'POST',body:form});const data=await r.json();if(!r.ok)throw new Error(data.error);return data;}
export async function faceLibraryCommand(sessionId,data){const r=await fetch('/api/tarot/faces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,sessionId})});const result=await r.json();if(!r.ok)throw new Error(result.error);return result;}
