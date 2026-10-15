'use client';
import {useEffect,useRef,useState} from 'react';
import {evaluate} from '@/lib/tarot/hallucination';
import {projectPoint} from '@/lib/tarot/geometry';
import {drawTriangle} from '@/public/tarot-face-mesh';

export function useHallucinationClock(h){
 const [t,setT]=useState(h?.run.elapsed||0),anchor=useRef({h:null,t:0,mono:0});
 if(anchor.current.h!==h){anchor.current={h,t:h?.run.elapsed||0,mono:performance.now()};}
 useEffect(()=>{let frame,last=0;const tick=now=>{if(now-last>40){last=now;const a=anchor.current;setT(a.t+(a.h?.run.status==='playing'?Math.max(0,now-a.mono)/1000:0));}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[]);
 return t;
}
export default function TarotEffects({h,time,geometries=[],cards=[],videoRef,image,present=true,onError}){
 const canvasRef=useRef(null),latest=useRef({}),cache=useRef(new Map());latest.current={h,time,geometries,cards,videoRef,image,present,onError};
 useEffect(()=>{let frame,closed=false,last=0;const ctx=canvasRef.current.getContext('2d'),textures=cache.current;
  function draw(now){if(closed)return;frame=requestAnimationFrame(draw);if(now-last<40)return;last=now;
   const {h,time,geometries,cards,videoRef,image,present}=latest.current,canvas=canvasRef.current;if(!h||!geometries.length){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
   const w=geometries[0].width,hg=geometries[0].height;if(canvas.width!==w||canvas.height!==hg){canvas.width=w;canvas.height=hg;}ctx.clearRect(0,0,w,hg);
   const {levels:L}=evaluate(h,time,present);const motion=Object.values(L).some(n=>n>0);if(!motion)return;
   for(const g of geometries){const card=cards.find(c=>c.id===g.id);if(!card||!g.matrix)continue;const source=image||videoRef?.current;
    const project=(u,v)=>projectPoint(g.matrix,u,v);const [sx,sy,sw,sh]=[0,0,1,1];
    const transformed=(u,v)=>{const p=project(u,v),center=project(.5,.5);if(!p||!center)return null;const breathe=1+Math.sin(time*(.3+h.effects.breathing.speed/25))*L.breathing*.025;return [center[0]+(p[0]-center[0])*breathe+Math.sin(v*20+time*(.4+h.effects.wave.speed/15))*L.wave*w*.006,center[1]+(p[1]-center[1])*breathe+Math.sin(u*24+time*(.5+h.effects.texture.speed/15))*L.texture*hg*.004];};
    if(source&&(L.breathing||L.wave||L.texture||L.double||L.chromatic)&&(!videoRef||source.readyState>=2)){
     ctx.save();ctx.globalAlpha=Math.max(L.breathing,L.wave,L.texture,L.double,L.chromatic);const sourceW=source.videoWidth||source.naturalWidth||source.width,sourceH=source.videoHeight||source.naturalHeight||source.height;
     const grid=6;for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){const uv=[[x/grid,y/grid],[(x+1)/grid,y/grid],[(x+1)/grid,(y+1)/grid],[x/grid,(y+1)/grid]],orig=uv.map(p=>project(...p)),dest=uv.map(p=>transformed(...p));if(orig.some(p=>!p)||dest.some(p=>!p))continue;const src=orig.map(p=>[p[0]*sourceW/w,p[1]*sourceH/hg]);for(const ids of [[0,1,2],[0,2,3]]){drawTriangle(ctx,source,ids.map(i=>src[i]),ids.map(i=>dest[i]));if(L.double){ctx.save();ctx.globalAlpha=L.double*.4;ctx.translate(Math.sin(time*(.3+h.effects.double.speed/15))*12,8);drawTriangle(ctx,source,ids.map(i=>src[i]),ids.map(i=>dest[i]));ctx.restore();}}}ctx.restore();
     if(L.chromatic){ctx.save();ctx.lineWidth=2+L.chromatic*6;for(const [color,shift]of [['#ff2060',-4],['#00ffff',4]]){ctx.strokeStyle=color;ctx.globalAlpha=L.chromatic*.6;ctx.beginPath();(card.surface||[[sx,sy],[sw,sy],[sw,sh],[sx,sh]]).forEach((p,i)=>{const pt=transformed(...p);if(pt)ctx[i?'lineTo':'moveTo'](pt[0]+shift,pt[1]);});ctx.closePath();ctx.stroke();}ctx.restore();}
    }
    const assets=h.assets.filter(a=>a.cardId===g.id&&a.cardVersion===card.version);if(!assets.length||!L.fusion)continue;
    const index=(h.run.assetIndex||0)+(L.identity?Math.floor(time/(1+(100-h.effects.identity.speed)/10)):0),asset=assets[index%assets.length];
    let texture=cache.current.get(asset.url);if(!texture){texture=new Image();texture.onerror=()=>{latest.current.onError?.('TAROT_TEXTURE_UNAVAILABLE');};texture.src=asset.url;cache.current.set(asset.url,texture);}if(!texture.complete||!texture.naturalWidth)continue;
    const region=asset.region;if(!region)continue;const [rx,ry,rw,rh]=region;
    ctx.save();ctx.globalAlpha=L.fusion*((h.effects.fusion.mix??85)/100)*(L.oscillation?1-L.oscillation*(.5+.5*Math.sin(time*(.3+h.effects.oscillation.speed/10))):1);
    const grid=4;for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){const uv=[[x/grid,y/grid],[(x+1)/grid,y/grid],[(x+1)/grid,(y+1)/grid],[x/grid,(y+1)/grid]],src=uv.map(([u,v])=>[u*texture.naturalWidth,v*texture.naturalHeight]),dest=uv.map(([u,v])=>transformed(rx+u*rw+Math.sin(v*Math.PI)*Math.sin(time*(.3+h.effects.morph.speed/15))*L.morph*.004,ry+v*rh));if(dest.some(p=>!p))continue;for(const ids of [[0,1,2],[0,2,3]])drawTriangle(ctx,texture,ids.map(i=>src[i]),ids.map(i=>dest[i]));}ctx.restore();
   }
  }frame=requestAnimationFrame(draw);return()=>{closed=true;cancelAnimationFrame(frame);textures.clear();};
 },[]);
 return <canvas ref={canvasRef} data-tarot-effects aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',pointerEvents:'none'}}/>;
}

export function TarotTextEffects({h,time,text,present=true}){
 const ref=useRef(null),latest=useRef({});latest.current={h,time,text,present};
 useEffect(()=>{let frame;const ctx=ref.current.getContext('2d');const tick=()=>{frame=requestAnimationFrame(tick);const c=ref.current,{h,time,text,present}=latest.current,w=c.clientWidth,ht=c.clientHeight;if(c.width!==w||c.height!==ht){c.width=w;c.height=ht;}ctx.clearRect(0,0,w,ht);if(!h||!text)return;const {levels:L}=evaluate(h,time,present),words=text.split(/\s+/).filter(Boolean).slice(-18);ctx.font='24px monospace';
  for(const key of ['falling','pile','circular','duplicate','textWave','floating','invert','typeChromatic']){if(!L[key])continue;const e=h.effects[key],speed=.15+e.speed/35;ctx.globalAlpha=L[key]*.85;ctx.fillStyle=key==='typeChromatic'?'#ff60a9':'#83ffb1';words.slice(0,Math.max(1,Math.round(e.amount/100*words.length))).forEach((word,i)=>{ctx.save();let x=(i*97+42)%Math.max(1,w-100),y=(i*31+30)%Math.max(1,ht-35);if(key==='falling')y=(time*speed*(12+e.gravity)+i*37)%Math.max(1,ht);if(key==='pile')y=ht-18-(i%3)*23;if(key==='circular'){const a=time*speed*e.direction+i*Math.PI/6,r=Math.min(w,ht)*(.1+e.radius/250);x=w/2+Math.cos(a)*r;y=ht/2+Math.sin(a)*r;ctx.translate(x,y);ctx.rotate(a+Math.PI/2);x=0;y=0;}if(key==='floating')y+=Math.sin(time*speed+i)*15;if(key==='textWave')y+=Math.sin(time*speed+i)*30;if(key==='invert'){ctx.translate(x,y);ctx.scale(-1,1);x=0;y=0;}if(key==='duplicate')ctx.fillText(word,x+6,y+6);if(key==='typeChromatic'){ctx.fillText(word,x-3,y);ctx.fillStyle='#48eeff';x+=3;}ctx.fillText(word,x,y);ctx.restore();});}
 };frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[]);
 return <canvas ref={ref} data-tarot-text-effects aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
}
