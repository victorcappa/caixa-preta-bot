import { createPointCloudPhotoWatch } from "./pointCloudPhotoWatch.js";
import { latestAudiencePhoto } from "./pointCloudEngine.js";

const WATCH_KEY = Symbol.for("caixa-preta.post-demo.photo-watch");
const isPostDemoPath = path => typeof path === "string" && ["/pos-demo", "/pos-demo/controle"].includes(path.split(/[?#]/u)[0]);

// Attach execution to the existing controller, never to the persisted show state.
export function ensurePointCloudPhotoWatch(showState) {
  const owner = showState.postDemoPointCloud;
  if (!owner) return;
  owner[WATCH_KEY] ||= createPointCloudPhotoWatch({
    getState: () => {
      const state = showState.privateSnapshot();
      return {
        sessionId: state.reliability.sessionId, postDemo: state.postDemo,
        emergency: Boolean(state.reliability.emergencyMode?.active),
        hasPostDemoWindow: Object.values(state.projection?.windows || {}).some(window => window?.connected === true && isPostDemoPath(window.currentPath))
      };
    },
    selectPhoto: latestAudiencePhoto,
    start: () => owner.start()
  });
  owner[WATCH_KEY].startWatching();
}
