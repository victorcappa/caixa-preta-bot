import service from '@/lib/model-3d/service.cjs';
import store from '@/lib/model-3d/store.cjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function sameOrigin(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  try { return !origin || new URL(origin).host === (request.headers.get('host') || new URL(request.url).host); }
  catch { return false; }
}
function errorResponse(error) {
  const known = new Set(['INVALID_ID', 'INVALID_IMAGE', 'IMAGE_TOO_LARGE', 'INVALID_OPTIONS', 'ADMISSION_BUSY', 'REQUEST_CONFLICT', 'TASK_ACTIVE', 'NOT_RESUMABLE', 'INVALID_ACTION', 'GENERATION_UNAVAILABLE']);
  return json({ error: known.has(error.message) ? error.message : 'LOCAL_STORAGE_FAILED' }, error.status || (error.code === 'ENOENT' ? 404 : 500));
}
export async function GET(request) {
  try {
    if (new URL(request.url).searchParams.has('diagnostico')) return json(await service.diagnostics());
    return json({ tasks: await Promise.all((await store.list()).map(store.publicTask)) });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
  try {
    if (request.headers.get('content-type')?.startsWith('application/json')) {
      const body = await request.json();
      return json({ task: await service.action(store.validId(body.id), body.action) });
    }
    // Bound multipart bytes even for chunked uploads with no Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'INVALID_IMAGE' }, 400);
    const chunks = []; let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 21 * 1024 * 1024) { await reader.cancel(); return json({ error: 'IMAGE_TOO_LARGE' }, 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
    const image = form.get('image');
    if (!image || typeof image.arrayBuffer !== 'function') return json({ error: 'INVALID_IMAGE' }, 400);
    if (form.get('confirmCost') !== 'yes') return json({ error: 'COST_CONFIRMATION_REQUIRED' }, 400);
    const task = await service.create({ id: form.get('requestId'), name: image.name, mime: image.type,
      buffer: Buffer.from(await image.arrayBuffer()), preset: form.get('preset') || 'draft',
      removeBackground: form.get('removeBackground') === 'yes' });
    return json({ task }, 202);
  } catch (error) { return errorResponse(error); }
}
