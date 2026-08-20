"use client";

import EditableCueController from "./EditableCueController";
import ForcaGShaderControls from "./ForcaGShaderControls";

export default function ForcaGShadersController() {
  return (
    <EditableCueController
      controllerId="forca-g-shaders"
      renderStageOverlay={() => <ForcaGShaderControls />}
    />
  );
}
