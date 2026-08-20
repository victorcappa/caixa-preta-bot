import ControllerSurface from "@/components/ControllerSurface";
import EditableCueController from "@/components/EditableCueController";

export const metadata = {
  title: "Piloto Videogame Controller",
  description: "Controller editável para sons de videogame do piloto"
};

export default function PilotoVideogameControllerPage() {
  return (
    <ControllerSurface>
      <EditableCueController controllerId="piloto-videogame" />
    </ControllerSurface>
  );
}
