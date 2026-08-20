import ControllerSurface from "@/components/ControllerSurface";
import EditableCueController from "@/components/EditableCueController";

export const metadata = {
  title: "Tecnologia Floresta Controller",
  description: "Controller editável para a camada Tecnologia × Floresta"
};

export default function TecnologiaFlorestaControllerPage() {
  return (
    <ControllerSurface>
      <EditableCueController controllerId="tecnologia-floresta" />
    </ControllerSurface>
  );
}
