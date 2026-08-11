import { generateCaixaPretaReply } from "@/lib/openai";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const message = body.message?.trim();

    if (!message) {
      return Response.json({ error: "TRAINING MESSAGE EMPTY" }, { status: 400 });
    }

    const state = {
      mode: body.mode || "host",
      previousMode: null,
      modeStartedAt: body.modeStartedAt || new Date().toISOString(),
      variables: {},
      memories: body.memories || [],
      conversation: body.conversation || []
    };
    const reply = await generateCaixaPretaReply({
      state,
      userMessage: message
    });

    return Response.json({
      message: {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        role: "assistant",
        content: reply
      }
    });
  } catch (error) {
    console.error("TRAINING CHAT ERROR", error);
    const missingKey = error.message?.includes("OPENAI_API_KEY");

    return Response.json(
      { error: missingKey ? error.message : "TRAINING CHAT FAILED" },
      { status: 500 }
    );
  }
}
