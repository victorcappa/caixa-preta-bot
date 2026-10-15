import { referenceBytes } from "@/lib/tarot/catalog";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request, { params }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 0 || id > 21) return new Response(null, { status: 404 });
  try {
    const { bytes, mime, card } = await referenceBytes(id);
    return new Response(bytes, { headers: { "Content-Type": mime, "Cache-Control": "no-cache", ETag: `"${card.version}"`, "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
