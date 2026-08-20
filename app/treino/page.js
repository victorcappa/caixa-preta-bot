import ControllerSurface from "@/components/ControllerSurface";
import TrainingConsole from "@/components/TrainingConsole";

export const dynamic = "force-dynamic";

export default function TrainingPage() {
  return (
    <ControllerSurface>
      <TrainingConsole />
    </ControllerSurface>
  );
}
