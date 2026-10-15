import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { normalizeElements } from "./state.js";

const directory = path.join(process.cwd(), "assets/tarot");
const metadataPath = path.join(directory, "catalog.json");
const names = ["O Louco", "O Mago", "A Sacerdotisa", "A Imperatriz", "O Imperador", "O Sacerdote", "Os Enamorados", "O Carro", "A Justiça", "O Eremita", "A Roda da Fortuna", "A Força", "O Enforcado", "A Morte", "A Temperança", "O Diabo", "A Torre", "A Estrela", "A Lua", "O Sol", "O Julgamento", "O Mundo"];
// This deck's files decide its numbering (8 Justiça, 9 Eremita, 11 Força).
let queue = Promise.resolve();

export async function readCatalog() {
  const files = await fs.readdir(directory).catch((error) => { if (error.code === "ENOENT") return []; throw error; });
  let metadata = {};
  try { metadata = JSON.parse(await fs.readFile(metadataPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw new Error("TAROT_CATALOG_INVALID"); }
  return Promise.all(Array.from({ length: 22 }, async (_, number) => {
    const stored = metadata[number] || {};
    const filename = stored.file && files.includes(stored.file) ? stored.file : files.filter((file) => new RegExp(`^${number}-[^/]+\\.(jpeg|jpg|png|webp)$`, "i").test(file)).sort()[0];
    const bytes = filename ? await fs.readFile(path.join(directory, filename)) : null;
    const version = bytes ? createHash("sha256").update(bytes).digest("hex").slice(0, 16) : "missing";
    const elements = normalizeElements(stored.elements).map((e) => stored.review?.referenceVersion && stored.review.referenceVersion !== version ? { ...e, validated: false } : e);
    const relationships = Array.isArray(stored.relationships) ? stored.relationships.filter((r)=>elements.some((e)=>e.id===r.fromId)&&elements.some((e)=>e.id===r.toId)).slice(0,30) : [];
    return { id: number, number, name: stored.name || names[number], aliases: stored.aliases || [],
      imageUrl: filename ? `/api/tarot/reference/${number}?v=${version}` : null, version,
      description: stored.description || "", relations: stored.relations || "", symbolism: stored.symbolism || "", contingency: stored.contingency || "",
      elements, relationships, concepts: stored.concepts || [], associations: stored.associations || [], uncertainties: stored.uncertainties || [], review: stored.review || null,
      surface: stored.surface || [[0,0],[1,0],[1,1],[0,1]], analysisVersion: stored.analysisVersion || null,
      preparation: { reference: Boolean(filename), inventory: Boolean(stored.description && elements.length), verifiedAnchors: elements.filter((e)=>e.validated).length, interpretation: Boolean(stored.contingency) },
      status: !filename ? "missing" : elements.some((e) => e.validated) ? "anchored" : "reference", file: filename || null };
  }));
}

export async function referenceBytes(id) {
  const card = (await readCatalog()).find((c) => c.id === id);
  if (!card?.file) throw new Error("TAROT_REFERENCE_MISSING");
  const bytes = await fs.readFile(path.join(directory, card.file));
  const mime = /\.png$/i.test(card.file) ? "image/png" : /\.webp$/i.test(card.file) ? "image/webp" : "image/jpeg";
  return { bytes, mime, card };
}

export function saveCatalogCard(id, patch, upload = null) {
  const operation = queue.then(async () => {
    if (!Number.isInteger(id) || id < 0 || id > 21) throw new Error("TAROT_CARD_INVALID");
    await fs.mkdir(directory, { recursive: true });
    let metadata = {};
    try { metadata = JSON.parse(await fs.readFile(metadataPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw new Error("TAROT_CATALOG_INVALID"); }
    const previous = metadata[id] || {};
    const next = { ...previous };
    if (typeof patch.name === "string" && patch.name.trim()) next.name = patch.name.trim().slice(0, 80);
    if (Array.isArray(patch.aliases)) next.aliases = patch.aliases.map((v) => `${v}`.slice(0, 80)).slice(0, 12);
    if (typeof patch.description === "string") next.description = patch.description.slice(0, 2000);
    for (const key of ["relations", "symbolism", "contingency"]) if (typeof patch[key] === "string") next[key] = patch[key].slice(0, 4000);
    for (const key of ["concepts", "associations", "uncertainties"]) if (Array.isArray(patch[key])) next[key] = patch[key].map((v)=>`${v}`.slice(0,500)).slice(0,20);
    if (Array.isArray(patch.relationships)) next.relationships = patch.relationships.slice(0,30).map((r)=>({fromId:`${r.fromId}`.slice(0,60),toId:`${r.toId}`.slice(0,60),description:`${r.description}`.slice(0,500)}));
    if (patch.elements) next.elements = normalizeElements(patch.elements);
    if (patch.analysisVersion) next.analysisVersion = `${patch.analysisVersion}`.slice(0, 32);
    if (upload) {
      // Detect bytes as well as MIME. Never accept arbitrary files or user paths.
      const bytes = Buffer.from(await upload.arrayBuffer());
      const extension = bytes[0] === 0xff && bytes[1] === 0xd8 ? "jpeg" : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "png" : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" ? "webp" : null;
      if (!extension || bytes.length > 8 * 1024 * 1024 || bytes.length < 100) throw new Error("TAROT_IMAGE_INVALID");
      next.file = `${id}-upload-${randomUUID()}.${extension}`;
      await fs.writeFile(path.join(directory, next.file), bytes, { flag: "wx" });
      next.elements = []; next.description = ""; next.analysisVersion = null;
      next.relations = ""; next.symbolism = ""; next.contingency = "";
      next.concepts = []; next.associations = []; next.relationships = []; next.uncertainties = []; next.review = null; next.surface = null;
    }
    metadata[id] = next;
    const temp = `${metadataPath}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(metadata, null, 2) + "\n");
    await fs.rename(temp, metadataPath);
    return (await readCatalog())[id];
  });
  queue = operation.catch(() => {});
  return operation;
}

// The supplied back photo is a local matching target, not a tarot identity.
export async function readBackReference(){
  const files=await fs.readdir(directory).catch(()=>[]);
  const file=files.find((f)=>/^carta-fundo\.(jpe?g|png|webp)$/i.test(f));
  if(!file)return null;
  const bytes=await fs.readFile(path.join(directory,file));
  const version=createHash("sha256").update(bytes).digest("hex").slice(0,16);
  return {id:"back",version,imageUrl:`/api/tarot/back?v=${version}`,surface:[[.105,.025],[.786,.017],[.854,.935],[.098,.96]]};
}
export async function backReferenceBytes(){
  const ref=await readBackReference();if(!ref)throw new Error("TAROT_BACK_MISSING");
  const files=await fs.readdir(directory),file=files.find((f)=>/^carta-fundo\.(jpe?g|png|webp)$/i.test(f));
  return {bytes:await fs.readFile(path.join(directory,file)),mime:/\.png$/i.test(file)?"image/png":/\.webp$/i.test(file)?"image/webp":"image/jpeg"};
}
