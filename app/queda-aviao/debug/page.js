import ControllerSurface from "@/components/ControllerSurface";
import QuedaAviaoController from "../../queda-aviao-controller/QuedaAviaoController";

export const metadata = {
  title: "Queda Avião Controller",
  description: "Controller privado da sequência textual Queda Avião"
};

export default function QuedaAviaoDebugPage() {
  return (
    <ControllerSurface>
      <QuedaAviaoController />
    </ControllerSurface>
  );
}
