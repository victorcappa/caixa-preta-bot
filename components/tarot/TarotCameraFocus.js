"use client";
import {useEffect,useRef,useState} from "react";
import {projectPoint,videoQuadInStage} from "@/lib/tarot/geometry";
import {DEFAULT_TAROT_VISUAL} from "@/lib/tarot/state";
import TarotMatrix from "./TarotMatrix";
import styles from "./TarotTraining.module.css";

export default function TarotCameraFocus({videoRef,geometries=[],visual=DEFAULT_TAROT_VISUAL}){
  const hostRef=useRef(null),canvases=useRef([]),lastClip=useRef(["",""]),latest=useRef(geometries);latest.current=geometries;
  const [size,setSize]=useState([0,0]);
  useEffect(()=>{const observer=new ResizeObserver(([e])=>setSize([e.contentRect.width,e.contentRect.height]));observer.observe(hostRef.current);return()=>observer.disconnect();},[]);
  geometries.slice(0,2).forEach((g,i)=>{
    const points=g.quad|| (g.surface||[[0,0],[1,0],[1,1],[0,1]]).map(([x,y])=>projectPoint(g.matrix,x,y));
    const quad=videoQuadInStage(points,g.width,g.height,...size);
    if(quad)lastClip.current[i]=`polygon(${quad.map(([x,y])=>`${x}% ${y}%`).join(",")})`;
  });
  useEffect(()=>{
    const video=videoRef.current;let closed=false,handle,animation,lastDraw=0,lastTracked=0;
    const contexts=canvases.current.map((c)=>c.getContext("2d",{alpha:false}));
    function frame(now){
      if(closed)return;
      if(latest.current.length)lastTracked=now;
      if(video.readyState>=2&&video.videoWidth>0&&now-lastDraw>=40&&(latest.current.length||now-lastTracked<300)){
        const scale=Math.min(1,960/Math.max(video.videoWidth,video.videoHeight));
        const w=Math.round(video.videoWidth*scale),h=Math.round(video.videoHeight*scale);
        for(let i=0;i<canvases.current.length;i++){
          if(i>=Math.max(1,latest.current.length))continue;
          const canvas=canvases.current[i];if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
          contexts[i].drawImage(video,0,0,w,h);
        }lastDraw=now;
      }
      if(video.requestVideoFrameCallback)handle=video.requestVideoFrameCallback(frame);else animation=requestAnimationFrame(frame);
    }
    const arm=()=>{video.cancelVideoFrameCallback?.(handle);cancelAnimationFrame(animation);animation=requestAnimationFrame(frame);};
    video.addEventListener("loadeddata",arm);arm();
    return()=>{closed=true;video.removeEventListener("loadeddata",arm);video.cancelVideoFrameCallback?.(handle);cancelAnimationFrame(animation);};
  },[videoRef]);
  return <div ref={hostRef} className={styles.focusLayer} data-focused={geometries.length>0} data-animations={visual.animations!==false} aria-hidden="true">
    <div className={styles.greenTint} style={{opacity:geometries.length?visual.green:0}}/>
    <TarotMatrix visual={visual} active={geometries.length>0}/>
    {[0,1].map((i)=><canvas key={i} ref={(node)=>{canvases.current[i]=node;}} className={styles.sharpCard} data-card-isolation style={{clipPath:lastClip.current[i]||"polygon(0 0,0 0,0 0)",opacity:geometries[i]?1:0}}/>)}
  </div>;
}
