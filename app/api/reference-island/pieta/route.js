import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const file = path.join(process.cwd(), 'public/references/island/models/pieta.glb.gz');
  try { const stat = await fs.promises.stat(file); return new Response(Readable.toWeb(fs.createReadStream(file)), { headers: { 'Content-Type': 'model/gltf-binary', 'Content-Encoding': 'gzip', 'Content-Length': String(stat.size), 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } }); }
  catch { return new Response(null, { status: 404 }); }
}
