import { createHash } from 'node:crypto';

export const fold = value => `${value || ''}`.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const stop = new Set('a o as os um uma de da do das dos e em no na nos nas com por para que se ao aos ou como sua seu suas seus esta este isso isto mais nao uma sobre entre'.split(' '));
export const terms = value => fold(value).split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 2 && !stop.has(t));
export const digest = value => createHash('sha256').update(value).digest('hex');

// Whole paragraphs with heading ancestry and section metadata. Original text stays untouched.
export function semanticChunks(document) {
  const text = document.text.replace(/^---\n[\s\S]*?\n---\n/, '');
  const bibliography = Object.fromEntries([...text.matchAll(/^- \*\*\[(E\d+)\]\*\*[^\n]+/gm)].map(m => [m[1],m[0]]));
  const sections = [];
  let current = { headings: [], body: [] }, headings = [];
  for (const line of text.split('\n')) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      if (current.body.length) sections.push(current);
      headings = headings.slice(0,heading[1].length-1); headings[heading[1].length-1] = heading[2];
      current = { headings: headings.filter(Boolean), body: [] };
    } else current.body.push(line);
  }
  sections.push(current);
  return sections.flatMap(section => {
    const body = section.body.join('\n').trim(), title = section.headings.at(-1) || document.title || document.origin || document.id;
    const metadata = body.split('\n').filter(l => /^\*\*(Status|Tags|Arcanos|Conexões|Fontes internas)/.test(l)).join('\n');
    const sectionId = title.match(/\[(CP-\d+|RAG-\d+)\]/)?.[1] || null;
    return body.split(/\n\s*\n/).map((paragraph,index) => {
      const sources = [...new Set([...body.matchAll(/\bE\d{2}\b/g)].map(m => m[0]))].map(id => bibliography[id]).filter(Boolean);
      const chunk = { id: `${document.id}:${digest(section.headings.join('/')+'\n'+paragraph).slice(0,16)}:${index}`, documentId:document.id,
        origin:document.origin, title, headings:section.headings, sectionId, text:paragraph, metadata, sources,
        cutoff:document.cutoff || null, kind:document.kind || 'reference', theme:document.theme || null,
        personIds:document.personIds || [] };
      chunk.tokens = terms(`${title} ${paragraph}`);
      return chunk;
    }).filter(c => c.text && !/^---$/.test(c.text) && !/^\*\*(Status|Conexões):/.test(c.text));
  });
}
export function buildLocalIndex(documents) {
  const chunks = documents.flatMap(semanticChunks), postings = Object.create(null);
  chunks.forEach((chunk,i) => {
    const counts = Object.create(null);
    chunk.tokens.forEach(t => { counts[t] = (counts[t] || 0)+1; });
    for (const [term,tf] of Object.entries(counts)) (postings[term] ||= []).push([i,tf]);
    chunk.length = chunk.tokens.length; delete chunk.tokens;
  });
  return { chunks, postings, avgLength:chunks.reduce((n,c)=>n+c.length,0)/Math.max(1,chunks.length) };
}
export function rankLocalIndex(index, query) {
  const scores = new Map();
  for (const term of new Set(terms(query))) {
    const list = Object.hasOwn(index.postings,term) ? index.postings[term] : [];
    const idf = Math.log(1+(index.chunks.length-list.length+.5)/(list.length+.5));
    for (const [i,tf] of list) {
      const score = idf*(tf*2.2)/(tf+1.2*(.25+.75*index.chunks[i].length/Math.max(1,index.avgLength)));
      scores.set(i,(scores.get(i)||0)+score);
    }
  }
  return [...scores].map(([i,score])=>({...index.chunks[i],score})).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));
}
