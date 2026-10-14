import { notFound } from "next/navigation";
import PublicErrorBoundary from "@/components/PublicErrorBoundary";
import PublicErrorProbe from "@/components/PublicErrorProbe";

export const dynamic = "force-dynamic";

export default function PublicErrorTestPage() {
  if (process.env.CAIXA_PRETA_RELIABILITY_TESTS !== "true") notFound();
  return (
    <PublicErrorBoundary>
      <PublicErrorProbe />
    </PublicErrorBoundary>
  );
}
