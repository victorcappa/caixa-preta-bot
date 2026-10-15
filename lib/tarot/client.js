"use client";
export async function tarotCommand(sessionId, action, data = {}) {
  const response = await fetch("/api/tarot", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, sessionId, action }), signal: AbortSignal.timeout(40000) });
  const result = await response.json();
  if (!response.ok || result.ok === false || result.error) throw new Error(result.error || "TAROT_COMMAND_FAILED");
  return result;
}

export async function loadReferenceImages(cards) {
  return Promise.all(cards.filter((c) => c.imageUrl).map(async (card) => {
    const image = new Image(); image.src = card.imageUrl; await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { id: card.id, version: card.version,surface:card.surface, image: context.getImageData(0, 0, canvas.width, canvas.height) };
  }));
}

export async function prepareDeck(onProgress) {
  const response = await fetch("/api/tarot/catalog", { cache: "no-store" });
  if (!response.ok) throw new Error("TAROT_CATALOG_UNAVAILABLE");
  const { cards,back } = await response.json();
  const loaded=await loadReferenceImages(back?[...cards,back]:cards),references=loaded.filter((r)=>r.id!=="back"),backImage=loaded.find((r)=>r.id==="back");
  return new Promise((resolve, reject) => {
    const worker = new Worker("/tarot-tracker.worker.js");
    const timer = setTimeout(() => { worker.terminate(); reject(new Error("TAROT_PREPARATION_TIMEOUT")); }, 60000);
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error("TAROT_VISION_UNAVAILABLE")); };
    worker.onmessage = ({ data }) => {
      if (data.type === "ready") worker.postMessage({ type: "references", references,back:backImage });
      if (data.type === "preparing") onProgress?.(data);
      if (data.type === "catalog-ready") { clearTimeout(timer); worker.terminate(); resolve(data); }
      if (data.type === "error") { clearTimeout(timer); worker.terminate(); reject(new Error(data.error)); }
    };
  });
}
