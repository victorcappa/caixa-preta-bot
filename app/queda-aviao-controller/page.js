import ControllerSurface from "@/components/ControllerSurface";
import QuedaAviaoController from "./QuedaAviaoController";

export const metadata = {
  title: "Queda Avião Controller",
  description: "Controller privado da sequência textual Queda Avião"
};

export default function QuedaAviaoControllerPage() {
  return (
    <ControllerSurface>
      <QuedaAviaoController />
    </ControllerSurface>
  );
}
