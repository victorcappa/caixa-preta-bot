import { generateTrainingAlternatives } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const alternatives = await generateTrainingAlternatives(body);

    return Response.json({ alternatives });
  } catch (error) {
    console.error("TRAINING IMPROVE ERROR", error);
    const missingKey = error.message?.includes("OPENAI_API_KEY");

    return Response.json(
      { error: missingKey ? error.message : "TRAINING IMPROVE FAILED" },
      { status: 500 }
    );
  }
}
