import ForcaGSamplerStage from "@/components/ForcaGSamplerStage";
import ProjectionWindowClient from "@/components/ProjectionWindowClient";

export const metadata = {
  title: "Forca G Samples",
  description: "Projecao publica para samples audiovisuais da Forca G"
};

export default function ForcaGSamplesPage() {
  return (
    <>
      <ProjectionWindowClient />
      <ForcaGSamplerStage />
    </>
  );
}
