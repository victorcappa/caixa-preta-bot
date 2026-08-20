import ControllerSurface from "@/components/ControllerSurface";
import ForcaGShadersController from "@/components/ForcaGShadersController";

export const metadata = {
  title: "Força G Shaders Controller",
  description: "Controller preparado para vídeos e shaders da Força G"
};

export default function ForcaGShadersControllerPage() {
  return (
    <ControllerSurface>
      <ForcaGShadersController />
    </ControllerSurface>
  );
}
