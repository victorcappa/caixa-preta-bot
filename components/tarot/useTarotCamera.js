"use client";
import { useEffect, useRef, useState } from "react";
import { loadReferenceImages, tarotCommand } from "@/lib/tarot/client";
import { readingCards,readingSignature } from "@/lib/tarot/floor";
import { createRecognitionGate } from "@/lib/tarot/recognition";

export default function useTarotCamera({ sessionId, tarot, videoRef }) {
  const [tracking,setTracking]=useState(null),[floorFrame,setFloorFrame]=useState(null);
  const [owner, setOwner] = useState(false);
  const [status, setStatus] = useState("AGUARDANDO CÂMERA");
  const latest = useRef(tarot); latest.current = tarot;
  const ownerId = useRef(null);
  const selection = useRef({ id: null, hits: 0, locked: false, captureSequence: 0, submittedId: null, submittedAt: 0 });
  const catalog = useRef([]);

  useEffect(() => {
    if (!sessionId) { setTracking(null); setOwner(false); setStatus("CÂMERA EM ESPERA"); return; }
    ownerId.current ||= crypto.randomUUID();
    selection.current = { id: null, hits: 0, locked: false, captureSequence: 0, submittedId: null, submittedAt: 0 };
    const videoElement = videoRef.current;
    const id = ownerId.current;
    let closed = false, stream = null, worker = null, processing = false, catalogReady = false;
    let leaseUntil = 0, lastTrackAt = 0, lastFrameAt = 0, processingMs = 90, processingPeakMs = 90, startedDevice = null, lastMetricsAt = 0;
    let starting = false, catalogVersion = "", preparing = false, heartbeatBusy = false, descriptorCount = 0;
    let frameHandle, animationHandle, heartbeatTimer, catalogTimer, lossTimer;
    const gate = createRecognitionGate();let lossReported="";
    const canvas = document.createElement("canvas"), context = canvas.getContext("2d", { willReadFrequently: true });
    const post = (action, data) => tarotCommand(sessionId, action, { ...data, owner: id });
    function clearStream() { stream?.getTracks().forEach((t) => t.stop()); stream = null; setTracking(null); }
    async function startDevice(deviceId) {
      if (starting || (stream?.getVideoTracks().some((track) => track.readyState === "live") && deviceId === startedDevice)) return;
      starting = true; clearStream(); setStatus("ABRINDO CÂMERA");
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("CAMERA_UNAVAILABLE");
        const media = await navigator.mediaDevices.getUserMedia({ audio: false,
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } });
        if (closed || Date.now() > leaseUntil) { media.getTracks().forEach((t) => t.stop()); return; }
        stream = media; startedDevice = deviceId;
        if (videoRef.current) {
          videoRef.current.srcObject = media; await videoRef.current.play();
          // Safari can discard a pending video-frame callback when srcObject
          // changes. Rearm after every device start, including lease recovery.
          if (frameHandle) videoRef.current.cancelVideoFrameCallback?.(frameHandle);
          cancelAnimationFrame(animationHandle);animationHandle=requestAnimationFrame(frame);
        }
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput").map(({ deviceId, label }) => ({ deviceId, label }));
        setStatus("CÂMERA AO VIVO");
        await post("camera-status", { status: "live", devices, metrics: { descriptors: descriptorCount } });
      } catch (error) {
        clearStream(); setStatus("CÂMERA INDISPONÍVEL");
        void post("camera-status", { status: "error", error: error.name || error.message }).catch(() => {});
      } finally { starting = false; }
    }
    async function claim() {
      if (heartbeatBusy || closed) return;
      heartbeatBusy = true;
      try {
        const claim = await post("claim-camera", {});
        if (closed) return;
        leaseUntil = Date.now() + 12000; setOwner(true);
        if (claim.camera.enabled) await startDevice(claim.camera.deviceId);
        else { clearStream(); setStatus("CÂMERA EM ESPERA"); }
      } catch (error) {
        leaseUntil = 0; clearStream(); setOwner(false); setStatus(error.message?.includes("RESTART") ? "SISTEMA AGUARDA REINÍCIO" : "CÂMERA EM OUTRA TELA");
      } finally { heartbeatBusy = false; }
    }
    async function loadCatalog() {
      if (preparing || closed || !worker) return;
      preparing = true;
      try {
        const response = await fetch("/api/tarot/catalog", { cache: "no-store" });
        if (!response.ok) throw new Error("CATALOG_UNAVAILABLE");
        const {cards,back}=await response.json();catalog.current=cards;
        const version=cards.map((c)=>c.version).join(":")+":"+(back?.version||"");
        if (catalogVersion === version) return;
        catalogReady = false;
        const loaded=await loadReferenceImages(back?[...cards,back]:cards);
        if(!closed){catalogVersion=version;worker.postMessage({type:"references",references:loaded.filter((r)=>r.id!=="back"),back:loaded.find((r)=>r.id==="back")});}
      } catch { void post("camera-status", { status: "error", error: "TAROT_CATALOG_UNAVAILABLE" }).catch(() => {}); }
      finally { preparing = false; }
    }
    function reportLoss(visibleIds=[]){
      const current=latest.current;
      if(!current?.active||!["camera","manual-camera"].includes(current.currentCard?.source)||current.response?.origin==="stage"||!["idle","interpreting"].includes(current.floor?.phase||"idle"))return;
      if(readingCards(current).every((c)=>visibleIds.includes(c.id))){lossReported="";return;}
      const signature=readingSignature(readingCards(current)),key=signature+":"+(current.response?.id||current.generation);
      if(lossReported===key)return;lossReported=key;
      void post("tracking-lost",{signature,responseId:current.response?.id}).catch(()=>{});
    }
    async function selectCards(matches){
      const current=latest.current,phase=current?.floor?.phase||"idle";
      if(!["idle","await-reveal","interpreting"].includes(phase))return;
      if(phase==="await-reveal"&&matches.length!==1)return;
      const matched=matches.map((match)=>catalog.current.find((c)=>c.id===match.id)).filter(Boolean);
      if(!matched.length)return;
      const key=readingSignature(matched),force=current?.camera.captureSequence>selection.current.captureSequence;
      const returning=gate.isReturning(key),repeat=returning&&current?.presentation?.repeatOnReturn;
      const same=readingSignature(readingCards(current))===key&&["camera","manual-camera"].includes(current.currentCard?.source);
      const unstarted=current?.presentation?.autoAnalyze!==false&&!current?.response&&current?.generation==="idle";
      if(!current?.active||current.suspended||current.autonomy.status!=="off"||selection.current.locked||(!force&&gate.wasSubmittedRecently(key,Date.now())))return;
      if(phase==="interpreting"&&!same)return;
      if(current.response?.interruptedBy==="tracking-lost"&&matched.length<readingCards(current).length&&matched.some((m)=>readingCards(current).some((c)=>c.id===m.id))&&!returning)return;
      if(same&&current.response?.interruptedBy==="tracking-lost"){
        gate.consumeReturn();gate.submitted(key,Date.now());void post("tracking-resumed",{signature:key}).catch(()=>{});return;
      }
      if(!current.camera.automatic&&!force)return;
      if(!force&&same&&!repeat&&!unstarted&&phase!=="await-reveal"){gate.consumeReturn();return;}
      selection.current.locked=true;
      try{
        await post("select",{cardIds:matched.map((c)=>c.id),source:"camera",newVisit:Boolean(repeat||phase==="await-reveal"),inliers:matches[0].inliers,matches:matches[0].matches});
        selection.current.captureSequence=current.camera.captureSequence;gate.submitted(key,Date.now());lossReported="";
        if(current.presentation?.autoAnalyze!==false)void post("analyze",{requestId:crypto.randomUUID(),cardId:matched[0].id,automatic:true}).catch((error)=>{if(!closed)void post("camera-status",{status:"live",error:error.message}).catch(()=>{});});
      }catch(error){void post("camera-status",{status:"live",error:error.message}).catch(()=>{});}finally{selection.current.locked=false;}
    }
    worker = new Worker("/tarot-tracker.worker.js");
    worker.onerror = () => {
      setTracking(null); setStatus("VÍDEO AO VIVO · VISÃO INDISPONÍVEL");
      void post("camera-status", { status: "live", error: "TAROT_WORKER_FAILED" }).catch(() => {});
    };
    worker.onmessage = ({ data }) => {
      if (closed) return;
      if (data.type === "ready") void loadCatalog();
      if (data.type === "catalog-ready") { catalogReady = true; processing = false; descriptorCount = data.count; }
      if (data.type === "catalog-ready") void post("camera-status", { status: stream ? "live" : "waiting", metrics: { descriptors: data.count } }).catch(() => {});
      if (data.type === "frame-done") processing = false;
      if (data.type === "tracking") {
        lastTrackAt = Date.now(); processingMs = data.processingMs;
        processingPeakMs = Math.max(processingPeakMs,processingMs);
        setTracking(data);
        if (Date.now() - lastMetricsAt > 2500) {
          lastMetricsAt = Date.now(); void post("camera-status", { status: "live", metrics: { processingMs: data.processingMs, inliers: data.inliers, matches: data.matches } }).catch(() => {});
        }
        const matches=data.cards||[data];reportLoss(matches.map((c)=>c.id));
        const key=readingSignature(matches.map((m)=>catalog.current.find((c)=>c.id===m.id)).filter(Boolean));
        if(gate.observe(key,Date.now(),latest.current?.presentation?.stabilityMs||450))void selectCards(matches);
      }
      if(data.type==="floor"){
        processingMs=data.processingMs;processingPeakMs=Math.max(processingPeakMs,processingMs);setFloorFrame(data);setTracking(null);
        if(["scanning","await-removal"].includes(latest.current?.floor?.phase))void post("floor-layout",{cards:data.cards}).catch(()=>{});
      }
      if (data.type === "lost" || data.type === "ambiguous" || data.type === "error") {
        setTracking(null);gate.lost();reportLoss();
        if (data.type !== "lost") void post("camera-status", { status: "live", error: data.type === "ambiguous" ? "TAROT_AMBIGUOUS: CONFIRME A CARTA" : data.error }).catch(() => {});
      }
    };
    function frame(now) {
      if (closed) return;
      const video = videoRef.current;
      const state = latest.current;
      if (Date.now() > leaseUntil) { clearStream(); setOwner(false); }
      if (video?.readyState >= 2 && stream && catalogReady && !processing &&
        now - lastFrameAt > Math.max(65, Math.min(250, processingMs * 1.15)) && state?.currentCard?.source !== "bot") {
        lastFrameAt = now;
        const isFloor=["inviting","scanning","announcing","await-removal"].includes(state?.floor?.phase);
        const width=Math.min(isFloor?1280:800,video.videoWidth);
        canvas.width = width; canvas.height = Math.round(width * video.videoHeight / video.videoWidth);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        processing = true;
        worker.postMessage({ type: "frame", image: context.getImageData(0, 0, canvas.width, canvas.height),
          preferredId:state?.currentCard?.source==="manual-camera"?state.currentCard.id:null,glareProtection:state?.presentation?.glareProtection!==false,
          floor:isFloor });
      }
      if (video?.requestVideoFrameCallback) frameHandle = video.requestVideoFrameCallback(frame);
      else animationHandle = requestAnimationFrame(frame);
    }
    void claim(); heartbeatTimer = setInterval(claim, 4000);
    catalogTimer = setInterval(loadCatalog, 15000);
    // Catalogue revalidation can take longer than optical flow, especially on
    // Safari. Silence is not a confirmed loss; keep a bounded adaptive grace.
    // The worker's explicit lost/ambiguous/error events still clear immediately.
    lossTimer = setInterval(() => {
      const silenceLimit=Math.min(2500,Math.max(750,processingPeakMs*2+350));
      if(Date.now()-lastTrackAt>silenceLimit){setTracking(null);reportLoss();}
    }, 100);
    animationHandle = requestAnimationFrame(frame);
    return () => {
      closed = true; clearInterval(heartbeatTimer); clearInterval(catalogTimer); clearInterval(lossTimer);
      if (frameHandle) videoElement?.cancelVideoFrameCallback?.(frameHandle);
      cancelAnimationFrame(animationHandle); clearStream(); worker?.terminate(); setOwner(false);
      void post("release-camera", {}).catch(() => {});
    };
  }, [sessionId, videoRef]);

  useEffect(() => {
    if (tarot?.camera?.enabled !== false) return;
    const video = videoRef.current;
    video?.srcObject?.getTracks().forEach((track) => track.stop());
    if (video) video.srcObject = null;
    setTracking(null); setStatus("CÂMERA EM ESPERA");
  }, [tarot?.camera?.enabled, videoRef]);

  return { tracking,floorFrame,owner, ownerId: ownerId.current, status, catalog: catalog.current };
}
