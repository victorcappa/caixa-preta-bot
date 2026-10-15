"use client";
/* eslint-disable @next/next/no-img-element -- Local reference pixels must retain their original geometry. */
import {useEffect,useRef,useState} from "react";
import {subscribePublicRealtime} from "@/lib/publicRealtime";
import {robotSoundEngine} from "@/lib/robot-sound/RobotSoundEngine";
import {tarotCommand} from "@/lib/tarot/client";
import {activeElementIds,projectPoint,regionPoints,visibleElementIds} from "@/lib/tarot/geometry";
import {center,nearby,readingCards,readingSignature} from "@/lib/tarot/floor";
import {DEFAULT_TAROT_VISUAL} from "@/lib/tarot/state";
import ProjectionWindowClient from "@/components/ProjectionWindowClient";
import useTarotCamera from "./useTarotCamera";
import TarotCameraFocus from "./TarotCameraFocus";
import TarotEffects,{TarotTextEffects,useHallucinationClock} from "./TarotEffects";
import {evaluate} from "@/lib/tarot/hallucination";
import styles from "./TarotTraining.module.css";

function CardAnnotations({card,geometry,elements,visibleIds,activeIds,outline}){
  if(!geometry)return null;
  return <g data-card-id={card.id}>
    <polygon className={styles.outline} style={{opacity:outline}} points={(card.surface||[[0,0],[1,0],[1,1],[0,1]]).map(([x,y])=>projectPoint(geometry.matrix,x,y)?.join(",")).join(" ")}/>
    {(card.relationships||[]).filter((r)=>visibleIds.includes(r.fromId)&&visibleIds.includes(r.toId)).map((r)=>{
      const ends=[r.fromId,r.toId].map((id)=>card.elements.find((e)=>e.id===id)).map((e)=>e?.validated&&e.region?projectPoint(geometry.matrix,e.region[0]+e.region[2]/2,e.region[1]+e.region[3]/2):null);
      return ends.every(Boolean)?<line key={`${r.fromId}:${r.toId}`} className={styles.relation} x1={ends[0][0]} y1={ends[0][1]} x2={ends[1][0]} y2={ends[1][1]}><title>{r.description}</title></line>:null;
    })}
    {elements.filter((e)=>(e.cardId===card.id||e.cardId===undefined)&&e.validated&&e.region).map((e)=>{
      const points=(e.shape==="polygon"&&e.points?e.points:regionPoints(e.region,e.shape)).map(([x,y])=>projectPoint(geometry.matrix,x,y));if(points.some((p)=>!p))return null;
      return <g key={e.id} data-element-id={e.id} data-active={activeIds.includes(e.id)}>
        {e.shape==="underline"?<polyline points={points.map((p)=>p.join(",")).join(" ")}/>:<polygon points={points.map((p)=>p.join(",")).join(" ")}/>}
        <text x={points[0][0]} y={Math.max(18,points[0][1]-8)} fontSize={Math.max(13,geometry.width/58)}>{e.name.toUpperCase()}</text>
      </g>;
    })}
  </g>;
}
export default function TarotTraining(){
  const [state,setState]=useState({}),[cursor,setCursor]=useState({id:null,chars:0}),[digitalSize,setDigitalSize]=useState([960,1280]);
  const videoRef=useRef(null),digitalImageRef=useRef(null),textRef=useRef(null),stateRef=useRef(state),cursorRef=useRef(cursor);stateRef.current=state;cursorRef.current=cursor;
  const tarot=state.tarot,response=tarot?.response,card=tarot?.currentCard,cards=tarot?readingCards(tarot):[],sessionId=state.reliability?.sessionId;
  const camera=useTarotCamera({sessionId,tarot,videoRef}),visual={...DEFAULT_TAROT_VISUAL,...tarot?.visual};
  const hallTime=useHallucinationClock(tarot?.hallucination);
  const digital=card?.source==="bot",phase=tarot?.floor?.phase||"idle",floorStage=!["idle","interpreting"].includes(phase);
  const tracked=camera.tracking?.cards|| (camera.tracking?[camera.tracking]:[]);
  const geometries=digital?[{...card,matrix:[digitalSize[0],0,0,0,digitalSize[1],0,0,0,1],width:digitalSize[0],height:digitalSize[1]}]:floorStage?[]:cards.flatMap((c)=>{
    const g=tracked.find((g)=>g.id===c.id);return g?[{...g,surface:c.surface}]:[];
  });
  const physical=response?.origin!=="stage"&&["camera","manual-camera"].includes(card?.source);
  const geometryKey=geometries.map((g)=>g.id).sort().join("+");
  const canSpeak=Boolean(camera.owner&&(!physical||(geometries.length===cards.length&&cards.length>0)));
  const publicProgress=response?.presentedChars||0;
  // A new response never inherits a previous response's fully revealed character count.
  const localProgress=cursor.id===response?.id?cursor.chars:publicProgress;
  const chars=camera.owner&&response?.status==="presenting"?Math.max(publicProgress,localProgress):publicProgress;

  useEffect(()=>subscribePublicRealtime(({state})=>setState(state)),[]);
  useEffect(()=>robotSoundEngine.armAutoUnlock(),[]);
  useEffect(()=>robotSoundEngine.armAudioRelay(),[]);
  useEffect(()=>{if(state.robotSound)robotSoundEngine.setSettings({...state.robotSound,masterVolume:state.robotSound.masterVolume*(state.globalVolume??1)});},[state.robotSound,state.globalVolume]);
  useEffect(()=>{
    let cancelled=false,timer,index=publicProgress,lastReport=Date.now();
    const post=(action,count)=>tarotCommand(sessionId,action,{owner:camera.ownerId,responseId:response?.id,chars:count,signature:readingSignature(cards)}).catch(()=>{});
    setCursor({id:response?.id,chars:index});
    if(!response||response.status!=="presenting"||!canSpeak){
      if(response?.status==="presenting"&&physical&&camera.owner)void post("tracking-lost",cursorRef.current.id===response.id?cursorRef.current.chars:publicProgress);
      return;
    }
    function step(){
      if(cancelled)return;index=Math.min(index+1,response.text.length);setCursor({id:response.id,chars:index});
      const char=response.text[index-1];robotSoundEngine.typing(char);
      if(index>=response.text.length){robotSoundEngine.complete();void post("presented",index);return;}
      if(Date.now()-lastReport>350){lastReport=Date.now();void post("progress",index);}
      const settings=stateRef.current.robotSound||{};
      timer=setTimeout(step,((settings.typingIntervalMs??60)+(/[.,!?;:\n]/.test(char)?settings.typingPauseMs||0:0))/(stateRef.current.tarot?.presentation?.revealSpeed||1));
    }
    timer=setTimeout(step,stateRef.current.robotSound?.messageGapMs||0);
    return()=>{
      cancelled=true;clearTimeout(timer);
      // Preserve the exact local cursor when vision or a remote command interrupts.
      if(index>publicProgress)void post("progress",index);
    };
    // Progress acknowledgements must never restart the typewriter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[response?.id,response?.status,canSpeak,camera.ownerId,sessionId,geometryKey]);
  useEffect(()=>{if(textRef.current)textRef.current.scrollTop=textRef.current.scrollHeight;},[chars,response?.id]);

  const allElements=response?.elements||[],progress=response?.status==="complete"?response.text.length:chars;
  const visibleIds=response?visibleElementIds(response.segments,progress):[],activeIds=response?activeElementIds(response.segments,progress):[];
  const elements=(!physical||geometries.length===cards.length)?visibleIds.flatMap((id)=>allElements.filter((e)=>e.id===id)):[];
  const selected=tarot?.floor?.selected,frame=camera.floorFrame;
  const localSelected=selected&&frame?.cards?.map((c)=>({...c,center:center(c.quad)})).find((c)=>nearby(c,selected));
  const selectedGeometry=selected&&localSelected&&!selected.removed&&["announcing","await-removal"].includes(phase)&&frame?{quad:localSelected.quad.map(([x,y])=>[x*frame.width,y*frame.height]),width:frame.width,height:frame.height}:null;
  const hallPresent=Boolean(tarot?.active&&!tarot.suspended&&!floorStage&&geometries.length===cards.length&&cards.length&&tarot.camera.enabled);
  const hallLevels=tarot?.hallucination?evaluate(tarot.hallucination,hallTime,hallPresent).levels:{};
  const focus=digital?[]:selectedGeometry?[selectedGeometry]:geometries;
  const view=selectedGeometry||geometries[0];
  return <main className={styles.screen} data-bot-font={state.robotSound?.displayFont||"modern-dos-8x16"} data-response-id={response?.id||""} style={{"--tarot-text-size":`${visual.textSize}px`}}>
    <ProjectionWindowClient/>
    <header className={styles.header}><h1>TARÔ <span>/</span> TREINAMENTO</h1><span className={styles.readingTitle}>{floorStage?phase==="complete"?"PRÓXIMO TREINAMENTO":phase==="await-reveal"?"MOSTRE A CARTA ESCOLHIDA":"AS CARTAS NO CHÃO":cards.length===2?"LEITURA EM CONJUNTO":""}</span></header>
    <section className={styles.body}>
      <div className={styles.vision}>
        <div className={styles.visionHeader}><span>{digital?"CARTA ESCOLHIDA PELO BOT":floorStage?"22 ARCANOS · VERSOS":""}</span><span>{!floorStage?cards.map((c)=>`${String(c.number).padStart(2,"0")} / ${c.name.toUpperCase()}`).join(" + "):""}</span></div>
        <div className={styles.imageStage}>
          <video ref={videoRef} autoPlay muted playsInline className={digital?styles.hiddenVideo:styles.video} aria-label="Imagem das cartas" style={{filter:focus.length?`blur(${visual.blur}px) brightness(${1-visual.dimming}) saturate(.82)`:"none",transition:visual.animations?"filter 260ms ease":"none"}}/>
          <TarotCameraFocus videoRef={videoRef} geometries={focus} visual={visual}/>
          {digital&&card.imageUrl?<img ref={digitalImageRef} className={styles.cardImage} src={card.imageUrl} alt={card.name} onLoad={(e)=>setDigitalSize([e.currentTarget.naturalWidth,e.currentTarget.naturalHeight])}/>:null}
          {camera.status!=="CÂMERA AO VIVO"&&!digital?<div className={styles.waiting}><div className={styles.reticle}>+</div><p>{camera.status}</p><small>APRESENTE AS CARTAS AO SISTEMA</small></div>:null}
          <TarotEffects h={tarot?.hallucination} time={hallTime} cards={cards} geometries={geometries} videoRef={digital?undefined:videoRef} image={digital?digitalImageRef.current:undefined} present={hallPresent} onError={error=>{if(camera.owner)void tarotCommand(sessionId,"camera-status",{owner:camera.ownerId,status:"live",error}).catch(()=>{});}}/>
          {view?<svg style={{opacity:1-(hallLevels.symbols||0)*(.3+.3*Math.sin(hallTime*(.3+(tarot?.hallucination?.effects.symbols.speed||0)/15)))}} className={styles.overlay} viewBox={`0 0 ${view.width} ${view.height}`} preserveAspectRatio="xMidYMid meet" aria-label="Anotações ancoradas nas cartas">
            {!floorStage?cards.map((c)=><CardAnnotations key={c.id} card={c} geometry={geometries.find((g)=>g.id===c.id)} elements={elements} visibleIds={visibleIds} activeIds={activeIds} outline={visual.outline}/>):null}
            {selectedGeometry?<g data-floor-choice={selected.slot}><polygon className={styles.floorChoice} points={selectedGeometry.quad.map((p)=>p.join(",")).join(" ")}/><text className={styles.floorNumber} x={selectedGeometry.quad.reduce((n,p)=>n+p[0]/4,0)} y={selectedGeometry.quad.reduce((n,p)=>n+p[1]/4,0)} textAnchor="middle">{selected.column||selected.slot}</text></g>:null}
          </svg>:null}
          <div className={styles.corners}/>
        </div>
        <footer className={styles.visionFooter}><span>{floorStage?phase==="scanning"?`${frame?.cards?.length||0}/22 VERSOS`:phase==="await-reveal"?"AGUARDANDO A FRENTE":"":geometries.length?"":"APRESENTE UMA CARTA"}</span><span>TARÔ DA HARMONIA · 22 ARCANOS</span></footer>
      </div>
      <aside className={styles.elements}><h2>{floorStage?"ESCOLHA DO SISTEMA":"ELEMENTOS"}</h2><div className={styles.elementList}>
        {elements.length?elements.map((e)=>{
          const source=cards.find((c)=>c.id===e.cardId)||card;
          return <article key={e.id} data-element-id={e.id} data-active={activeIds.includes(e.id)}>
            {e.region&&source?.imageUrl?<div className={styles.crop} style={{backgroundImage:`url("${source.imageUrl}")`,backgroundSize:`${100/e.region[2]}% ${100/e.region[3]}%`,backgroundPosition:`${e.region[0]/(1-e.region[2]||1)*100}% ${e.region[1]/(1-e.region[3]||1)*100}%`}}/>:<span className={styles.elementMark}>⌖</span>}
            <div><h3>{e.name}</h3><p>{e.description}</p></div>
          </article>;
        }):<div className={styles.empty}><p>{floorStage?phase==="scanning"?"Mantenha os 22 versos separados e visíveis.":selected&&!selected.removed?`A carta escolhida está destacada na imagem.`:phase==="await-reveal"?"Mostre a frente da carta retirada.":"":tarot?.generation==="pending"?"":"Os elementos surgem conforme a fala avança."}</p></div>}
      </div><footer>REFERÊNCIAS LOCAIS <span>●</span></footer></aside>
    </section>
    <section className={styles.speech} style={{position:"relative"}} aria-label="Fala do bot"><div className={styles.speechHeader}><h2>FALA DO BOT</h2><span>{response?.origin==="catalog"?"CONTEÚDO CADASTRADO":response?.interruptedBy==="tracking-lost"?"AGUARDANDO A CARTA":tarot?.generation==="pending"?"":""}</span></div>
      <div className={styles.speechText} ref={textRef} aria-live="off">{response?.text?response.text.slice(0,response.status==="complete"?response.text.length:chars):<span className={styles.placeholder}>_</span>}{response?.status!=="complete"?<span className={styles.cursor}>▌</span>:null}</div>
    <TarotTextEffects h={tarot?.hallucination} time={hallTime} text={response?.text?.slice(0,chars)||""} present={hallPresent}/>
    </section>
    {state.displayBlackout?.targets?.chatbot?<div className={styles.blackout}/>:null}
  </main>;
}
