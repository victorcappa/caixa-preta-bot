import Chat from "@/components/Chat";
import ProjectionWindowClient from "@/components/ProjectionWindowClient";
import PublicErrorBoundary from "@/components/PublicErrorBoundary";

export default function Home() {
  return (
    <PublicErrorBoundary>
      <ProjectionWindowClient />
      <Chat />
    </PublicErrorBoundary>
  );
}
