import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'node:stream';
import store from '@/lib/model-3d/store.cjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  try {
    const { id, asset } = await params;
    const task = await store.read(store.validId(id));
    const assets = {
      imagem: { file: 'input', type: task.mime, ready: true },
      modelo: { file: 'model.glb', type: 'model/gltf-binary', ready: task.modelReady },
      video: { file: 'loop.mp4', type: 'video/mp4', ready: task.videoReady },
    };
    const selected = assets[asset];
    if (!selected?.ready) return new Response(null, { status: 404 });
    const target = store.file(id, selected.file), { size } = await fsp.stat(target);
    const headers = { 'Content-Type': selected.type, 'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
    if (new URL(request.url).searchParams.has('download')) headers['Content-Disposition'] = `attachment; filename="${asset === 'video' ? 'modelo-3d-loop.mp4' : 'modelo-3d.glb'}"`;
    let start = 0, end = size - 1, status = 200;
    const range = request.headers.get('range');
    if (range) {
      const match = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`; status = 206;
    }
    headers['Content-Length'] = String(end - start + 1);
    return new Response(Readable.toWeb(fs.createReadStream(target, { start, end })), { status, headers });
  } catch { return new Response(null, { status: 404 }); }
}
