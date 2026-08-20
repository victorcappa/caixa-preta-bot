import { getInstagramController, normalizeUsername } from "./InstagramController.js";

export async function executeAutonomousInstagramTool({
  name,
  args = {},
  timeoutMs = 45000,
  reporter,
  analyzeScreenshot,
  state
} = {}) {
  const controller = getInstagramController({ reporter });
  const work = executeReadOnlyAction({ controller, name, args, analyzeScreenshot, state });

  try {
    return await withTimeout(work, timeoutMs);
  } catch (error) {
    if (error?.message === "AUTONOMOUS_INSTAGRAM_TIMEOUT") {
      await controller.stopAllRoutines().catch(() => {});
    }
    throw error;
  }
}

async function executeReadOnlyAction({ controller, name, args, analyzeScreenshot, state }) {
  const username = normalizeUsername(args.username || "");

  if (name === "instagram_search") {
    const result = await controller.researchPerson(args.person || "");
    return {
      ok: result.status === "ready",
      code: result.status === "ready" ? "INSTAGRAM_SEARCH_READY" : "INSTAGRAM_SEARCH_INCOMPLETE",
      person: result.person || args.person,
      links: result.links || null,
      message: result.message
    };
  }

  if (!controller.page) {
    const opened = await controller.open();
    if (opened.status !== "ready") {
      return { ok: false, code: "INSTAGRAM_NOT_READY", message: opened.message };
    }
  }

  if (name === "instagram_open_profile") {
    const result = await controller.openProfile(username);
    return {
      ok: result.status === "ready",
      code: result.status === "ready" ? "INSTAGRAM_PROFILE_READY" : "INSTAGRAM_PROFILE_INCOMPLETE",
      username,
      url: controller.currentUrl,
      message: result.message
    };
  }

  if (name === "instagram_get_recent_posts") {
    const opened = await controller.openProfile(username);
    if (opened.status !== "ready") {
      return { ok: false, code: "INSTAGRAM_PROFILE_INCOMPLETE", message: opened.message };
    }
    await controller.waitForProfileGridMedia({ minCount: 3, timeoutMs: 12000 });
    return analyzeCurrentFrame({
      controller,
      analyzeScreenshot,
      state,
      question: args.question || "Quais detalhes concretos aparecem nos posts recentes deste perfil?",
      code: "INSTAGRAM_RECENT_POSTS_ANALYZED"
    });
  }

  if (name === "instagram_open_post") {
    const opened = await controller.openProfileMedia(username, Number(args.post_index) || 1);
    return {
      ok: opened.status === "ready",
      code: opened.status === "ready" ? "INSTAGRAM_POST_READY" : "INSTAGRAM_POST_INCOMPLETE",
      username,
      postIndex: Number(args.post_index) || 1,
      url: controller.currentUrl,
      message: opened.message
    };
  }

  if (name === "instagram_analyze_post") {
    const postIndex = Number(args.post_index) || null;
    if (username && postIndex) {
      const opened = await controller.openProfileMedia(username, postIndex);
      if (opened.status !== "ready") {
        return { ok: false, code: "INSTAGRAM_POST_INCOMPLETE", message: opened.message };
      }
    } else if (username) {
      const opened = await controller.openProfile(username);
      if (opened.status !== "ready") {
        return { ok: false, code: "INSTAGRAM_PROFILE_INCOMPLETE", message: opened.message };
      }
    }
    return analyzeCurrentFrame({
      controller,
      analyzeScreenshot,
      state,
      question: args.question || "Descreva detalhes específicos visíveis neste post, separando fato de inferência.",
      code: "INSTAGRAM_POST_ANALYZED"
    });
  }

  return { ok: false, code: "INSTAGRAM_TOOL_UNKNOWN" };
}

async function analyzeCurrentFrame({ controller, analyzeScreenshot, state, question, code }) {
  await controller.waitForEmbeddedFrameReady("tela pronta para análise");
  const frame = await controller.captureFrame();
  const analysis = await analyzeScreenshot({
    imageDataUrl: frame.image,
    url: frame.status?.currentUrl,
    question,
    state
  });
  return {
    ok: true,
    code,
    url: frame.status?.currentUrl || controller.currentUrl,
    analysis
  };
}

function withTimeout(promise, timeoutMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("AUTONOMOUS_INSTAGRAM_TIMEOUT")), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}
