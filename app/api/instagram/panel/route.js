import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.visible !== "boolean") {
    return Response.json({ error: "INSTAGRAM PANEL VISIBILITY REQUIRED" }, { status: 400 });
  }

  const instagram = showState.updateInstagram({
    embeddedPanelVisible: body.visible,
    message: body.visible ? "painel Instagram exibido" : "painel Instagram ocultado"
  });

  return Response.json({ ok: true, visible: instagram.embeddedPanelVisible });
}
