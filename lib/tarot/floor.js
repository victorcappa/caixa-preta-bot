// Spatial selection is tied to a stable layout, never to an invented face identity.
export const FLOOR_INVITATION = "Agora espalhe os 22 arcanos maiores no chão, separados e virados de costas. Quero escolher uma sem saber o que ela mostra.";
export const FLOOR_CLOSING = "Aprendi a reconhecer os signos e a relacionar seus significados. Estou pronto para o próximo treinamento. Vamos embaralhar realidades e ver o que elas nos contam.";
export function createFloorState(){return {phase:"idle",selected:null,layout:[],stableSince:0,missingSince:0,removalHits:0,error:null};}
export function readingCards(state){return state.currentCards?.length?state.currentCards:state.currentCard?[state.currentCard]:[];}
export function readingSignature(cards){return [...cards].sort((a,b)=>a.id-b.id).map((c)=>`${c.id}:${c.version}`).join("+");}
export function center(quad){return [quad.reduce((n,p)=>n+p[0],0)/4,quad.reduce((n,p)=>n+p[1],0)/4];}
export function normalizeFloorLayout(input){
  if(!Array.isArray(input))return [];
  const cards=input.slice(0,22).flatMap((item)=>{
    const quad=item.quad;
    if(!Array.isArray(quad)||quad.length!==4||quad.some((p)=>!Array.isArray(p)||p.length!==2||p.some((v)=>!Number.isFinite(v)||v<0||v>1)))return [];
    const cross=quad.map((a,i)=>{const b=quad[(i+1)%4],c=quad[(i+2)%4];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);});
    if(!cross.every((v)=>v>0))return [];
    if(item.verification!=="reference")return [];
    return [{quad,center:center(quad),verification:item.verification}];
  });
  const heights=cards.map((c)=>Math.max(...c.quad.map((p)=>p[1]))-Math.min(...c.quad.map((p)=>p[1]))).sort((a,b)=>a-b);
  const tolerance=Math.max(.025,(heights[Math.floor(heights.length/2)]||.1)*.45),rows=[];
  for(const card of cards.sort((a,b)=>a.center[1]-b.center[1])){let row=rows.find((r)=>Math.abs(r.y-card.center[1])<tolerance);if(!row){row={y:card.center[1],cards:[]};rows.push(row);}row.cards.push(card);row.y=row.cards.reduce((n,c)=>n+c.center[1]/row.cards.length,0);}
  return rows.flatMap((r,i)=>r.cards.sort((a,b)=>b.center[0]-a.center[0]).map((c,j)=>({...c,row:i+1,column:j+1,rowCount:rows.length})));
}
export function nearby(a,b,tolerance=.065){const span=(c)=>Math.min(Math.max(...c.quad.map((p)=>p[0]))-Math.min(...c.quad.map((p)=>p[0])),Math.max(...c.quad.map((p)=>p[1]))-Math.min(...c.quad.map((p)=>p[1])));return Math.hypot(a.center[0]-b.center[0],a.center[1]-b.center[1])<Math.min(tolerance,Math.max(.008,Math.min(span(a),span(b))*.45));}
export function sameFloorLayout(a,b){return a.length===b.length&&a.every((item)=>b.some((other)=>nearby(item,other,.045)));}
export function removalInstruction(slot,position={}){
  const ordinals=["primeira","segunda","terceira","quarta","quinta","sexta","sétima","oitava","nona","décima"];
  const number=position.column||slot;
  const prefix=position.rowCount>1?`Na ${ordinals[position.row-1]||`${position.row}ª`} fileira, de cima para baixo, retire`:"Retire";
  return `${prefix} a ${ordinals[number-1]||`${number}ª`} carta da direita para a esquerda. Depois mostre a frente dela para mim.`;
}
