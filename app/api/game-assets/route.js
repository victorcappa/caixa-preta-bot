import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ASSETS_ROOT = path.join(process.cwd(), "assets");

const CONTENT_TYPES = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4"
};

function safeAssetPath(rawFile = "") {
  const decoded = decodeURIComponent(`${rawFile || ""}`);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.join(ASSETS_ROOT, normalized);

  if (!absolute.startsWith(ASSETS_ROOT + path.sep)) {
    return null;
  }

  return absolute;
}

function parseRange(range, size) {
  const match = `${range || ""}`.match(/bytes=(\d*)-(\d*)/);

  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) {
    return null;
  }

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    const start = Math.max(0, size - suffixLength);
    return { start, end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= size || start > end) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1)
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");
  const absolute = safeAssetPath(file);

  if (!absolute || !fs.existsSync(absolute)) {
    return new Response("ASSET NOT FOUND", { status: 404 });
  }

  const stat = fs.statSync(absolute);
  if (!stat.isFile()) {
    return new Response("ASSET NOT FOUND", { status: 404 });
  }

  const extension = path.extname(absolute).toLowerCase();
  const contentType = CONTENT_TYPES[extension] || "application/octet-stream";
  const range = request.headers.get("range");

  if (range) {
    const parsedRange = parseRange(range, stat.size);

    if (!parsedRange) {
      return new Response("RANGE NOT SATISFIABLE", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${stat.size}`
        }
      });
    }

    const { start, end } = parsedRange;
    const stream = fs.createReadStream(absolute, { start, end });
    return new Response(Readable.toWeb(stream), {
      status: 206,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": `${end - start + 1}`,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Content-Type": contentType
      }
    });
  }

  const stream = fs.createReadStream(absolute);
  return new Response(Readable.toWeb(stream), {
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": `${stat.size}`,
      "Content-Type": contentType
    }
  });
}
