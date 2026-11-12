"use client";
import ControllerSurface from "./ControllerSurface";
import PostDemo from "./PostDemo";
import { useControllerSettings } from "@/lib/useControllerSettings";

export default function PostDemoController() {
  const panel = useControllerSettings("post-demo-panel");
  const collapsed = !panel.ready || panel.settings.collapsed;
  return <ControllerSurface presentation={collapsed}>
    <PostDemo controller panelCollapsed={collapsed} panelReady={panel.ready} panelError={panel.error}
      onTogglePanel={() => panel.change({ collapsed: !collapsed })} />
  </ControllerSurface>;
}
