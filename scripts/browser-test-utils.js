// Playwright's waitForFunction treats a Promise as a truthy predicate before
// resolving its value. Await asynchronous predicates explicitly on each poll.
export async function waitForAsyncCondition(page, predicate, arg, { timeout = 30000, polling = 80 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await page.evaluate(predicate, arg)) return;
    await new Promise((resolve) => setTimeout(resolve, polling));
  }
  throw new Error(`Async browser condition remained false for ${timeout}ms`);
}
