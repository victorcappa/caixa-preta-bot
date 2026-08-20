import ControllerSurface from "@/components/ControllerSurface";
import EditableCueController from "@/components/EditableCueController";

export const metadata = {
  title: "Tea For Two Controller",
  description: "Controller preparado para Tea For Two e transição"
};

export default function TeaForTwoControllerPage() {
  return (
    <ControllerSurface>
      <EditableCueController controllerId="tea-for-two" />
    </ControllerSurface>
  );
}
