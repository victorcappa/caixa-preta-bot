import { EDITABLE_CUE_CONTROLLERS } from "@/lib/controllerCueConfig";
import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const controllerId = `${body.controllerId || ""}`.trim();
    const controller = EDITABLE_CUE_CONTROLLERS[controllerId];

    if (!controller) {
      return Response.json({ error: "CONTROLLER CUES UNKNOWN" }, { status: 404 });
    }

    const action = `${body.action || "play"}`.toLowerCase();

    if (action === "shader") {
      if (controllerId !== "forca-g-shaders") {
        return Response.json({ error: "SCENE SHADER UNKNOWN" }, { status: 400 });
      }

      const result = showState.controlForcaGShaders(body.shaderAction, body.payload, {
        source: "forca-g-shaders-controller"
      });

      if (!result.applied) {
        return Response.json({ error: result.error || "SCENE SHADER ERROR" }, { status: 400 });
      }

      return Response.json({ message: "SCENE SHADER UPDATED", ...result });
    }

    if (action === "stop") {
      const result = showState.stopSceneCue({
        controllerId,
        cueId: `${body.cueId || ""}`.trim(),
        source: "editable-cue-controller"
      });

      return Response.json({ message: "SCENE CUE STOPPED", ...result });
    }

    if (!controller.allowedTypes.includes(body.cue?.type)) {
      return Response.json({ error: "SCENE CUE TYPE INVALID" }, { status: 400 });
    }

    const result = showState.triggerSceneCue({
      controllerId,
      cue: body.cue,
      source: "editable-cue-controller"
    });

    if (!result.applied) {
      return Response.json({ error: result.error || "SCENE CUE ERROR" }, { status: 400 });
    }

    return Response.json({ message: "SCENE CUE PLAYING", ...result });
  } catch {
    return Response.json({ error: "SCENE CUE REQUEST INVALID" }, { status: 400 });
  }
}
