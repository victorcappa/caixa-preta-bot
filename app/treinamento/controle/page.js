import ControllerSurface from "@/components/ControllerSurface";
import TarotControls from "@/components/tarot/TarotControls";
export const metadata = { title: "Treinamento / Controle" };
export default function TrainingControlPage() {
  return <ControllerSurface><TarotControls /></ControllerSurface>;
}
