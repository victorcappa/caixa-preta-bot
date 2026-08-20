import ControllerSurface from "@/components/ControllerSurface";
import SceneZeroController from "@/components/SceneZeroController";

export const metadata = {
  title: "Cena 0 — Bot / Malas",
  description: "Controller dramatúrgico da Cena 0"
};

export default function SceneZeroControllerPage() {
  return (
    <ControllerSurface>
      <SceneZeroController />
    </ControllerSurface>
  );
}
