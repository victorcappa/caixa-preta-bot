import { readControllerSettings, saveControllerSettings } from "@/lib/controllerSettings";
import { sameOrigin } from "@/lib/tarot/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request) {
  try { return Response.json({ settings: readControllerSettings(new URL(request.url).searchParams.get("scope")) }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Não foi possível carregar os ajustes deste controle." }, { status: 400 }); }
}
export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
  try {
    const body = await request.json();
    if (!body.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) throw new Error();
    return Response.json({ settings: saveControllerSettings(body.scope, body.patch) });
  } catch { return Response.json({ error: "Não foi possível salvar os ajustes deste controle." }, { status: 400 }); }
}
