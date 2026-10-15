/* global cv, importScripts */
// Local OpenCV/WASM. No frames or descriptors leave this worker for a provider.
importScripts("/vendor/opencv/opencv.js");
let ready = false;
let references = [];
let orb, matcher,clahe;
let backReference=null,floorDiagnostics={};
let previousGray=null,previousTracks=[];
let lastRecognition=0,lastFullRecognition=0;
const database = new Promise((resolve) => {
  const request = indexedDB.open("tarot-local-features", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("features");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
});
async function cachedReference(id, version, image) {
  const db = await database;
  const key = `opencv-4.13-orb-1400-clahe-glare-v4:${id}:${version}`;
  const stored = db ? await new Promise((resolve) => {
    const request = db.transaction("features").objectStore("features").get(key);
    request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(null);
  }) : null;
  if (stored) {
    const keypoints = new cv.KeyPointVector();
    for(const p of stored.points) keypoints.push_back({ pt:{x:p[0],y:p[1]}, size:p[2], angle:p[3], response:p[4], octave:p[5], class_id:p[6] });
    return { id, width: image.width, height: image.height, keypoints,
      descriptors: cv.matFromArray(stored.rows,stored.cols,cv.CV_8UC1,stored.data) };
  }
  const gray=grayImage(image), result={id,width:gray.cols,height:gray.rows,...features(gray)};gray.delete();
  const points=[];
  for(let i=0;i<result.keypoints.size();i++) { const p=result.keypoints.get(i);points.push([p.pt.x,p.pt.y,p.size,p.angle,p.response,p.octave,p.class_id]); }
  if(db) await new Promise((resolve) => {
    const transaction=db.transaction("features","readwrite");
    transaction.objectStore("features").put({points,rows:result.descriptors.rows,cols:result.descriptors.cols,data:result.descriptors.data.slice()},key);
    transaction.oncomplete=resolve;transaction.onerror=resolve;transaction.onabort=resolve;
  });
  return result;
}

function dispose(...items) { for (const item of items) item?.delete(); }
function initCV() {
  orb = new cv.ORB(1400); matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
  if(typeof cv.CLAHE=== "function")clahe=new cv.CLAHE(2,new cv.Size(8,8));
  ready = true; postMessage({ type: "ready", version: cv.getBuildInformation().split("\n")[2].trim() });
}
if (cv.Mat) initCV(); else cv.onRuntimeInitialized = initCV;

function grayImage(image,normalize=true) {
  const rgba=cv.matFromImageData(image),gray=new cv.Mat();
  cv.cvtColor(rgba,gray,cv.COLOR_RGBA2GRAY);rgba.delete();
  if(clahe&&normalize){const adjusted=new cv.Mat();clahe.apply(gray,adjusted);gray.delete();return adjusted;}
  return gray;
}
function features(gray,excludeGlare=true) {
  const keypoints=new cv.KeyPointVector(),descriptors=new cv.Mat();
  const mask=new cv.Mat(gray.rows,gray.cols,cv.CV_8UC1,new cv.Scalar(255));
  if(excludeGlare)for(let i=0;i<gray.data.length;i++)if(gray.data[i]>248)mask.data[i]=0;
  orb.detectAndCompute(gray,mask,keypoints,descriptors);mask.delete();return {keypoints,descriptors};
}
function clearTrack(){dispose(previousGray);previousGray=null;for(const track of previousTracks)dispose(track.points,track.reference);previousTracks=[];}
function project(h, x, y) {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}
function sane(h, width, height) {
  const points = [[0,0],[1,0],[1,1],[0,1]].map(([x,y]) => project(h,x,y));
  if (points.some((p) => !p.every(Number.isFinite))) return false;
  const cross = points.map((a,i) => { const b=points[(i+1)%4],c=points[(i+2)%4];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]); });
  const area = Math.abs(points.reduce((sum,p,i) => {const q=points[(i+1)%4]; return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
  return cross.every((v) => v > 0) && area > width*height*0.015 && area < width*height*1.5 &&
    points.every(([x,y]) => x > -width/2 && x < width*1.5 && y > -height/2 && y < height*1.5);
}
function homography(source, target, width, height) {
  if (source.length < 24) return null;
  const src = cv.matFromArray(source.length/2,1,cv.CV_32FC2,source);
  const dst = cv.matFromArray(target.length/2,1,cv.CV_32FC2,target), mask = new cv.Mat();
  let H;
  try {
    H = cv.findHomography(src,dst,cv.RANSAC,3,mask,1200,0.995);
    if (H.empty()) return null;
    const h = Array.from(H.data64F), goodSrc=[], goodDst=[];
    for(let i=0;i<mask.rows;i++) if(mask.data[i]) { goodSrc.push(source[i*2],source[i*2+1]); goodDst.push(target[i*2],target[i*2+1]); }
    if (goodSrc.length < 24 || goodSrc.length/source.length < 0.55 || !sane(h,width,height)) return null;
    // Repeated motifs in the decorative border must not determine a whole card.
    const xs=goodSrc.filter((_,i)=>i%2===0),ys=goodSrc.filter((_,i)=>i%2===1);
    if(Math.max(...xs)-Math.min(...xs)<0.25 || Math.max(...ys)-Math.min(...ys)<0.25) return null;
    let interior=0;
    for(let i=0;i<goodSrc.length;i+=2) if(goodSrc[i]>.2&&goodSrc[i]<.8&&goodSrc[i+1]>.2&&goodSrc[i+1]<.85) interior++;
    if(interior<8) return null;
    return { matrix:h, source:goodSrc, target:goodDst, inliers:goodSrc.length/2, matches:source.length/2 };
  } finally { dispose(src,dst,mask,H); }
}
function overlap(a,b){
  const bounds=(r)=>{const p=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>project(r.matrix,x,y));return [Math.min(...p.map((q)=>q[0])),Math.min(...p.map((q)=>q[1])),Math.max(...p.map((q)=>q[0])),Math.max(...p.map((q)=>q[1]))];};
  const x=bounds(a),y=bounds(b),area=(r)=>(r[2]-r[0])*(r[3]-r[1]);
  return Math.max(0,Math.min(x[2],y[2])-Math.max(x[0],y[0]))*Math.max(0,Math.min(x[3],y[3])-Math.max(x[1],y[1]))/Math.min(area(x),area(y));
}
function recognize(gray,preferredIds,glare=true){
  const frame=features(gray,glare),candidates=[];
  if(frame.descriptors.empty()){dispose(frame.keypoints,frame.descriptors);return [];}
  try{
    for(const ref of references){
      if(preferredIds&&!preferredIds.includes(ref.id))continue;
      if(ref.descriptors.empty())continue;
      const pairs=new cv.DMatchVectorVector(),src=[],dst=[],used=new Set();
      try{
        matcher.knnMatch(ref.descriptors,frame.descriptors,pairs,2);
        for(let i=0;i<pairs.size();i++){
          const pair=pairs.get(i);
          if(pair.size()>=2){const a=pair.get(0),b=pair.get(1);if(a.distance<b.distance*.74&&a.distance<68&&!used.has(a.trainIdx)){
            used.add(a.trainIdx);const p=ref.keypoints.get(a.queryIdx).pt,q=frame.keypoints.get(a.trainIdx).pt;
            src.push(p.x/ref.width,p.y/ref.height);dst.push(q.x,q.y);
          }}pair.delete();
        }
        if(src.length>=32){const result=homography(src,dst,gray.cols,gray.rows);if(result&&result.inliers>=14)candidates.push({...result,id:ref.id});}
      }finally{pairs.delete();}
    }
  }finally{dispose(frame.keypoints,frame.descriptors);}
  candidates.sort((a,b)=>b.inliers-a.inliers);const accepted=[],blocked=new Set();
  for(let i=0;i<candidates.length;i++){
    const a=candidates[i];if(blocked.has(a.id)||accepted.some((b)=>overlap(a,b)>.45))continue;
    const conflicting=candidates.slice(i+1).filter((b)=>overlap(a,b)>.55);
    if(conflicting.some((b)=>a.inliers<b.inliers*1.3)){blocked.add(a.id);for(const b of conflicting)blocked.add(b.id);continue;}
    accepted.push(a);if(accepted.length===2)break;
  }
  if(!accepted.length&&blocked.size)postMessage({type:"ambiguous",candidates:candidates.slice(0,2).map(({id,inliers})=>({id,inliers}))});
  return accepted.sort((a,b)=>a.id-b.id);
}
function flow(gray,track){
  if(!previousGray)return null;
  const next=new cv.Mat(),status=new cv.Mat(),error=new cv.Mat();
  try{
    cv.calcOpticalFlowPyrLK(previousGray,gray,track.points,next,status,error);
    const src=[],dst=[];
    for(let i=0;i<status.rows;i++)if(status.data[i]&&error.data32F[i]<25){src.push(track.reference.data32F[i*2],track.reference.data32F[i*2+1]);dst.push(next.data32F[i*2],next.data32F[i*2+1]);}
    const result=homography(src,dst,gray.cols,gray.rows);return result?{...result,id:track.id}:null;
  }finally{dispose(next,status,error);}
}
function quadOrder(points){
  const center=points.reduce((c,p)=>[c[0]+p[0]/4,c[1]+p[1]/4],[0,0]);
  const sorted=points.sort((a,b)=>Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));
  let start=0;for(let i=1;i<4;i++)if(sorted[i][0]+sorted[i][1]<sorted[start][0]+sorted[start][1])start=i;
  return [...sorted.slice(start),...sorted.slice(0,start)];
}
function patchVector(gray,quad){
  let ordered=quad;
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  if(distance(quad[0],quad[1])>distance(quad[1],quad[2]))ordered=[quad[1],quad[2],quad[3],quad[0]];
  const src=cv.matFromArray(4,1,cv.CV_32FC2,ordered.flat()),dst=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,48,0,48,72,0,72]);
  const H=cv.getPerspectiveTransform(src,dst),warped=new cv.Mat(),small=new cv.Mat();
  try{cv.warpPerspective(gray,warped,H,new cv.Size(48,72));cv.resize(warped,small,new cv.Size(24,36),0,0,cv.INTER_AREA);const vector=[];for(let y=5;y<31;y++)for(let x=4;x<20;x++)vector.push(small.data[y*24+x]);return vector;}finally{dispose(src,dst,H,warped,small);}
}
function correlation(a,b){
  const score=(x,y)=>{let mx=0,my=0;for(let i=0;i<x.length;i++){mx+=x[i]/x.length;my+=y[i]/x.length;}let dot=0,vx=0,vy=0;for(let i=0;i<x.length;i++){const p=x[i]-mx,q=y[i]-my;dot+=p*q;vx+=p*p;vy+=q*q;}return dot/Math.sqrt(vx*vy||1);};
  return Math.max(score(a,b),score(a,[...b].reverse()));
}
function referenceVectors(gray,surface){
  const vectors=[patchVector(gray,surface.map(([x,y])=>[x*gray.cols,y*gray.rows])),patchVector(gray,[[0,0],[gray.cols-1,0],[gray.cols-1,gray.rows-1],[0,gray.rows-1]])];
  for(const width of [gray.cols,96]){
    const small=new cv.Mat(),smooth=new cv.Mat(),edges=new cv.Mat(),contours=new cv.MatVector(),hierarchy=new cv.Mat();
    try{
      cv.resize(gray,small,new cv.Size(width,Math.round(gray.rows*width/gray.cols)),0,0,cv.INTER_AREA);
      cv.GaussianBlur(small,smooth,new cv.Size(5,5),0);cv.Canny(smooth,edges,45,120);
      const kernel=cv.Mat.ones(3,3,cv.CV_8U);cv.morphologyEx(edges,edges,cv.MORPH_CLOSE,kernel);kernel.delete();
      cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
      const choices=[];
      for(let i=0;i<contours.size();i++){
        const c=contours.get(i),p=new cv.Mat();try{const area=cv.contourArea(c);if(area<small.rows*small.cols*.15)continue;cv.approxPolyDP(c,p,.025*cv.arcLength(c,true),true);
          if(p.rows===4&&cv.isContourConvex(p))choices.push({area,quad:quadOrder(Array.from({length:4},(_,j)=>[p.data32S[j*2],p.data32S[j*2+1]]))});
        }finally{dispose(c,p);}
      }
      for(const item of choices.sort((a,b)=>b.area-a.area).slice(0,8))vectors.push(patchVector(small,item.quad));
    }finally{dispose(small,smooth,edges,contours,hierarchy);}
  }
  return vectors;
}
function floorCards(gray){
  floorDiagnostics={contours:0,large:0,quads:0,ratios:0,bestScores:[]};
  if(!backReference)return [];
  const smooth=new cv.Mat(),edges=new cv.Mat(),binary=new cv.Mat(),contours=new cv.MatVector(),hierarchy=new cv.Mat();
  const candidates=[];
  try{
    cv.GaussianBlur(gray,smooth,new cv.Size(5,5),0);cv.Canny(smooth,edges,45,120);
    const kernel=cv.Mat.ones(3,3,cv.CV_8U);cv.morphologyEx(edges,edges,cv.MORPH_CLOSE,kernel);kernel.delete();
    cv.threshold(smooth,binary,0,255,cv.THRESH_BINARY+cv.THRESH_OTSU);
    for(const segmentation of [edges,binary]){
    cv.findContours(segmentation,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    floorDiagnostics.contours+=contours.size();
    for(let i=0;i<contours.size();i++){
      const contour=contours.get(i),approx=new cv.Mat();
      try{
        const area=cv.contourArea(contour);if(area<gray.rows*gray.cols*.0015||area>gray.rows*gray.cols*.5)continue;floorDiagnostics.large++;
        cv.approxPolyDP(contour,approx,.025*cv.arcLength(contour,true),true);
        if(approx.rows!==4||!cv.isContourConvex(approx))continue;floorDiagnostics.quads++;
        const quad=quadOrder(Array.from({length:4},(_,j)=>[approx.data32S[j*2],approx.data32S[j*2+1]]));
        const sides=quad.map((a,j)=>Math.hypot(a[0]-quad[(j+1)%4][0],a[1]-quad[(j+1)%4][1]));
        const ratio=Math.min(sides[0]+sides[2],sides[1]+sides[3])/Math.max(sides[0]+sides[2],sides[1]+sides[3]);if(ratio<.42||ratio>.88)continue;floorDiagnostics.ratios++;
        const vector=patchVector(gray,quad),similarity=Math.max(...backReference.vectors.map((v)=>correlation(vector,v)));
        floorDiagnostics.bestScores.push(Math.round(similarity*1000)/1000);floorDiagnostics.bestScores.sort((a,b)=>b-a);floorDiagnostics.bestScores=floorDiagnostics.bestScores.slice(0,8);
        if(similarity<.48)continue;
        candidates.push({quad,area,similarity,center:quad.reduce((c,p)=>[c[0]+p[0]/4,c[1]+p[1]/4],[0,0])});
      }finally{dispose(contour,approx);}
    }
    }
  }finally{dispose(smooth,edges,binary,contours,hierarchy);}
  // Nested outlines of one physical card must not become separate choices.
  candidates.sort((a,b)=>b.similarity-a.similarity);const accepted=[];
  for(const item of candidates){if(accepted.some((other)=>Math.hypot(item.center[0]-other.center[0],item.center[1]-other.center[1])<Math.sqrt(Math.min(item.area,other.area))*.35))continue;accepted.push(item);if(accepted.length===22)break;}
  return accepted.map(({quad})=>({quad:quad.map(([x,y])=>[x/gray.cols,y/gray.rows]),verification:"reference"}));
}
self.onmessage=async ({data})=>{
  if(!ready) return;
  if(data.type==="references") {
    clearTrack();
    for(const ref of references) dispose(ref.keypoints,ref.descriptors);
    try {
      references=[];
      for(const {id,version,image} of data.references) {
        references.push(await cachedReference(id,version,image));
        postMessage({type:"preparing",count:references.length,total:data.references.length});
      }
      if(data.back){const gray=grayImage(data.back.image,false);backReference={vectors:referenceVectors(gray,data.back.surface)};gray.delete();}else backReference=null;
      postMessage({type:"catalog-ready",count:references.length,backReady:Boolean(backReference),contrast:clahe?"CLAHE":"gray"});
    } catch(error) { postMessage({type:"error",error:`Preparation: ${error.message || error}`.slice(0,160)}); }
    return;
  }
  if(data.type!=="frame") return;
  const started=performance.now(); let gray;
  try {
    gray=grayImage(data.image,!data.floor);
    if(previousGray && (previousGray.rows!==gray.rows || previousGray.cols!==gray.cols)) clearTrack();
    if(data.floor){postMessage({type:"floor",cards:floorCards(gray),diagnostics:floorDiagnostics,width:gray.cols,height:gray.rows,processingMs:performance.now()-started});clearTrack();return;}
    let results=previousTracks.map((track)=>flow(gray,track)).filter(Boolean);
    const now=performance.now(),fullSearch=!results.length||now-lastFullRecognition>1600;
    if(fullSearch||now-lastRecognition>1000){
      const preferred=data.preferredId!==undefined&&data.preferredId!==null?[data.preferredId]:!fullSearch?previousTracks.map((t)=>t.id):null;
      results=recognize(gray,preferred,data.glareProtection!==false);
      if(!results.length&&preferred&&data.preferredId==null)results=recognize(gray,null,data.glareProtection!==false);
      lastRecognition=performance.now();if(fullSearch)lastFullRecognition=lastRecognition;
    }
    clearTrack();
    if(results.length){
      previousGray=gray.clone();previousTracks=results.map((result)=>({id:result.id,points:cv.matFromArray(result.target.length/2,1,cv.CV_32FC2,result.target),reference:cv.matFromArray(result.source.length/2,1,cv.CV_32FC2,result.source)}));
      const cards=results.map(({id,matrix,inliers,matches})=>({id,matrix,inliers,matches,width:gray.cols,height:gray.rows}));
      postMessage({type:"tracking",...cards[0],cards,processingMs:performance.now()-started});
    }else postMessage({type:"lost",processingMs:performance.now()-started});
  } catch(error) { clearTrack();postMessage({type:"error",error:`Vision: ${error.message || error}`.slice(0,160)}); }
  finally { dispose(gray);postMessage({type:"frame-done"}); }
};
