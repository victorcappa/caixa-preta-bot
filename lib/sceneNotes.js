import fs from "node:fs";
import path from "node:path";
import { controllerSurfaces } from "@/lib/controllerSurfaces";

const DATA_PATH = path.join(process.cwd(), "data", "scene-notes.json");
const MAX_NOTE_LENGTH = 20000;

export const sceneNoteSurfaces = controllerSurfaces.filter((surface) => surface.sceneNumber?.startsWith("CENA"));
export const sceneNoteIds = new Set(sceneNoteSurfaces.map((surface) => surface.id));

function emptyStore() {
  return {
    notes: Object.fromEntries(sceneNoteSurfaces.map((surface) => [surface.id, ""])),
    updatedAt: {}
  };
}

export function readSceneNotes() {
  const fallback = emptyStore();

  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    const notes = Object.fromEntries(sceneNoteSurfaces.map((surface) => [
      surface.id,
      typeof parsed.notes?.[surface.id] === "string" ? parsed.notes[surface.id] : ""
    ]));
    const updatedAt = Object.fromEntries(sceneNoteSurfaces.flatMap((surface) => (
      typeof parsed.updatedAt?.[surface.id] === "string"
        ? [[surface.id, parsed.updatedAt[surface.id]]]
        : []
    )));

    return { notes, updatedAt };
  } catch {
    return fallback;
  }
}

export function saveSceneNote(sceneId, content) {
  if (!sceneNoteIds.has(sceneId) || typeof content !== "string") {
    return null;
  }

  const store = readSceneNotes();
  store.notes[sceneId] = content.slice(0, MAX_NOTE_LENGTH);
  store.updatedAt[sceneId] = new Date().toISOString();
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`);

  return {
    sceneId,
    content: store.notes[sceneId],
    updatedAt: store.updatedAt[sceneId]
  };
}
