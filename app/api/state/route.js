import { getKnowledgeStatus } from "@/lib/knowledge";
import { OPENAI_MODEL_OPTIONS } from "@/lib/openaiModels";
import { showState } from "@/lib/showState";
import { PROMPT_VERSION } from "@/prompts/buildSystemPrompt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ...showState.snapshot(),
    context: {
      knowledge: getKnowledgeStatus(),
      modelOptions: OPENAI_MODEL_OPTIONS,
      promptVersion: PROMPT_VERSION
    }
  });
}
