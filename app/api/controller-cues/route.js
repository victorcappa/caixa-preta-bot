import {
  getCueColors,
  listControllerAssets,
  readControllerCueConfig,
  saveControllerCueConfig,
  saveControllerCueUpload
} from "@/lib/controllerCueConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const controllerId = searchParams.get("id");
  const config = readControllerCueConfig(controllerId);

  if (!config) {
    return Response.json({ error: "CONTROLLER CUES UNKNOWN" }, { status: 404 });
  }

  return Response.json({
    config,
    assets: listControllerAssets(),
    colors: getCueColors()
  });
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const config = saveControllerCueConfig(body.id, body.config);

    if (!config) {
      return Response.json({ error: "CONTROLLER CUES UNKNOWN" }, { status: 404 });
    }

    return Response.json({
      message: "CONTROLLER CUES SAVED",
      config,
      assets: listControllerAssets(),
      colors: getCueColors()
    });
  } catch {
    return Response.json({ error: "CONTROLLER CUES REQUEST INVALID" }, { status: 400 });
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const controllerId = `${formData.get("id") || ""}`;
    const file = formData.get("file");
    const asset = await saveControllerCueUpload(controllerId, file);

    if (!asset) {
      return Response.json({ error: "UPLOAD INVALID" }, { status: 400 });
    }

    return Response.json({
      message: "ASSET SAVED",
      asset,
      assets: listControllerAssets()
    });
  } catch {
    return Response.json({ error: "UPLOAD REQUEST INVALID" }, { status: 400 });
  }
}
