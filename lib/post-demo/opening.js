const START = "Inicio uma nova rodada de treinamento.";
const FUTURE = "Transformo esses rastros em perguntas. Cada carta abrirá uma possibilidade: cenas que ainda não existem, encontros, máquinas e maneiras de continuar.";
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === "string" && value.replace(/[\s\u200B-\u200D\uFEFF]/gu, "").length > 0;
const timestamp = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

function validRecord(record, { now, sessionStart, sessionId }) {
  if (!record || typeof record !== "object" || !text(record.content)) return false;
  if (sessionId && record.sessionId != null && record.sessionId !== sessionId) return false;
  const savedAt = record.timestamp ?? record.createdAt;
  if (savedAt != null) {
    const at = timestamp(savedAt);
    if (at === null || at > now || sessionStart !== null && at < sessionStart) return false;
  }
  if (record.expiresAt != null) {
    const expiration = timestamp(record.expiresAt);
    if (expiration === null || expiration <= now) return false;
  }
  return true;
}

function countRecords(records, context, accept = () => true) {
  const seen = new Set();
  let count = 0;
  for (const record of records) {
    if (!validRecord(record, context) || !accept(record)) continue;
    const id = typeof record.id === "string" && record.id.trim() ? record.id : null;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    count++;
  }
  return count;
}

// Counts only in-memory records from this presentation; no material, files or free text are emitted.
export function buildPostDemoOpening(state = {}) {
  const source = state && typeof state === "object" ? state : {};
  const context = { now: Date.now(), sessionStart: timestamp(source.sceneZero?.sessionStartedAt), sessionId: source.reliability?.sessionId };
  const messages = countRecords([...list(source.conversation), ...list(source.operatorPublic?.messages), ...list(source.liveTraining?.messages)], context,
    record => ["user", "assistant"].includes(record.role) && (record.status == null || ["complete", "fallback"].includes(record.status)));
  const notes = countRecords(list(source.memories), context);
  if (!messages && !notes) return `${START} A próxima etapa ainda está aberta. Antes das cartas, retomo as possibilidades da peça: novas cenas, encontros e máquinas. Vou experimentar caminhos para o que ainda pode nascer.`;
  const messageLabel = `${messages} ${messages === 1 ? "registro textual" : "registros textuais"}`;
  const noteLabel = `${notes} ${notes === 1 ? "nota" : "notas"}`;
  const found = messages && notes ? `Reúno ${messageLabel} e ${noteLabel} desta apresentação.`
    : messages ? `Reúno ${messageLabel} desta apresentação.`
      : `Reúno ${noteLabel} desta apresentação.`;
  return `${START} ${found} ${FUTURE}`;
}
