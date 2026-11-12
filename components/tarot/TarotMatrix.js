"use client";
import {useEffect,useRef} from "react";
import styles from "./TarotTraining.module.css";

// Transparent procedural glyph field, always below the sharp physical-card layer.
export default function TarotMatrix({visual,active}){
  const ref=useRef(null),settings=JSON.stringify(visual);
  useEffect(()=>{
    const v=JSON.parse(settings),canvas=ref.current,ctx=canvas.getContext("2d");
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    let handle,closed=false,last=0,width=0,height=0;
    const glyphs=Array.from(v.matrixSymbols).filter((s)=>s.trim()),density=Math.round(v.matrixDensity);
    const random=(i)=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);};
    function draw(now){
      if(closed)return;
      if(now-last<50){handle=requestAnimationFrame(draw);return;}last=now;
      const rect=canvas.getBoundingClientRect(),scale=Math.min(1.5,devicePixelRatio||1);
      if(width!==rect.width||height!==rect.height){width=rect.width;height=rect.height;canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));}
      ctx.setTransform(scale,0,0,scale,0,0);
      ctx.globalCompositeOperation="destination-out";ctx.fillStyle=`rgba(0,0,0,${1-v.matrixTrails})`;ctx.fillRect(0,0,width,height);ctx.globalCompositeOperation="source-over";
      const time=(v.animations&&!reduced?now/1000:0)*v.matrixSpeed;
      ctx.save();ctx.translate(width/2,height/2);ctx.rotate(v.matrixRotation*Math.PI/180);ctx.translate(-width/2,-height/2);
      ctx.fillStyle=v.matrixColor;ctx.strokeStyle=v.matrixColor;ctx.shadowColor=v.matrixColor;ctx.shadowBlur=v.matrixGlow;ctx.font=`${v.matrixSize}px monospace`;ctx.textAlign="center";
      const points=[];
      for(let i=0;i<density;i++){
        let x=random(i+1)*width,y;
        if(v.matrixStyle==="rain")y=((time*(30+random(i+100)*65)+random(i+7)*height)%(height+160))-80;
        else if(v.matrixStyle==="orbits"){const angle=time*.22+i*2.39996,r=Math.min(width,height)*(.12+random(i+5)*.6);x=width/2+Math.cos(angle)*r;y=height/2+Math.sin(angle)*r*.65;}
        else {y=random(i+80)*height+Math.sin(time*.4+i)*15;x+=Math.cos(time*.3+i)*10;}
        ctx.globalAlpha=.3+.6*(1-v.matrixPulse+v.matrixPulse*(Math.sin(time+i)*.5+.5));
        const glyph=glyphs[(i+Math.floor(time*(v.matrixStyle==="runes"?2:.6)))%glyphs.length]||"◈";
        ctx.fillText(glyph,x,y);points.push([x,y]);
        if(v.matrixStyle==="rain")for(let j=1;j<4;j++){ctx.globalAlpha=.12/j;ctx.fillText(glyphs[(i+j)%glyphs.length]||"0",x,y-j*v.matrixSize*1.3);}
        if(v.matrixStyle==="runes"){ctx.globalAlpha=.15;ctx.beginPath();ctx.arc(x,y,v.matrixSize*(1.2+random(i)),0,Math.PI*2);ctx.stroke();}
      }
      if(v.matrixStyle==="constellation"||v.matrixStyle==="orbits"){
        ctx.globalAlpha=.16;ctx.lineWidth=.6;ctx.shadowBlur=0;
        for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const a=points[i],b=points[j];if(Math.hypot(a[0]-b[0],a[1]-b[1])<Math.min(width,height)*.24){ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}}
      }
      ctx.restore();ctx.globalAlpha=v.matrixScanlines;ctx.shadowBlur=0;ctx.fillStyle=v.matrixColor;
      for(let y=0;y<height;y+=6)ctx.fillRect(0,y,width,.5);
      ctx.globalAlpha=1;
      if(v.animations&&!reduced)handle=requestAnimationFrame(draw);
    }
    if(active)handle=requestAnimationFrame(draw);else ctx.clearRect(0,0,canvas.width,canvas.height);
    return()=>{closed=true;cancelAnimationFrame(handle);};
  },[settings,active]);
  return <canvas ref={ref} className={styles.matrixCanvas} style={{opacity:active?visual.matrix:0}} aria-hidden="true"/>;
}
