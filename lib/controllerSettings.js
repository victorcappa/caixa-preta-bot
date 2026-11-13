import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { operatorPreferencesPath } from "./operatorPreferences.js";
import { normalizeControllerSettings } from "./controllerSettingsSchema.js";

const settingsPath = () => path.join(path.dirname(operatorPreferencesPath()), "controller-settings.json");
function read() {
  try {
    const data = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    if (data.schemaVersion !== 1 || !data.values || typeof data.values !== "object") throw new Error("CONTROLLER_SETTINGS_INVALID");
    return data.values;
  } catch (error) { if (error.code === "ENOENT") return {}; throw error; }
}
export function readControllerSettings(scope) { return normalizeControllerSettings(scope, read()[scope]); }
export function saveControllerSettings(scope, patch) {
  const values = read();
  values[scope] = normalizeControllerSettings(scope, { ...normalizeControllerSettings(scope, values[scope]), ...patch });
  const file = settingsPath(), temporary = `${file}.${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, JSON.stringify({ schemaVersion: 1, values }, null, 2) + "\n");
    fs.fsyncSync(descriptor); fs.closeSync(descriptor); descriptor = undefined; fs.renameSync(temporary, file);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return values[scope];
}
