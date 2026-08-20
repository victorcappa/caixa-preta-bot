import ControllerSurface from "@/components/ControllerSurface";
import EditableCueController from "@/components/EditableCueController";

export const metadata = {
  title: "Força G Samples Controller",
  description: "Controller editável para samples audiovisuais da Força G"
};

export default function ForcaGSamplesControllerPage() {
  return (
    <ControllerSurface>
      <EditableCueController controllerId="forca-g-samples" />
    </ControllerSurface>
  );
}
