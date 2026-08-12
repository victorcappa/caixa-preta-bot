import {
  addStyleNote,
  deleteStyleNote,
  getTrainingSnapshot,
  updateStyleNote
} from "@/lib/training";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json(getTrainingSnapshot());
}

export async function POST(request) {
  try {
    const body = await request.json();
    const content = body.content?.trim();

    if (!content) {
      return Response.json({ error: "STYLE NOTE EMPTY" }, { status: 400 });
    }

    const note = addStyleNote(content);
    return Response.json({ note, snapshot: getTrainingSnapshot() });
  } catch (error) {
    console.error("STYLE NOTE CREATE ERROR", error);
    return Response.json({ error: "STYLE NOTE CREATE FAILED" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = body.id?.trim();
    const content = body.content?.trim();

    if (!id || !content) {
      return Response.json({ error: "STYLE NOTE UPDATE INVALID" }, { status: 400 });
    }

    const note = updateStyleNote(id, content);

    if (!note) {
      return Response.json({ error: "STYLE NOTE NOT FOUND" }, { status: 404 });
    }

    return Response.json({ note, snapshot: getTrainingSnapshot() });
  } catch (error) {
    console.error("STYLE NOTE UPDATE ERROR", error);
    return Response.json({ error: "STYLE NOTE UPDATE FAILED" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const id = body.id?.trim();

    if (!id) {
      return Response.json({ error: "STYLE NOTE DELETE INVALID" }, { status: 400 });
    }

    const result = deleteStyleNote(id);
    return Response.json({ ...result, snapshot: getTrainingSnapshot() });
  } catch (error) {
    console.error("STYLE NOTE DELETE ERROR", error);
    return Response.json({ error: "STYLE NOTE DELETE FAILED" }, { status: 500 });
  }
}
