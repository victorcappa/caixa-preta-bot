import ControllerSurface from "@/components/ControllerSurface";
import SceneZeroController from "@/components/SceneZeroController";

export const metadata = {
  title: "Cena 0 — Videomapping / Quadrantes",
  description: "Controller dramatúrgico da Cena 0 com visualização pública em quadrantes"
};

export default function VideomappingControllerPage() {
  return (
    <ControllerSurface>
      <SceneZeroController />
    </ControllerSurface>
  );
}
