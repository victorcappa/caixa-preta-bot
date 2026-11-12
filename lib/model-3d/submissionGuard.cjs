// Confirm the control-v1 view after control-v2 acknowledges capacity. Dispatch
// only after two enabled reads; reconcile only explicit pre-admission rejection.
async function waitForAdmission(cfg, { fetchImpl = fetch, delay = ms => new Promise(r => setTimeout(r, ms)), now = Date.now, timeoutMs = 20000 } = {}) {
  const deadline = now() + timeoutMs;
  let consecutive = 0;
  while (now() < deadline) {
    const response = await fetchImpl(`https://rest.runpod.io/v1/endpoints/${cfg.endpoint}`, {
      headers: { Authorization: `Bearer ${cfg.runpodKey}` }, signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error('RUNPOD_ADMISSION_UNVERIFIED');
    const endpoint = await response.json();
    if (endpoint.id !== cfg.endpoint || !Number.isInteger(endpoint.workersMax)) throw Error('RUNPOD_ADMISSION_UNVERIFIED');
    if (endpoint.workersMax > 0) consecutive++;
    else consecutive = 0;
    if (consecutive >= 2) return;
    await delay(1000);
  }
  throw Error('RUNPOD_ADMISSION_PAUSED');
}
function guardedFetch(baseFetch, cfg, record, { maxAttempts = 3, admission = waitForAdmission } = {}) {
  return async function (url, options) {
    if (String(url) !== `https://api.runpod.ai/v2/${cfg.endpoint}/run` || options?.method !== 'POST') return baseFetch(url, options);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await baseFetch(url, options);
      if (response.ok) return response;
      let body = {};
      try { body = await response.clone().json(); } catch { /* Keep only an explicit status when the response is not JSON. */ }
      const candidate = body.code || body.error?.code || body.message?.code;
      const known = new Set(['ENDPOINT_PAUSED', 'ENDPOINT_NOT_READY', 'INSUFFICIENT_BALANCE', 'RATE_LIMITED']);
      const prose = [body.detail, body.error, body.message].filter(v => typeof v === 'string').join(' ');
      const reason = known.has(candidate) ? candidate : response.status === 409 && /paused|max_workers\s*=\s*0|endpoint.*disabled/i.test(prose) ? 'ENDPOINT_PAUSED' : 'PROVIDER_REJECTED';
      await record({ httpStatus: response.status, reason, at: new Date().toISOString(), providerIdReturned: Boolean(body.id), deliveryAttempt: attempt });
      if (response.status !== 409 || body.id || !['ENDPOINT_PAUSED', 'ENDPOINT_NOT_READY'].includes(reason) || attempt === maxAttempts) return response;
      await admission(cfg, { fetchImpl: baseFetch, timeoutMs: 8000 });
    }
  };
}
function installSubmissionGuard(bridge, record) {
  const cfg = bridge.config(), capacity = bridge.requireSource('./runpod-capacity');
  const limits = bridge.requireSource('./generation-limits').limits;
  const originalGenerationLimit = limits['GENERATING 3D'];
  // The upstream 5-minute geometry guard cancelled the real 1024 run. Allow it
  // to use the existing 15-minute provider execution window; do not widen that policy.
  limits['GENERATING 3D'] = 900000;
  const original = capacity.ensureReady, baseFetch = global.fetch;
  capacity.ensureReady = async function (...args) {
    const receipt = await original(...args);
    await waitForAdmission(cfg, { fetchImpl: baseFetch });
    return receipt;
  };
  global.fetch = guardedFetch(baseFetch, cfg, record);
  return () => { capacity.ensureReady = original; global.fetch = baseFetch; limits['GENERATING 3D'] = originalGenerationLimit; };
}
module.exports = { waitForAdmission, guardedFetch, installSubmissionGuard };
