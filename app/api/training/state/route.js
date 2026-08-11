import { getTrainingSnapshot } from "@/lib/training";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json(getTrainingSnapshot());
}
