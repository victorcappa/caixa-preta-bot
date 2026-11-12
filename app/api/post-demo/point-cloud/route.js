import { showState } from "@/lib/showState";
import { sameOrigin } from "@/lib/tarot/http";
import { POINT_CLOUD_CONTROLLER_VERSION } from "@/lib/post-demo/pointCloudState";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
  const body = await request.json().catch(() => null), state = showState.snapshot();
  if (!body || body.sessionId !== state.reliability.sessionId) return Response.json({ error: "A apresentação mudou. Atualize esta tela." }, { status: 409 });
  if (state.reliability.emergencyMode.active) return Response.json({ error: "Modo emergência ativo." }, { status: 409 });
  if (showState.postDemoPointCloud?.version !== POINT_CLOUD_CONTROLLER_VERSION) return Response.json({ error: "Reinicie o servidor para carregar o conversor; a sessão atual foi preservada." }, { status: 409 });
  const result = showState.postDemoPointCloud.start();
  return Response.json(result.busy ? { error: "Já existe uma conversão em andamento." } : { ok: true }, { status: result.busy ? 409 : 202 });
}
