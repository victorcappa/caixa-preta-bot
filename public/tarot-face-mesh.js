// Geometry shared by offline preparation and the live projection.
export function drawTriangle(ctx,image,s,d){
 const [a,b,c]=s,[p,q,r]=d;const det=a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]);if(Math.abs(det)<1e-8)return;
 const coeff=v=>[(v[0]*(b[1]-c[1])+v[1]*(c[1]-a[1])+v[2]*(a[1]-b[1]))/det,(v[0]*(c[0]-b[0])+v[1]*(a[0]-c[0])+v[2]*(b[0]-a[0]))/det,(v[0]*(b[0]*c[1]-c[0]*b[1])+v[1]*(c[0]*a[1]-a[0]*c[1])+v[2]*(a[0]*b[1]-b[0]*a[1]))/det];
 const x=coeff(d.map(p=>p[0])),y=coeff(d.map(p=>p[1]));ctx.save();ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.lineTo(...r);ctx.closePath();ctx.clip();ctx.transform(x[0],y[0],x[1],y[1],x[2],y[2]);ctx.drawImage(image,0,0);ctx.restore();
}
export function triangulate(points){
 const pts=[...points,[-10,-10],[10,-10],[0,10]],n=points.length;let triangles=[[n,n+1,n+2]];
 const inside=(t,p)=>{const [a,b,c]=t.map(i=>pts[i]),ax=a[0]-p[0],ay=a[1]-p[1],bx=b[0]-p[0],by=b[1]-p[1],cx=c[0]-p[0],cy=c[1]-p[1];const det=(ax*ax+ay*ay)*(bx*cy-cx*by)-(bx*bx+by*by)*(ax*cy-cx*ay)+(cx*cx+cy*cy)*(ax*by-bx*ay);const cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);return det*cross>1e-12;};
 for(let i=0;i<n;i++){const bad=triangles.filter(t=>inside(t,pts[i])),edges=new Map();for(const t of bad)for(let j=0;j<3;j++){const edge=[t[j],t[(j+1)%3]],key=[...edge].sort((a,b)=>a-b).join(',');if(edges.has(key))edges.delete(key);else edges.set(key,edge);}triangles=triangles.filter(t=>!bad.includes(t));for(const edge of edges.values())triangles.push([...edge,i]);}
 return triangles.filter(t=>t.every(i=>i<n));
}
export function canonicalPoints(){return [...Array.from({length:12},(_,i)=>{const a=-Math.PI/2+i*Math.PI/6;return [.5+Math.cos(a)*.44,.5+Math.sin(a)*.47];}),[.32,.4],[.68,.4],[.5,.58],[.37,.75],[.63,.75]];}
