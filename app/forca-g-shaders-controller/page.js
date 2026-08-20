import ControllerSurface from "@/components/ControllerSurface";
import EditableCueController from "@/components/EditableCueController";

export const metadata = {
  title: "Força G Shaders Controller",
  description: "Controller preparado para vídeos e shaders da Força G"
};

export default function ForcaGShadersControllerPage() {
  return (
    <ControllerSurface>
      <EditableCueController controllerId="forca-g-shaders" />
    </ControllerSurface>
  );
}
