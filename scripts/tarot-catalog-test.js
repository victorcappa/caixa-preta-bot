import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { readCatalog } from "../lib/tarot/catalog.js";
import { regionPoints, validQuad } from "../lib/tarot/geometry.js";

// This verifies geometry/provenance and renders review artifacts. It never marks
// anchors as reviewed: semantic review was done against the actual photographs.
const root=process.cwd(),output=process.env.TAROT_CATALOG_REVIEW_OUTPUT||"/private/tmp/tarot-catalog-review";
await fs.mkdir(output,{recursive:true});
const cards=await readCatalog(),ids=new Set(),reports=[];
assert.equal(cards.length,22);
const escape=(s)=>`${s}`.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
for(const card of cards){
  assert(card.description&&card.concepts.length&&card.associations.length&&card.relations,`incomplete inventory: ${card.id}`);
  assert(card.elements.length>=5&&card.relationships.length>=2,`incomplete anchors/relations: ${card.id}`);
  const filename=path.join(root,"assets/tarot",card.file),bytes=await fs.readFile(filename),{width,height}=await sharp(bytes).metadata();
  assert.equal(card.review.referenceVersion,createHash("sha256").update(bytes).digest("hex").slice(0,16));
  assert(card.review.reviewedAt&&card.review.method&&card.review.verification);
  assert(validQuad(card.surface.map(([x,y])=>[x*width,y*height]),width,height),`invalid surface: ${card.id}`);
  let shapes="";
  for(const [index,element] of card.elements.entries()){
    assert(!ids.has(element.id),`duplicate global ID: ${element.id}`);ids.add(element.id);
    assert(element.validated&&element.region,`unverified anchor: ${element.id}`);
    const [x,y,w,h]=element.region;
    assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=1.001&&y+h<=1.001);
    assert(w*width>=4&&h*height>=4,`region too small: ${element.id}`);
    const points=element.shape==="polygon"?element.points:regionPoints(element.region,element.shape);
    assert(points?.every((p)=>p.every((v)=>Number.isFinite(v)&&v>=0&&v<=1)));
    const pixels=points.map(([px,py])=>`${px*width},${py*height}`).join(" ");
    const color=["#ff1744","#00c853","#2979ff","#ff9100"][index%4];
    shapes+=`<${element.shape==="underline"?"polyline":"polygon"} points="${pixels}" fill="none" stroke="${color}" stroke-width="3"/><rect x="${x*width}" y="${y*height}" width="26" height="24" fill="black"/><text x="${x*width+2}" y="${y*height+18}" font-size="17" fill="${color}">${index+1}</text>`;
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes}</svg>`;
  const artifact=`${String(card.id).padStart(2,"0")}-anchors.png`;
  await sharp(bytes).composite([{input:Buffer.from(svg)}]).png().toFile(path.join(output,artifact));
  reports.push({id:card.id,name:card.name,elements:card.elements.map(({id,name,region,shape,uncertainty})=>({id,name,region,shape,uncertainty})),uncertainties:card.uncertainties,artifact});
}
await fs.writeFile(path.join(output,"catalog-report.json"),JSON.stringify({cards:reports.length,anchors:ids.size,physicalValidation:false,reports},null,2));
await fs.writeFile(path.join(output,"index.html"),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Revisão visual — 22 arcanos</title><style>body{background:#07110b;color:#bce7cb;font:14px monospace;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:24px}article{border:1px solid #356646;padding:16px}img{width:100%;max-height:640px;object-fit:contain}li{margin:8px 0}small{color:#d8bd84}</style><h1>22 cartas · ${ids.size} âncoras editoriais</h1><p>Conferência da fotografia de referência. Não constitui validação física da webcam.</p><main>${reports.map((c)=>`<article><h2>${c.id} — ${escape(c.name)}</h2><img src="${c.artifact}" alt="Âncoras de ${escape(c.name)}"><ol>${c.elements.map((e)=>`<li>${escape(e.name)} — ${e.region.join(", ")} <small>${escape(e.uncertainty)}</small></li>`).join("")}</ol><p>${c.uncertainties.map(escape).join(" ")}</p></article>`).join("")}</main></html>`);
console.log(JSON.stringify({ok:true,cards:cards.length,verifiedAnchors:ids.size,output,physicalWebcamValidated:false},null,2));
