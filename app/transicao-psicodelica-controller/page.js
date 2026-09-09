import ControllerSurface from "@/components/ControllerSurface";
import EditableCueController from "@/components/EditableCueController";

export const metadata = {
  title: "Transição Psicodélica Controller",
  description: "Controller preparado para a transição psicodélica"
};

export default function TransicaoPsicodelicaControllerPage() {
  return (
    <ControllerSurface>
      <EditableCueController controllerId="transicao-psicodelica" showAudioEffects />
    </ControllerSurface>
  );
}
