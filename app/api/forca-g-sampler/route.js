import { findForcaGSamplerItem, readForcaGSamplerConfig } from "@/lib/forca-g-sampler/config";
import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const snapshot = showState.snapshot();
  return Response.json({
    config: readForcaGSamplerConfig(),
    state: snapshot.forcaGSampler,
    shaders: snapshot.forcaGShaders,
    glitch: snapshot.glitch,
    displayBlackout: snapshot.displayBlackout
  });
}

function applySampler(action, payload = {}) {
  return showState.controlForcaGSampler(action, payload, { source: "forca-g-samples-controller" });
}

function applyPresetAction(config, action) {
  const kind = `${action.type || action.action || "play"}`.toLowerCase();
  if (kind === "shader") {
    return showState.controlForcaGShaders(action.shader || action.effect, action.payload || action, {
      source: "forca-g-samples-preset"
    });
  }
  if (kind === "play") {
    const item = findForcaGSamplerItem(config, action.item || action.itemId || action.id);
    return item ? applySampler("play", { item }) : { applied: false, error: "PRESET ITEM UNKNOWN" };
  }
  return applySampler(kind, action.payload || action);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = `${body.action || ""}`.toLowerCase();
    const config = readForcaGSamplerConfig();
    let result;

    if (action === "shader") {
      const shaderResult = showState.controlForcaGShaders(body.shaderAction, body.payload || {}, {
        source: "forca-g-samples-controller"
      });
      if (!shaderResult.applied) {
        return Response.json({ error: shaderResult.error || "SAMPLER SHADER ERROR" }, { status: 400 });
      }
      return Response.json({
        message: "SAMPLER SHADER UPDATED",
        applied: true,
        state: showState.snapshot().forcaGSampler,
        shaders: shaderResult.state
      });
    } else if (action === "play") {
      const item = findForcaGSamplerItem(config, `${body.itemId || ""}`);
      result = item ? applySampler("play", { item }) : { applied: false, error: "SAMPLER ITEM UNKNOWN" };
    } else if (action === "free-text") {
      const text = `${body.text || ""}`.trim().slice(0, 12000);
      result = text ? applySampler("play", {
        item: {
          id: "free-text",
          type: "text",
          category: "texts",
          label: "TEXTO LIVRE",
          text,
          assetPath: "",
          durationMs: Math.max(0, Math.min(60 * 60 * 1000, Number(body.durationMs) || 0)),
          fadeInMs: 0,
          fadeOutMs: 0,
          style: {},
          available: true
        }
      }) : { applied: false, error: "SAMPLER TEXT EMPTY" };
    } else if (action === "preset") {
      const preset = config.presets.find((item) => item.id === `${body.presetId || ""}`);
      if (!preset) {
        result = { applied: false, error: "SAMPLER PRESET UNKNOWN" };
      } else {
        const results = preset.actions.map((item) => applyPresetAction(config, item));
        const failed = results.find((item) => !item.applied);
        result = failed || { applied: true, state: showState.snapshot().forcaGSampler };
      }
    } else {
      result = applySampler(action, {
        category: body.category,
        itemId: `${body.itemId || ""}`,
        playbackId: `${body.playbackId || ""}`,
        immediate: Boolean(body.immediate),
        patch: body.patch || {},
        message: body.message
      });
    }

    if (!result.applied) {
      return Response.json({ error: result.error || "SAMPLER ACTION ERROR", ...result }, { status: 400 });
    }

    if (["stop-all", "reset"].includes(action)) {
      showState.controlForcaGShaders("clear", {}, { source: "forca-g-samples-controller" });
      showState.controlGlitch("stop", {}, { source: "forca-g-samples-controller" });
      showState.stopSceneCue({ controllerId: "forca-g-samples", source: "forca-g-samples-controller" });
    }

    return Response.json({ message: "SAMPLER UPDATED", ...result, shaders: showState.snapshot().forcaGShaders });
  } catch (error) {
    console.error("SamplerForcaG: requisição inválida", error);
    return Response.json({ error: "SAMPLER REQUEST INVALID" }, { status: 400 });
  }
}
