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

    if (action === "stop" || action === "stop-all" || action === "stop-instance") {
      const result = showState.stopSceneCue({
        controllerId,
        cueId: action === "stop-all" ? "" : `${body.cueId || ""}`.trim(),
        playbackId: action === "stop-instance" ? `${body.playbackId || ""}`.trim() : "",
        source: "editable-cue-controller"
      });

      return Response.json({ message: "SCENE CUE STOPPED", ...result });
    }

    if (action === "update-audio") {
      const result = showState.updateSceneAudioCue({
        controllerId,
        cueId: `${body.cueId || ""}`.trim(),
        patch: body.patch || {},
        source: "editable-cue-controller"
      });

      return Response.json({ message: "SCENE AUDIO UPDATED", ...result });
    }

    if (action === "audio-effects") {
      const result = showState.controlSceneAudioEffects({
        controllerId,
        settings: body.settings || {},
        source: "editable-cue-controller"
      });

      if (!result.applied) {
        return Response.json({ error: result.error || "SCENE AUDIO EFFECTS ERROR" }, { status: 400 });
      }

      return Response.json({ message: "SCENE AUDIO EFFECTS UPDATED", ...result });
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
