// Read-only startup diagnosis. Never returns raw logs, URLs or credentials.
async function startupFailure(job, cfg, { fetchImpl = fetch } = {}) {
  if (!job.providerId || job.status !== 'STARTING GPU') return null;
  const headers = { Authorization: `Bearer ${cfg.runpodKey}` };
  const base = `https://api.runpod.io/v2/serverless/${cfg.endpoint}`;
  const response = await fetchImpl(base + '/workers', { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) return null;
  const data = await response.json();
  const workers = (data.workers || []).filter(w => !w.isStale);
  const unhealthy = w => String(w.status).toUpperCase() === 'UNHEALTHY';
  let worker;
  if (job.providerWorkerId) worker = workers.find(w => w.id === job.providerWorkerId && unhealthy(w));
  else if (job.workerBaseline?.workers?.length === 0 && workers.length && workers.every(unhealthy)) worker = workers[0];
  if (!worker) return null;
  let raw = '';
  try {
    const logs = await fetchImpl(base + `/workers/${encodeURIComponent(worker.id)}/logs?tail=50&source=system`, { headers, signal: AbortSignal.timeout(3000) });
    if (logs.ok) {
      const reader = logs.body.getReader();
      try {
        while (raw.length < 100000) {
          const { done, value } = await reader.read(); if (done) break;
          raw += Buffer.from(value).toString();
        }
      } finally { await reader.cancel().catch(() => {}); }
    }
  } catch { /* Partial SSE history is sufficient; network failure is not a pull-denied verdict. */ }
  const denied = /error pulling image|failed to pull/i.test(raw) && /denied|unauthorized|authentication required/i.test(raw);
  return { code: denied ? 'GHCR_IMAGE_PULL_DENIED' : 'RUNPOD_WORKER_UNHEALTHY', workerId: worker.id, checkedAt: new Date().toISOString() };
}
module.exports = { startupFailure };
