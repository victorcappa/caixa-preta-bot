import { audienceWarmupCurrentAffairsStore } from "../lib/audienceWarmupCurrentAffairsStore.js";

const result = await audienceWarmupCurrentAffairsStore.refresh({ force: process.argv.includes("--force") });
console.log(JSON.stringify({ week: result.week, updatedAt: result.updatedAt, stale: result.stale, error: result.error, actions: result.prompts.length }, null, 2));
if (result.stale || result.error) process.exitCode = 1;
