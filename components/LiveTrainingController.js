"use client";
import ControllerSurface from "./ControllerSurface";
import LiveTraining from "./LiveTraining";
import { useControllerSettings } from "@/lib/useControllerSettings";

export default function LiveTrainingController() {
  const header = useControllerSettings("live-training-header");
  const collapsed = header.ready && header.settings.collapsed;
  return <ControllerSurface controlsHidden={collapsed}>
    <LiveTraining controller headerCollapsed={collapsed} headerReady={header.ready} headerError={header.error}
      onToggleHeader={() => header.change({ collapsed: !collapsed })} />
  </ControllerSurface>;
}
