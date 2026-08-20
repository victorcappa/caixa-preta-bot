import ControllerSurface from "@/components/ControllerSurface";
import BaralhoMorbidoController from "./BaralhoMorbidoController";

export const metadata = {
  title: "Baralho Morbido Controller",
  description: "Controller privado do Baralho Morbido"
};

export default function BaralhoMorbidoControllerPage() {
  return (
    <ControllerSurface>
      <BaralhoMorbidoController />
    </ControllerSurface>
  );
}
