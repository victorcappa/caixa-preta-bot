import ProjectionWindowClient from "./ProjectionWindowClient";
import PublicGlitchLayer from "./PublicGlitchLayer";
import PublicSceneStage from "./PublicSceneStage";

export default function SceneProjectionPage({ blackoutTarget = "cenas", controllerId = "" }) {
  return (
    <>
      <ProjectionWindowClient />
      <PublicGlitchLayer>
        <PublicSceneStage blackoutTarget={blackoutTarget} controllerId={controllerId} />
      </PublicGlitchLayer>
    </>
  );
}
