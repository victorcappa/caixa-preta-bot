import ProjectionWindowClient from "@/components/ProjectionWindowClient";
import PublicGlitchLayer from "@/components/PublicGlitchLayer";
import TecnologiaFlorestaDisplay from "./TecnologiaFlorestaDisplay";

export const metadata = {
  title: "Tecnologia × Floresta",
  description: "Projecao publica escura da camada Tecnologia × Floresta"
};

export default function TecnologiaFlorestaPage() {
  return (
    <>
      <ProjectionWindowClient />
      <PublicGlitchLayer>
        <TecnologiaFlorestaDisplay />
      </PublicGlitchLayer>
    </>
  );
}
