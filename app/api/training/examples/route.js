import { getTrainingSnapshot, saveTrainingExample } from "@/lib/training";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json(getTrainingSnapshot());
}

export async function POST(request) {
  try {
    const body = await request.json();
    const example = saveTrainingExample(body);

    return Response.json({
      example,
      snapshot: getTrainingSnapshot()
    });
  } catch (error) {
    console.error("TRAINING EXAMPLE ERROR", error);
    return Response.json({ error: "TRAINING EXAMPLE FAILED" }, { status: 500 });
  }
}
