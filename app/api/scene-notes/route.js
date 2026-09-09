import { readSceneNotes, saveSceneNote, sceneNoteIds } from "@/lib/sceneNotes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const sceneId = new URL(request.url).searchParams.get("sceneId") || "";

  if (!sceneNoteIds.has(sceneId)) {
    return Response.json({ error: "SCENE NOTE UNKNOWN" }, { status: 404 });
  }

  const store = readSceneNotes();
  return Response.json({
    sceneId,
    content: store.notes[sceneId] || "",
    updatedAt: store.updatedAt[sceneId] || null
  });
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const note = saveSceneNote(body.sceneId, body.content);

    if (!note) {
      return Response.json({ error: "SCENE NOTE INVALID" }, { status: 400 });
    }

    return Response.json({ message: "SCENE NOTE SAVED", ...note });
  } catch {
    return Response.json({ error: "SCENE NOTE REQUEST INVALID" }, { status: 400 });
  }
}
