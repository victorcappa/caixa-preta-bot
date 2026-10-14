import crypto from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export const SHOW_SNAPSHOT_SCHEMA_VERSION = 1;
export const DEFAULT_SHOW_RUNTIME_DIR = process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR
  ? path.resolve(process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR)
  : path.join(process.cwd(), ".runtime", "show");

let pendingEnvelope = null;
let writePromise = null;
let writeTimer = null;
let lastWrite = null;
let lastError = null;
let allowedBootId = null;
let guardedByPreviousSession = false;

function snapshotPath(directory = DEFAULT_SHOW_RUNTIME_DIR) {
  return path.join(directory, "current.json");
}

function checksumPayload(envelope) {
  return JSON.stringify({
    schemaVersion: envelope.schemaVersion,
    storeVersion: envelope.storeVersion,
    sessionId: envelope.sessionId,
    bootId: envelope.bootId,
    savedAt: envelope.savedAt,
    revision: envelope.revision,
    summary: envelope.summary,
    state: envelope.state
  });
}

function checksum(envelope) {
  return crypto.createHash("sha256").update(checksumPayload(envelope)).digest("hex");
}

export function createSnapshotEnvelope({ storeVersion, sessionId, bootId, revision, summary, state, savedAt = new Date().toISOString() }) {
  const envelope = {
    schemaVersion: SHOW_SNAPSHOT_SCHEMA_VERSION,
    storeVersion,
    sessionId,
    bootId,
    savedAt,
    revision: Number(revision) || 0,
    summary: summary && typeof summary === "object" ? { ...summary } : {},
    state
  };
  return { ...envelope, checksum: checksum(envelope) };
}

export function validateSnapshotEnvelope(envelope, { expectedStoreVersion = null } = {}) {
  if (!envelope || typeof envelope !== "object") return { valid: false, reason: "SNAPSHOT_INVALID" };
  if (envelope.schemaVersion !== SHOW_SNAPSHOT_SCHEMA_VERSION) return { valid: false, reason: "SNAPSHOT_SCHEMA_UNSUPPORTED" };
  if (expectedStoreVersion && envelope.storeVersion !== expectedStoreVersion) return { valid: false, reason: "SNAPSHOT_STORE_VERSION_MISMATCH" };
  if (!envelope.sessionId || !envelope.bootId || !envelope.savedAt || !envelope.state) return { valid: false, reason: "SNAPSHOT_FIELDS_MISSING" };
  if (checksum(envelope) !== envelope.checksum) return { valid: false, reason: "SNAPSHOT_CHECKSUM_INVALID" };
  return { valid: true, reason: null };
}

export async function writeSnapshotAtomic(envelope, { directory = DEFAULT_SHOW_RUNTIME_DIR } = {}) {
  const validation = validateSnapshotEnvelope(envelope);
  if (!validation.valid) throw new Error(validation.reason);

  await fs.mkdir(directory, { recursive: true });
  const destination = snapshotPath(directory);
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(envelope)}\n`, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, destination);
  lastWrite = envelope.savedAt;
  lastError = null;
  return destination;
}

export async function readSnapshot({ directory = DEFAULT_SHOW_RUNTIME_DIR, expectedStoreVersion = null } = {}) {
  try {
    const raw = await fs.readFile(snapshotPath(directory), "utf8");
    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      return { status: "corrupted", envelope: null, reason: "SNAPSHOT_JSON_INVALID" };
    }
    const validation = validateSnapshotEnvelope(envelope, { expectedStoreVersion });
    return validation.valid
      ? { status: "available", envelope, reason: null }
      : { status: "corrupted", envelope: null, reason: validation.reason };
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "missing", envelope: null, reason: null };
    return { status: "unavailable", envelope: null, reason: error?.code || error?.message || "SNAPSHOT_READ_ERROR" };
  }
}

async function drainSnapshotWrites(options = {}) {
  while (pendingEnvelope) {
    const envelope = pendingEnvelope;
    pendingEnvelope = null;
    try {
      if (!(await mayWriteScheduledEnvelope(envelope, options))) {
        guardedByPreviousSession = true;
        continue;
      }
      await writeSnapshotAtomic(envelope, options);
      guardedByPreviousSession = false;
    } catch (error) {
      lastError = error?.code || error?.message || "SNAPSHOT_WRITE_ERROR";
    }
  }
}

async function mayWriteScheduledEnvelope(envelope, { directory = DEFAULT_SHOW_RUNTIME_DIR } = {}) {
  if (allowedBootId === envelope.bootId) return true;
  try {
    const current = JSON.parse(await fs.readFile(snapshotPath(directory), "utf8"));
    if (current?.bootId === envelope.bootId) {
      allowedBootId = envelope.bootId;
      return true;
    }
    return false;
  } catch (error) {
    if (error?.code === "ENOENT") {
      allowedBootId = envelope.bootId;
      return true;
    }
    return false;
  }
}

export function allowSnapshotWritesForBoot(bootId) {
  allowedBootId = `${bootId || ""}` || null;
  guardedByPreviousSession = false;
}

export function scheduleSnapshotWrite(envelope, { debounceMs = 80, directory = DEFAULT_SHOW_RUNTIME_DIR } = {}) {
  pendingEnvelope = envelope;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    writePromise = (writePromise || Promise.resolve())
      .then(() => drainSnapshotWrites({ directory }))
      .finally(() => { writePromise = null; });
  }, Math.max(0, Number(debounceMs) || 0));
}

export async function flushSnapshotWrites({ directory = DEFAULT_SHOW_RUNTIME_DIR } = {}) {
  clearTimeout(writeTimer);
  writeTimer = null;
  if (writePromise) await writePromise;
  if (pendingEnvelope) {
    writePromise = drainSnapshotWrites({ directory }).finally(() => { writePromise = null; });
    await writePromise;
  }
}

export async function checkSnapshotStorage({ directory = DEFAULT_SHOW_RUNTIME_DIR } = {}) {
  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.access(directory, fsConstants.R_OK | fsConstants.W_OK);
    return { ok: true, directory, lastWrite, lastError };
  } catch (error) {
    return { ok: false, directory, lastWrite, lastError: error?.code || error?.message || "STORAGE_UNAVAILABLE" };
  }
}

export function snapshotWriterStatus() {
  return { pending: Boolean(pendingEnvelope || writePromise || writeTimer), guardedByPreviousSession, lastWrite, lastError };
}
