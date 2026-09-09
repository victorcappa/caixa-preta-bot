import { getKnowledgeStatus } from "@/lib/knowledge";
import { OPENAI_MODEL_OPTIONS } from "@/lib/openaiModels";
import { showState } from "@/lib/showState";
import { PROMPT_VERSION } from "@/prompts/buildSystemPrompt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const snapshot = showState.snapshot();

  if (new URL(request.url).searchParams.get("revision") === "1") {
    return Response.json({ revision: snapshot.revision });
  }

  return Response.json({
    ...snapshot,
    context: {
      knowledge: getKnowledgeStatus(),
      modelOptions: OPENAI_MODEL_OPTIONS,
      promptVersion: PROMPT_VERSION
    }
  });
}
