let FilesetResolver,FaceLandmarker,drawTriangle,triangulate,canonicalPoints;
const ready=Promise.all([import('./vendor/mediapipe/vision_bundle.mjs'),import('./tarot-face-mesh.js')]).then(([vision,mesh])=>{({FilesetResolver,FaceLandmarker}=vision);({drawTriangle,triangulate,canonicalPoints}=mesh);});
let detector;
const canvas=(w,h)=>new OffscreenCanvas(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));
const oval=[10,338,284,454,397,365,152,136,172,234,54,109];
async function detect(blob){
 detector ||= await FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm'),{baseOptions:{modelAssetPath:'/vendor/mediapipe/face_landmarker.task',delegate:'CPU'},runningMode:'IMAGE',numFaces:12,minFaceDetectionConfidence:.35,minFacePresenceConfidence:.35});
 const image=await createImageBitmap(blob),scale=Math.min(1,1600/Math.max(image.width,image.height)),input=canvas(image.width*scale,image.height*scale);input.getContext('2d').drawImage(image,0,0,input.width,input.height);image.close();
 const result=detector.detect(input),faces=[];
 for(const lm of result.faceLandmarks){
  const avg=(a,b)=>[(lm[a].x+lm[b].x)/2,(lm[a].y+lm[b].y)/2];
  const points=[...oval.map(i=>[lm[i].x,lm[i].y]),avg(33,133),avg(362,263),[lm[1].x,lm[1].y],[lm[61].x,lm[61].y],[lm[291].x,lm[291].y]];
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
  const pad=(maxX-minX)*.15,x=Math.max(0,minX-pad),y=Math.max(0,minY-pad),w=Math.min(1,maxX+pad)-x,h=Math.min(1,maxY+pad)-y;
  const crop=canvas(320,320*h/w),ctx=crop.getContext('2d');ctx.drawImage(input,x*input.width,y*input.height,w*input.width,h*input.height,0,0,crop.width,crop.height);
  const normalized=points.map(p=>[Math.max(0,Math.min(1,(p[0]-x)/w)),Math.max(0,Math.min(1,(p[1]-y)/h))]);
  const left=points[12],right=points[13],nose=points[14],yaw=(nose[0]-(left[0]+right[0])/2)/Math.max(.001,right[0]-left[0]);
  faces.push({blob:await crop.convertToBlob({type:'image/png'}),points:normalized,yaw});
 }
 return {faces};
}
async function fuse({faceBlob,cardBlob,points,template}){
 const face=await createImageBitmap(faceBlob),card=await createImageBitmap(cardBlob),[x,y,w,h]=template.region;
 const angle=(template.rotation||0)*Math.PI/180,base=template.points||canonicalPoints();
 const target=base.map(([u,v])=>{const px=(u-.5)*w*card.width,py=(v-.5)*h*card.height;return [(x+w/2)*card.width+px*Math.cos(angle)-py*Math.sin(angle),(y+h/2)*card.height+px*Math.sin(angle)+py*Math.cos(angle)];});
 const minX=Math.floor(Math.min(...target.map(p=>p[0])))-2,minY=Math.floor(Math.min(...target.map(p=>p[1])))-2,width=Math.ceil(Math.max(...target.map(p=>p[0])))-minX+2,height=Math.ceil(Math.max(...target.map(p=>p[1])))-minY+2;
 const output=canvas(width,height),ctx=output.getContext('2d',{willReadFrequently:true}),src=points.map(([u,v])=>[u*face.width,v*face.height]),dst=target.map(([u,v])=>[u-minX,v-minY]);
 for(const t of triangulate(base))drawTriangle(ctx,face,t.map(i=>src[i]),t.map(i=>dst[i]));
 const reference=canvas(width,height),ref=reference.getContext('2d',{willReadFrequently:true});ref.drawImage(card,-minX,-minY);
 const pixels=ctx.getImageData(0,0,width,height),art=ref.getImageData(0,0,width,height),means=[0,0,0],targetMean=[0,0,0];let count=0;
 for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i+3]>128){for(let c=0;c<3;c++){means[c]+=pixels.data[i+c];targetMean[c]+=art.data[i+c];}count++;}
 if(!count)throw new Error('Fusão sem geometria válida');
 for(let i=0;i<pixels.data.length;i+=4){if(!pixels.data[i+3])continue;const px=(i/4)%width+minX-(x+w/2)*card.width,py=Math.floor(i/4/width)+minY-(y+h/2)*card.height;
  const u=(px*Math.cos(angle)+py*Math.sin(angle))/(w*card.width*.44),v=(-px*Math.sin(angle)+py*Math.cos(angle))/(h*card.height*.47),distance=Math.hypot(u,v),feather=Math.min(1,Math.max(0,(1-distance)/.16));
  for(let c=0;c<3;c++){const corrected=pixels.data[i+c]*.75+(targetMean[c]-means[c]*.75)/count;pixels.data[i+c]=Math.max(0,Math.min(255,corrected));}
  pixels.data[i+3]*=feather;
 }
 ctx.putImageData(pixels,0,0);const region=[minX/card.width,minY/card.height,width/card.width,height/card.height];face.close();card.close();
 return {blob:await output.convertToBlob({type:'image/png'}),region};
}
self.onmessage=async({data})=>{const started=performance.now();try{await ready;const result=data.action==='detect'?await detect(data.blob):await fuse(data);self.postMessage({id:data.id,...result,elapsedMs:performance.now()-started});}catch(e){self.postMessage({id:data.id,error:e.message||'Processamento facial indisponível'});}};
