// Coalesce slider edits, serialize requests and flush the last value on navigation.
export function createSettingsSaveQueue({ save, merge = (before, patch) => ({ ...before, ...patch }), onStatus = () => {}, delayMs = 150 }) {
  let pending = null, running = null, timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void flush(), delayMs); };
  async function flush() {
    clearTimeout(timer);
    if (running) { const result = await running; return result.ok && pending ? flush() : result; }
    if (!pending) return { ok: true };
    const selected = pending; pending = null; onStatus("saving");
    running = (async () => {
      try { const value = await save(selected); onStatus("saved"); return { ok: true, value }; }
      catch (error) { pending = pending ? merge(selected, pending) : selected; onStatus("error", error); return { ok: false, error }; }
    })();
    const result = await running; running = null;
    if (result.ok && pending) schedule();
    return result;
  }
  return { get busy() { return Boolean(pending || running); }, enqueue(value) { pending = pending ? merge(pending, value) : value; onStatus("pending"); schedule(); }, flush };
}
