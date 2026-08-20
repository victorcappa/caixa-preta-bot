import ControllerSurface from "@/components/ControllerSurface";
import ForcaGSamplerController from "@/components/ForcaGSamplerController";

export const metadata = {
  title: "Força G Samples Controller",
  description: "Controller editável para samples audiovisuais da Força G"
};

export default function ForcaGSamplesControllerPage() {
  return (
    <ControllerSurface>
      <ForcaGSamplerController />
    </ControllerSurface>
  );
}
