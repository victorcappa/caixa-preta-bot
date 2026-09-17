import { getExistingInstagramController } from "./InstagramController.js";
import { showState } from "../showState.js";

const timerWatchers = new WeakMap();
const closingReels = new WeakMap();

function runningTimers(state) {
  return [
    state.sceneZero?.timer,
    state.sceneZero?.suitcaseGame?.gincana?.timer,
    state.sceneZero?.suitcaseGame?.hangman?.timer,
    state.audienceWarmup?.timer,
    state.audienceWarmup?.minigame?.timer
  ].map((timer) => timer?.status === "running");
}

export function watchReelTimerStops(controller) {
  timerWatchers.get(controller)?.();
  let previous = runningTimers(showState.snapshot());
  const unsubscribe = showState.subscribe(({ state }) => {
    if (!controller.reelsAutoplayActive && !controller.reelsOpening) {
      unsubscribe();
      timerWatchers.delete(controller);
      return;
    }
    const current = runningTimers(state);
    const stopped = previous.some((wasRunning, index) => wasRunning && !current[index]);
    previous = current;
    if (stopped) void closeActiveReels();
  });
  timerWatchers.set(controller, unsubscribe);
}

export async function closeActiveReels(message = "INSTAGRAM: reels encerrados") {
  const controller = getExistingInstagramController();
  if (controller && closingReels.has(controller)) return closingReels.get(controller);
  if (!controller || (!controller.reelsAutoplayActive && !controller.reelsOpening)) return false;
  timerWatchers.get(controller)?.();
  timerWatchers.delete(controller);
  const closing = (async () => {
    await controller.close();
    showState.updateInstagram({
      ...controller.getStatus(),
      embeddedPanelVisible: false,
      message
    });
    return true;
  })();
  closingReels.set(controller, closing);
  try {
    return await closing;
  } finally {
    closingReels.delete(controller);
  }
}
