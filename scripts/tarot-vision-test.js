import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import {readBackReference,readCatalog} from "../lib/tarot/catalog.js";

// Serves only the local worker/WASM and the supplied references. No app/session writes.
const root=process.cwd(),cards=await readCatalog(),back=await readBackReference();
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,"http://localhost").pathname;
    if(pathname==="/"){res.setHeader("content-type","text/html");res.end("<!doctype html><title>Local tarot vision audit</title>");return;}
    const match=pathname.match(/^\/reference\/(\d+)$/),isBack=pathname==="/reference/back";
    const file=isBack?path.join(root,"assets/tarot/carta-fundo.jpeg"):match ? path.join(root,"assets/tarot",cards[Number(match[1])].file) : path.join(root,"public",pathname);
    if(!match&&!isBack && !["/tarot-tracker.worker.js","/vendor/opencv/opencv.js"].includes(pathname)){res.writeHead(404);res.end();return;}
    res.setHeader("content-type",match||isBack?"image/jpeg":"application/javascript");res.end(await fs.readFile(file));
  }catch{res.writeHead(500);res.end();}
});
await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
let browser;
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.addScriptTag({url:"/vendor/opencv/opencv.js"});
  await page.waitForFunction(()=>window.cv?.Mat);
  const result=await page.evaluate(async({cards,back,onlyFloor})=>{
    const worker=new Worker("/tarot-tracker.worker.js");
    let messages=[],pending=[];
    worker.onmessage=({data})=>{messages.push(data);for(const p of [...pending])if(p.type===data.type){pending=pending.filter((x)=>x!==p);p.resolve(data);}};
    const wait=(type)=>new Promise((resolve,reject)=>{const previous=messages.find((m)=>m.type===type);if(previous){messages=messages.filter((m)=>m!==previous);resolve(previous);return;}const timer=setTimeout(()=>reject(new Error(`Vision timeout ${type}: ${JSON.stringify(messages.slice(-3))}`)),20000);pending.push({type,resolve:(r)=>{clearTimeout(timer);resolve(r);}});});
    await wait("ready");
    const references=await Promise.all(cards.filter((c)=>c.file).map(async(card)=>{
      const image=new Image();image.src=`/reference/${card.id}`;await image.decode();
      const canvas=document.createElement("canvas");const scale=640/Math.max(image.naturalWidth,image.naturalHeight);
      canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
      const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0,canvas.width,canvas.height);
      return{id:card.id,version:card.version,image:ctx.getImageData(0,0,canvas.width,canvas.height)};
    }));
    const backImage=new Image();backImage.src="/reference/back";await backImage.decode();
    const backCanvas=document.createElement("canvas");backCanvas.width=480;backCanvas.height=640;const backCtx=backCanvas.getContext("2d");backCtx.drawImage(backImage,0,0,480,640);
    const backRef={...back,image:backCtx.getImageData(0,0,480,640)};
    worker.postMessage({type:"references",references,back:backRef});const preparation=await wait("catalog-ready");
    if(!preparation.backReady)throw Error("Back template not prepared");
    // Reload exercises persisted descriptors and keypoint reconstruction in IndexedDB.
    worker.postMessage({type:"references",references,back:backRef});await wait("catalog-ready");
    const cases=[];
    function warp(reference,quad,brightness=1,occlusion=false) {
      const cv=window.cv,src=cv.matFromImageData(reference.image),dst=new cv.Mat();
      const source=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,src.cols,0,src.cols,src.rows,0,src.rows]);
      const target=cv.matFromArray(4,1,cv.CV_32FC2,quad.flat()),H=cv.getPerspectiveTransform(source,target);
      cv.warpPerspective(src,dst,H,new cv.Size(800,600),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(15,20,18,255));
      const output=new ImageData(new Uint8ClampedArray(dst.data),800,600);
      for(let i=0;i<output.data.length;i+=4) for(let c=0;c<3;c++)output.data[i+c]*=brightness;
      if(occlusion)for(let y=330;y<420;y++)for(let x=360;x<460;x++){const i=(y*800+x)*4;output.data[i]=25;output.data[i+1]=25;output.data[i+2]=25;}
      [src,dst,source,target,H].forEach((v)=>v.delete());return output;
    }
    async function frame(image,preferredId=null) {
      messages=[];worker.postMessage({type:"frame",image,preferredId});await wait("frame-done");
      const error=messages.find((m)=>m.type==="error");if(error)throw new Error(error.error);
      return messages.find((m)=>m.type==="tracking")||null;
    }
    if(!onlyFloor){
    const quad=[[210,65],[560,75],[555,535],[220,525]];
    for(const ref of references) {
      // Force a real reacquisition through loss, including swaps between shared borders.
      await frame(new ImageData(800,600));
      const found=await frame(warp(ref,quad));
      cases.push({case:`catalog-${ref.id}`,expected:ref.id,actual:found?.id??null,ms:found?.processingMs,inliers:found?.inliers});
    }
    const ref=references.find((r)=>r.id===0);
    const variants=[
      {name:"perspective",quad:[[240,70],[560,130],[510,540],[180,490]]},
      {name:"rotation",quad:[[330,50],[625,230],[410,565],[110,390]]},
      {name:"scale-small",quad:[[300,160],[510,160],[510,440],[300,440]]},
      {name:"lighting-dark",quad,brightness:.62},
      {name:"partial-occlusion",quad,occlusion:true}
    ];
    for(const variant of variants){await frame(new ImageData(800,600));const found=await frame(warp(ref,variant.quad,variant.brightness,variant.occlusion));
      let error=null;if(found){const h=found.matrix;error=Math.max(...[[0,0],[1,0],[1,1],[0,1]].map(([x,y],i)=>{const d=h[6]*x+h[7]*y+h[8];return Math.hypot((h[0]*x+h[1]*y+h[2])/d-variant.quad[i][0],(h[3]*x+h[4]*y+h[5])/d-variant.quad[i][1]);}));}
      cases.push({case:variant.name,expected:0,actual:found?.id??null,maxCornerError:error,ms:found?.processingMs});}
    await frame(new ImageData(800,600));await frame(warp(ref,quad));
    for(let i=1;i<=8;i++){const moving=quad.map(([x,y])=>[x+i*6,y+i*2]);const found=await frame(warp(ref,moving));cases.push({case:`optical-motion-${i}`,expected:0,actual:found?.id??null,ms:found?.processingMs});}
    const lost=await frame(new ImageData(800,600));cases.push({case:"absence",expected:null,actual:lost?.id??null});
    const recovered=await frame(warp(ref,quad));cases.push({case:"recovery",expected:0,actual:recovered?.id??null});
    // Glare destroys some pixels; matching must use the remaining illustration.
    for(const id of [0,13]){
      const image=warp(references.find((r)=>r.id===id),quad);
      for(let y=130;y<430;y++)for(let x=300;x<415;x++){const i=(y*800+x)*4;image.data[i]=255;image.data[i+1]=255;image.data[i+2]=255;}
      await frame(new ImageData(800,600));const found=await frame(image);cases.push({case:`specular-glare-${id}`,expected:id,actual:found?.id??null,ms:found?.processingMs});
    }
    const qa=[[70,80],[340,90],[335,520],[75,510]],qb=[[440,90],[715,80],[710,510],[445,520]];
    const a=warp(references[0],qa),b=warp(references[13],qb);
    for(let i=0;i<b.data.length;i+=4)if(b.data[i]!==15||b.data[i+1]!==20||b.data[i+2]!==18)for(let c=0;c<4;c++)a.data[i+c]=b.data[i+c];
    await frame(new ImageData(800,600));const pair=await frame(a);cases.push({case:"two-cards",expected:"0+13",actual:pair?.cards?.map((c)=>c.id).join("+")||null});
    }
    async function floorImage(count,fronts=false){
      const canvas=document.createElement("canvas");canvas.width=800;canvas.height=600;const ctx=canvas.getContext("2d");ctx.fillStyle="#45695a";ctx.fillRect(0,0,800,600);for(let x=0;x<800;x+=16){ctx.fillStyle=x%32?"#436758":"#74917c";ctx.fillRect(x,0,8,600);}
      const source=document.createElement("canvas");source.width=480;source.height=640;
      for(let i=0;i<count;i++){if(fronts)source.getContext("2d").putImageData(references[i].image,0,0);ctx.drawImage(fronts?source:backImage,35+i%6*122,25+Math.floor(i/6)*140,92,125);}
      return ctx.getImageData(0,0,800,600);
    }
    for(const [name,count,fronts] of [["twenty-two-backs",22,false],["twenty-one-backs",21,false],["faces-are-not-backs",22,true]]){
      messages=[];worker.postMessage({type:"frame",floor:true,image:await floorImage(count,fronts)});await wait("frame-done");const error=messages.find((m)=>m.type==="error");if(error)throw Error(error.error);
      const detected=messages.find((m)=>m.type==="floor");cases.push({case:name,expected:fronts?0:count,actual:detected?.cards?.length??null,ms:detected?.processingMs,diagnostics:detected?.diagnostics});
    }
    if(!onlyFloor){
      await frame(new ImageData(800,600));const backsAsFace=await frame(await floorImage(22));cases.push({case:"backs-have-no-front-identity",expected:null,actual:backsAsFace?.id??null});
      const ground=await floorImage(21),canvas=document.createElement("canvas");canvas.width=800;canvas.height=600;const ctx=canvas.getContext("2d");ctx.putImageData(ground,0,0);
      const front=document.createElement("canvas");front.width=480;front.height=640;front.getContext("2d").putImageData(references[17].image,0,0);ctx.drawImage(front,210,65,345,460);
      const chosen=await frame(ctx.getImageData(0,0,800,600));cases.push({case:"chosen-front-over-back-layout",expected:17,actual:chosen?.id??null});
    }
    worker.terminate();return cases;
  },{cards,back,onlyFloor:process.env.TAROT_VISION_ONLY_FLOOR==="1"});
  const report={synthetic:true,physicalWebcamValidated:false,cases:result};
  await fs.mkdir("/private/tmp/tarot-vision-evidence",{recursive:true});await fs.writeFile("/private/tmp/tarot-vision-evidence/result.json",JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  for(const item of result){assert.equal(item.actual,item.expected,item.case);if(item.maxCornerError!==undefined)assert(item.maxCornerError<22,`${item.case} geometry ${item.maxCornerError}`);}
}finally{await browser?.close();await new Promise((resolve)=>server.close(resolve));}
