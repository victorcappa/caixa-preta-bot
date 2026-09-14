import Chat from "@/components/Chat";
import ProjectionWindowClient from "@/components/ProjectionWindowClient";

export const metadata = {
  title: "Caixa Preta — Videomapping",
  description: "Visualização pública da Caixa Preta em quatro quadrantes"
};

export default function VideomappingPage() {
  return (
    <>
      <ProjectionWindowClient />
      <Chat initialPublicLayout="quadrants" />
    </>
  );
}
