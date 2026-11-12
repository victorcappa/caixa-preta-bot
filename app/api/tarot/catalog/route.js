import { readCatalog, saveCatalogCard,readBackReference } from "@/lib/tarot/catalog";
import { currentSession, sameOrigin } from "@/lib/tarot/http";
import { showState } from "@/lib/showState";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try { return Response.json({ cards: (await readCatalog()).map(({ file, ...card }) => card),back:await readBackReference() }); }
  catch { return Response.json({ error: "TAROT_CATALOG_UNAVAILABLE" }, { status: 500 }); }
}
export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
  try {
    const multipart = request.headers.get("content-type")?.startsWith("multipart/form-data");
    const form = multipart ? await request.formData() : null;
    const body = form ? { sessionId: form.get("sessionId"), id: Number(form.get("id")), patch: {} } : await request.json();
    if (!currentSession(body)) return Response.json({ error: "TAROT_SESSION_CHANGED" }, { status: 409 });
    const upload = form?.get("image");
    if (upload && (typeof upload.arrayBuffer !== "function" || upload.size > 8 * 1024 * 1024)) throw new Error("TAROT_IMAGE_INVALID");
    const { file, ...card } = await saveCatalogCard(body.id, body.patch || {}, upload);
    showState.controlTarot?.("catalog-updated", { card });
    return Response.json({ card });
  } catch { return Response.json({ error: "TAROT_CATALOG_SAVE_FAILED" }, { status: 400 }); }
}
