import { getKnowledgeStatus } from "@/lib/knowledge";
import { showState } from "@/lib/showState";
import { PROMPT_VERSION } from "@/prompts/buildSystemPrompt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ...showState.snapshot(),
    context: {
      knowledge: getKnowledgeStatus(),
      promptVersion: PROMPT_VERSION
    }
  });
}
