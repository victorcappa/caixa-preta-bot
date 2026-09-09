import { blockedAutonomousInstagramResult } from "../externalNavigationGuard.js";

export async function executeAutonomousInstagramTool({
  name,
  args = {},
  timeoutMs = 45000,
  reporter,
  analyzeScreenshot,
  state
} = {}) {
  void name;
  void args;
  void timeoutMs;
  void reporter;
  void analyzeScreenshot;
  void state;
  return blockedAutonomousInstagramResult();
}
